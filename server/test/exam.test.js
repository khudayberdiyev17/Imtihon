const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function load() {
 const router = {use(){},get(){},post(){}};
 const records = [];
 const model = {findOne: async()=>({save:async function(){records.push(this)}})};
 const context = {module:{exports:{}}, require(name){
  if(name==='express') return {Router:()=>router};
  if(name.includes('middleware')) return {authenticateStudent(){}};
  if(name.includes('TestSession')) return model;
  return {};
 }, console, setTimeout, clearTimeout, Date, Map, Set};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/routes/test.js'),'utf8'),context);
 return {r:context.module.exports, records};
}
test('reject duplicates, invalid indices, non-integers and excessive answers',()=>{
 const {r}=load(); const q=[{options:['A','B']}];
 for(const answers of [[{questionIndex:0,selectedOption:0},{questionIndex:0,selectedOption:0}],[{questionIndex:1,selectedOption:0}],[{questionIndex:0,selectedOption:-1}],[{questionIndex:0,selectedOption:1.5}],null]) assert.throws(()=>r.validateAnswers(answers,q));
 assert.doesNotThrow(()=>r.validateAnswers([{questionIndex:0,selectedOption:1}],q));
});
test('shuffle preserves images and correct option mapping',()=>{
 const {r}=load(); const q=[{text:'Q',options:['A','B','C','D'],correctIndex:2,imageBase64:'data:image/png;base64,abc'}];
 for(let i=0;i<30;i++) {
  const x=r.shuffleQuestionsAndOptions(q);
  assert.equal(x.shuffledQuestions[0].imageBase64,q[0].imageBase64);
  x.optionMappings[0].forEach((original,j)=>assert.equal(x.shuffledQuestions[0].options[j],q[0].options[original]));
  assert.equal(x.shuffledQuestions[0].correctIndex,undefined);
 }
});
test('grading uses frozen snapshot and counts unanswered once',async()=>{
 const {r,records}=load();
 r.activeSessions.set('u',{subjectId:'s',testSessionId:'t',startTime:Date.now(),questions:[{options:['A','B']},{options:['C','D']}],snapshot:{questions:[{text:'Q1',options:['A','B'],correctIndex:1},{text:'Q2',options:['C','D'],correctIndex:0}],passingThreshold:{thresholdType:'percent',thresholdValue:50}},questionOrder:[1,0],optionMappings:[[1,0],[0,1]]});
 const result=await r.submitTest('u','manual',[{questionIndex:0,selectedOption:1}]);
 assert.equal(result.score,50); assert.equal(result.wrongAnswers,1); assert.equal(result.passed,true); assert.equal(records[0].answers[0].questionIndex,1);
});
test('timeout grades saved draft and removes active session',async()=>{
 const {r,records}=load();r.activeSessions.set('u',{subjectId:'s',testSessionId:'t',startTime:Date.now(),questions:[{options:['A']}],snapshot:{questions:[{text:'Q',options:['A'],correctIndex:0}]},questionOrder:[0],optionMappings:[[0]],answers:[{questionIndex:0,selectedOption:0}]});
 await r.handleTestTimeout('u');assert.equal(records[0].score,100);assert.equal(r.activeSessions.has('u'),false);
});

test('WebSocket rejects invalid tokens and derives identity from signed claims',async()=>{
 const jwt=require('jsonwebtoken'); const secret='test-secret-'.repeat(4);
 const context={module:{exports:{}},require(name){
  if(name==='ws') return {OPEN:1};
  if(name==='jsonwebtoken') return jwt;
  if(name.includes('middleware/auth')) return {JWT_SECRET:secret};
  if(name.includes('models/User')) return {findById:()=>({select:()=>({lean:async()=>({_id:'real-user',role:'student',status:'active'})})})};
  if(name.includes('routes/test')) return {activeSessions:new Map()};
  return {};
 },console,Date,Map,Set};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/utils/WebSocketServer.js'),'utf8'),context);
 const server=Object.create(context.module.exports.prototype);server.clients=new Map();server.adminClients=new Set();
 let closed=false; const bad={close(){closed=true}};await server.handleAuth(bad,{token:'bad',role:'admin'});assert.equal(closed,true);assert.equal(server.adminClients.size,0);
 const good={send(){},close(){}};await server.handleAuth(good,{token:jwt.sign({userId:'real-user',role:'student'},secret,{expiresIn:60}),role:'admin',userId:'victim'});assert.equal(good.userId,'real-user');assert.equal(server.adminClients.size,0);
});
