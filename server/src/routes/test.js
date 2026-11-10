const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const TestSession = require('../models/TestSession');
const User = require('../models/User');
const { authenticateStudent } = require('../middleware/auth');

// Global map to track active test sessions (in-memory for real-time tracking)
// Key: userId, Value: { subjectId, startTime, lastHeartbeat, timeoutHandle, ... }
const activeSessions = new Map();
const starting = new Set();
router.use('/questions', authenticateStudent, (req,res,next) => {
  const id = String(req.userId);
  if (starting.has(id)) return res.status(409).json({error:'Session request in progress'});
  starting.add(id); res.once('finish',()=>starting.delete(id)); res.once('close',()=>starting.delete(id)); next();
});

/**
 * Savollarni va variantlarni tasodifiy tartibda aralashtirish.
 * Talabalar bir-biridan savollarni ko'chirib olmasligi uchun:
 *   - savollar — har bir talabaga boshqa tartibda
 *   - variantlar — A/B/C/D o'rnini ham tasodifiy almashtirish
 *
 * Qaytaradi:
 *   {
 *     shuffledQuestions: [{ originalIndex, text, options, timeLimit, imageBase64? }],
 *     questionOrder:     [originalIndex, originalIndex, ...]   // clientIndex → originalIndex
 *     optionMappings:    [{ [clientOpt]: originalOpt }, ...]    // per question
 *   }
 *
 * MUHIM: client `questionIndex` = shuffledQuestions array'idagi indeks.
 *        Haqiqiy DB indeks = questionOrder[clientQuestionIndex].
 */
function shuffleQuestionsAndOptions(questions) {
  // 1) Savollarni tasodifiy tartibda aralashtirish (Fisher-Yates)
  const indices = questions.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const shuffledQuestions = [];
  const optionMappings   = [];

  indices.forEach((originalIndex) => {
    const q = questions[originalIndex];

    // 2) Variantlarni ham aralashtirish, correctIndex ni kuzatamiz
    const optionIndices = q.options.map((_, i) => i);
    for (let i = optionIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [optionIndices[i], optionIndices[j]] = [optionIndices[j], optionIndices[i]];
    }

    // clientOpt -> originalOpt
    const mapping = new Array(optionIndices.length);
    optionIndices.forEach((origOpt, clientOpt) => {
      mapping[clientOpt] = origOpt;
    });
    optionMappings.push(mapping);

    shuffledQuestions.push({
      text:      q.text,
      options:   optionIndices.map(i => q.options[i]),   // clientga ko'rsatiladigan variantlar
      timeLimit: q.timeLimit,
      imageBase64: q.imageBase64
    });
  });

  return {
    shuffledQuestions,
    questionOrder:  indices,        // [clientIdx] = originalIdx
    optionMappings                  // [clientQuestionIdx][clientOpt] = originalOpt
  };
}

// Start a new test session - get questions for a subject
router.get('/questions', async (req, res) => {
  try {
    const { subjectId } = req.query;
    const userId = req.userId.toString();

    if (!subjectId) {
      return res.status(400).json({ error: 'subjectId is required' });
    }

    // Check if user already has an active test session
    if (activeSessions.has(userId)) {
      const existingSession = activeSessions.get(userId);
      if (existingSession.subjectId !== subjectId) return res.status(409).json({error:'Another exam is active'});
      return res.json({sessionId:existingSession.testSessionId, subjectId, subjectName:existingSession.snapshot.name, questions:existingSession.questions, answers:existingSession.answers, startTime:existingSession.startTime, remainingTime:Math.max(0, existingSession.totalTimeLimit-(Date.now()-existingSession.startTime)), totalTimeLimit:existingSession.totalTimeLimit/60000, passingThreshold:existingSession.snapshot.passingThreshold});
    }

    // Check if there's an unfinished session in DB
    const unfinishedSession = await TestSession.findOne({
      userId: req.userId,
      status: 'active'
    });

    if (unfinishedSession) {
      return res.status(409).json({ 
        error: 'Unfinished test session exists',
        message: 'You have an unfinished test. Please complete it first.'
      });
    }

    // Get the subject
    const subject = await Subject.findById(subjectId);
    if (subject && !(req.user.subjects || []).includes(subject.name)) return res.status(403).json({ error: 'Subject not assigned' });
    if (subject && (!subject.questions.length || subject.totalTimeLimit <= 0)) return res.status(400).json({ error: 'Invalid exam configuration' });
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    if (!subject.isActive) {
      return res.status(403).json({ error: 'This subject is currently inactive' });
    }

    // Check if user already completed this subject
    const completedSession = await TestSession.findOne({
      userId: req.userId,
      subjectId,
      status: 'completed'
    });

    if (completedSession) {
      return res.status(403).json({ 
        error: 'Subject already completed',
        message: 'You have already completed this subject.'
      });
    }

    // Reset key press count so this test starts fresh
    await User.findByIdAndUpdate(req.userId, { keyPressCount: 0 });

    // ── Savollarni va variantlarni tasodifiy aralashtirish ──
    // Har bir talabaga boshqa tartibda savollar + variantlar chiqadi.
    // Bu talabalar bir-biridan javob ko'chirib olmasligi uchun kerak.
    const { shuffledQuestions, questionOrder, optionMappings } =
      shuffleQuestionsAndOptions(subject.questions);

    // Create a new test session in DB
    const testSession = new TestSession({
      userId: req.userId,
      subjectId: subject._id,
      totalQuestions: subject.questions.length,
      status: 'active',
      snapshot: subject.toObject(), questionOrder, optionMappings,
      deadline: new Date(Date.now() + subject.totalTimeLimit * 60000)
    });
    await testSession.save();

    // Store active session in memory
    // ⚠️  questionOrder va optionMappings SHU SESSIYA uchun maxsus —
    // submit qilishda client indeksini original DB indeksga qaytarish uchun ishlatiladi.
    const sessionData = {
      snapshot: subject.toObject(), answers: [],
      subjectId: subject._id.toString(),
      testSessionId: testSession._id.toString(),
      startTime: Date.now(),
      lastHeartbeat: Date.now(),
      totalTimeLimit: subject.totalTimeLimit * 60 * 1000, // Convert minutes to ms
      questions: shuffledQuestions,
      // Randomlashtirish mappinglari (faqat server tomonida, clientga yuborilmaydi)
      questionOrder,     // [clientIdx] = originalIdx
      optionMappings     // [clientQuestionIdx][clientOpt] = originalOpt
    };

    activeSessions.set(userId, sessionData);

    // Set up auto-timeout
    const timeoutHandle = setTimeout(async () => {
      await handleTestTimeout(userId);
    }, sessionData.totalTimeLimit);

    activeSessions.get(userId).timeoutHandle = timeoutHandle;

    // Return questions WITHOUT correct answers va WITHOUT mappinglari
    res.json({
      sessionId: testSession._id,
      subjectId: subject._id,
      subjectName: subject.name,
      totalTimeLimit: subject.totalTimeLimit, // in minutes
      passingThreshold: subject.passingThreshold || { thresholdType: 'percent', thresholdValue: 60 },
      questions: shuffledQuestions,
      startTime: sessionData.startTime
    });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Handle test timeout
async function handleTestTimeout(userId) {
  try {
    const session = activeSessions.get(userId);
    if (!session) return;
    if (session.submitting) { setTimeout(()=>handleTestTimeout(userId),1000); return; }

    // Auto-submit with current answers
    session.submitting = true;
    try { await submitTest(userId, 'timeout', session.answers || []); activeSessions.delete(userId); }
    finally { session.submitting = false; }
  } catch (error) {
    console.error('Timeout handler error:', error);
    if (activeSessions.has(userId)) setTimeout(()=>handleTestTimeout(userId),5000);
  }
}

// Submit test answers
router.post('/submit', authenticateStudent, async (req, res) => {
  try {
    const { answers } = req.body;
    const userId = req.userId.toString();

    const session = activeSessions.get(userId);
    if (!session) {
      const previous = req.body.sessionId && await TestSession.findOne({_id:req.body.sessionId, userId:req.userId, status:'completed'}).lean();
      if (previous) return res.json(previous);
      return res.status(400).json({ error: 'No active test session found' });
    }

    if (req.body.sessionId !== session.testSessionId) return res.status(409).json({error:'Session mismatch'});
    // Validate answers
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Answers are required' });
    }

    if (session.submitting) return res.status(409).json({ error: 'Submission in progress' });
    session.submitting = true;
    let result;
    try { result = await submitTest(userId, 'manual', Date.now() > session.startTime + session.totalTimeLimit ? session.answers || [] : answers); }
    finally { session.submitting = false; }
    activeSessions.delete(userId);

    // Adminga real-vaqtda xabar
    const wsServer = req.app.locals.wsServer;
    if (wsServer) {
      const u = req.user;
      wsServer.broadcastAdmins({
        type: 'test_completed',
        student: {
          id: u._id,
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          className: u.className
        },
        score:          result.score,
        correctAnswers: result.correctAnswers,
        wrongAnswers:   result.wrongAnswers,
        totalQuestions: result.totalQuestions,
        passed:         result.passed,
        completedAt:    new Date().toISOString()
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Submit test error:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to submit test' });
  }
});

// Submit test helper function
async function submitTest(userId, reason, answers = []) {
  const session = activeSessions.get(userId);
  if (!session) throw new Error('No active session');

  const subject = session.snapshot || await Subject.findById(session.subjectId);
  if (!subject) throw new Error('Subject not found');

  // ── Random mappinglarni olish ──
  // Agar mapping mavjud bo'lmasa (eski sessiya), identity mapping ishlatamiz
  // (eski natijalar to'g'ri hisoblanishi uchun).
  const questionOrder  = session.questionOrder  || subject.questions.map((_, i) => i);
  const optionMappings = session.optionMappings || subject.questions.map(() => null);

  validateAnswers(answers, session.questions);

  // Calculate score
  let correctAnswers = 0;
  let wrongAnswers   = 0;
  const detailedResults = [];

  for (const answer of answers) {
    // ⚠️  MUHIM: answer.questionIndex — bu CLIENTga ko'rsatilgan indeks
    // (randomlashtirilgan). Haqiqiy DB indeksni olish uchun questionOrder orqali mapping qilamiz.
    const clientQuestionIndex = answer.questionIndex;
    const originalQuestionIndex = questionOrder[clientQuestionIndex];

    const question = subject.questions[originalQuestionIndex];
    if (!question) continue;

    // Xuddi shunday, client tanlagan variant indeksi ham client ko'rinishidagi indeks.
    // Aslida qaysi variant to'g'ri ekanini tekshirish uchun original indeksga o'tkazamiz.
    const clientSelectedOption  = answer.selectedOption;
    const originalSelectedOption = optionMappings[clientQuestionIndex]
      ? optionMappings[clientQuestionIndex][clientSelectedOption]
      : clientSelectedOption;

    const isCorrect = originalSelectedOption === question.correctIndex;
    if (isCorrect) {
      correctAnswers++;
    } else {
      wrongAnswers++;
    }

    detailedResults.push({
      // Natijalarda client indeksini saqlaymiz (admin hisobotda shunday ko'rinadi)
      questionIndex:        clientQuestionIndex,
      questionText:         question.text,
      selectedOption:       clientSelectedOption,
      selectedOptionText:   question.options[originalSelectedOption],
      correctOption:        question.correctIndex,
      correctOptionText:    question.options[question.correctIndex],
      isCorrect
    });
  }

  // Handle unanswered questions as wrong
  const answeredIndices = answers.map(a => a.questionIndex);
  for (let i = 0; i < subject.questions.length; i++) {
    // i — original indeks. Client bu savolni ko'rganmi?
    const clientIdx = questionOrder.indexOf(i);
    if (clientIdx === -1) continue; // bu savol umuman clientga ko'rsatilmagan (subset bo'lsa)
    if (answeredIndices.includes(clientIdx)) continue;

    wrongAnswers++;
    const question = subject.questions[i];
    detailedResults.push({
      questionIndex:        clientIdx,
      questionText:         question.text,
      selectedOption:       null,
      selectedOptionText:   null,
      correctOption:        question.correctIndex,
      correctOptionText:    question.options[question.correctIndex],
      isCorrect:            false,
      reason:               'unanswered'
    });
  }

  const score = Math.round((correctAnswers / subject.questions.length) * 100);

  // Compute passed using subject's threshold (default 60%)
  const thr = subject.passingThreshold;
  const passed = thr?.thresholdType === 'count'
    ? correctAnswers >= (thr?.thresholdValue ?? 60)
    : score        >= (thr?.thresholdValue ?? 60);

  // Update test session in DB
  // DB'ga original indekslarda saqlaymiz (kelajakda qayta tekshirish uchun qulay)
  const testSession = await TestSession.findOne({
    userId,
    subjectId: session.subjectId,
    _id: session.testSessionId, status: 'active'
  });

  if (testSession) {
    const normalizedAnswers = answers.map(a => {
      const clientQIdx  = a.questionIndex;
      const origQIdx    = questionOrder[clientQIdx];
      const optMap      = optionMappings[clientQIdx];
      const origSelOpt  = optMap ? optMap[a.selectedOption] : a.selectedOption;
      return {
        questionIndex:  origQIdx,    // original DB indeksi
        selectedOption: origSelOpt   // original variant indeksi
      };
    });

    testSession.answers        = normalizedAnswers;
    testSession.score          = score;
    testSession.correctAnswers = correctAnswers;
    testSession.wrongAnswers   = wrongAnswers;
    testSession.status         = 'completed';
    testSession.detailedResults = detailedResults;
    testSession.passed = passed;
    await testSession.save();
  }

  // Clear timeout
  if (session.timeoutHandle) {
    clearTimeout(session.timeoutHandle);
  }

  return {
    message: reason === 'timeout' ? 'Test submitted due to timeout' : 'Test submitted successfully',
    score,
    passed,
    passingThreshold: subject.passingThreshold || { thresholdType: 'percent', thresholdValue: 60 },
    totalQuestions: subject.questions.length,
    correctAnswers,
    wrongAnswers,
    timeUsed: Math.floor((Date.now() - session.startTime) / 1000),
    detailedResults
  };
}

// Heartbeat endpoint for WebSocket alternative (HTTP-based keep-alive)
router.post('/heartbeat', authenticateStudent, async (req, res) => {
  try {
    const userId = req.userId.toString();
    const session = activeSessions.get(userId);

    if (!session) {
      return res.status(400).json({ 
        error: 'No active test session',
        shouldReturnToLogin: true
      });
    }

    // Update last heartbeat
    session.lastHeartbeat = Date.now();

    res.json({
      success: true,
      remainingTime: session.totalTimeLimit - (Date.now() - session.startTime)
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

// Get active session status
router.get('/status', authenticateStudent, async (req, res) => {
  try {
    const userId = req.userId.toString();
    const session = activeSessions.get(userId);

    if (!session) {
      return res.json({ hasActiveSession: false });
    }

    res.json({
      hasActiveSession: true,
      subjectId: session.subjectId,
      remainingTime: session.totalTimeLimit - (Date.now() - session.startTime),
      startTime: session.startTime
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Report test interruption (for client to notify server of disconnect/shutdown)
router.post('/report-interruption', authenticateStudent, async (req,res) => {
  // Keep the deadline and saved answers. A network failure is not proof of cheating.
  res.json({message:'Connection interruption noted; reconnect to resume'});
});

function validateAnswers(answers, questions) {
  const seen = new Set();
  if (!Array.isArray(answers) || answers.length > questions.length) throw Object.assign(new Error('Invalid answers'), {status: 400});
  for (const a of answers) {
    if (!a || !Number.isInteger(a.questionIndex) || !Number.isInteger(a.selectedOption) || !questions[a.questionIndex] || a.selectedOption < 0 || a.selectedOption >= questions[a.questionIndex].options.length || seen.has(a.questionIndex)) throw Object.assign(new Error('Invalid or duplicate answer'), {status: 400});
    seen.add(a.questionIndex);
  }
}
router.post('/answers', authenticateStudent, async (req, res) => {
  try {
    const session = activeSessions.get(req.userId.toString());
    if (!session || session.submitting || req.body.sessionId !== session.testSessionId || Date.now() >= session.startTime + session.totalTimeLimit) return res.status(409).json({error: 'Session closed'});
    validateAnswers(req.body.answers, session.questions);
    await TestSession.updateOne({_id: session.testSessionId, status: 'active'}, {$set: {draftAnswers: req.body.answers}});
    session.answers = req.body.answers;
    res.json({success: true});
  } catch (e) { res.status(e.status || 500).json({error: e.message}); }
});
router.restoreSessions = async () => {
  const sessions = await TestSession.find({status: 'active'}).select('+snapshot').lean();
  for (const doc of sessions) {
    if (!doc.snapshot || !doc.deadline) {
      await TestSession.updateOne({_id: doc._id}, {$set: {status: 'interrupted'}});
      continue;
    }
    const questions = doc.questionOrder.map((original, i) => {
      const q = doc.snapshot.questions[original];
      return {text:q.text, options:doc.optionMappings[i].map(j=>q.options[j]), imageBase64:q.imageBase64, timeLimit:q.timeLimit};
    });
    const data = {testSessionId:String(doc._id), subjectId:String(doc.subjectId), snapshot:doc.snapshot, questionOrder:doc.questionOrder, optionMappings:doc.optionMappings, questions, answers:doc.draftAnswers || [], startTime:+doc.startTime, totalTimeLimit:+doc.deadline - +doc.startTime, lastHeartbeat:Date.now()};
    activeSessions.set(String(doc.userId), data);
    data.timeoutHandle = setTimeout(()=>handleTestTimeout(String(doc.userId)), Math.max(0, +doc.deadline-Date.now()));
  }
};
// Attach helpers to router so WebSocketServer can destructure them
router.validateAnswers = validateAnswers;
router.shuffleQuestionsAndOptions = shuffleQuestionsAndOptions;
router.activeSessions      = activeSessions;
router.submitTest          = submitTest;
router.handleTestTimeout   = handleTestTimeout;

module.exports = router;
