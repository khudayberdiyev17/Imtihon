// Run from the project root after starting the isolated imtihon-smoke stack.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const WebSocket = require('ws');
const env = Object.fromEntries(fs.readFileSync('deploy/.smoke.env','utf8').trim().split(/\r?\n/).map(l=>l.split('=')));
const compose=['compose','--env-file','deploy/.smoke.env','-p','imtihon-smoke','-f','docker-compose.yml','-f','deploy/.smoke.yml'];
const base='http://127.0.0.1:18082';
async function api(method,path,body,token,status=200){
 const r=await fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
 const data=await r.json();assert.equal(r.status,status,`${method} ${path}: ${JSON.stringify(data)}`);return data;
}
async function wsAuth(message,valid){
 return new Promise((resolve,reject)=>{
  const ws=new WebSocket('ws://127.0.0.1:18082/ws');
  const t=setTimeout(()=>{ws.terminate();reject(Error('WS timeout'));},5000);
  ws.on('open',()=>ws.send(JSON.stringify(message)));
  ws.on('message',data=>{const m=JSON.parse(data);if(m.type==='auth_success'){clearTimeout(t);ws.close();valid?resolve():reject(Error('Unauthenticated websocket accepted'));}});
  ws.on('close',code=>{clearTimeout(t);if(!valid)code===1008?resolve():reject(Error('Unexpected close '+code));});
  ws.on('error',reject);
 });
}
(async()=>{
 assert.equal((await fetch(base+'/health')).status,200);
 assert.equal((await fetch(base)).status,200);
 execFileSync('docker',[...compose,'exec','-T','server','node','src/create-admin.js'],{stdio:'pipe'});
 execFileSync('docker',[...compose,'exec','-T','server','node','src/create-admin.js'],{stdio:'pipe'});
 const admin=(await api('POST','/admin/login',{username:'admin',password:env.ADMIN_PASSWORD})).token;
 await wsAuth({type:'auth',role:'admin',token:'invalid'},false);
 await wsAuth({type:'auth',role:'admin',token:admin},true);
 const suffix=Date.now();
 const subject=await api('POST','/subjects',{name:'Smoke '+suffix,totalTimeLimit:5,questions:[{text:'2+2?',options:['4','3','5','6'],correctIndex:0,imageBase64:'data:image/png;base64,aGVsbG8='},{text:'3+3?',options:['6','1','2','3'],correctIndex:0}]},admin,201);
 const user=await api('POST','/users',{username:'smoke'+suffix,password:'test-password-123',subjects:[subject.name]},admin,201);
 const student=(await api('POST','/auth/login',{username:user.user.username,password:'test-password-123'})).token;
 const exam=await api('GET','/test/questions?subjectId='+subject._id,null,student);
 assert(exam.questions.some(q=>q.imageBase64));assert(exam.questions.every(q=>q.correctIndex===undefined));
 const answers=exam.questions.map((q,i)=>({questionIndex:i,selectedOption:q.options.indexOf(q.text==='2+2?'?'4':'6')}));
 await api('POST','/test/submit',{sessionId:exam.sessionId,answers:[answers[0],answers[0]]},student,400);
 await api('POST','/test/answers',{sessionId:exam.sessionId,answers},student);
 // Mutating source questions must not alter grading of the running snapshot.
 await api('PUT','/subjects/'+subject._id,{questions:[{text:'Changed',options:['x','y','z','w'],correctIndex:3}]},admin);
 execFileSync('docker',[...compose,'restart','server'],{stdio:'pipe'});
 for(let i=0;i<60;i++){try {if((await fetch(base+'/health')).ok)break;}catch{} await new Promise(r=>setTimeout(r,1000));}
 const resumed=await api('GET','/test/questions?subjectId='+subject._id,null,student);
 assert.deepEqual(resumed.questions,exam.questions);assert.deepEqual(resumed.answers,answers);
 const result=await api('POST','/test/submit',{sessionId:exam.sessionId,answers},student);
 assert.equal(result.score,100);assert.equal(result.totalQuestions,2);
 const repeated=await api('POST','/test/submit',{sessionId:exam.sessionId,answers},student);assert.equal(repeated.score,100);
 const report=await api('GET','/users/reports/'+exam.sessionId,null,admin);assert.equal(report.detailedResults.length,2);assert.equal(report.session.score,100);
 const timed=await api('POST','/subjects',{name:'Timed '+suffix,totalTimeLimit:0.05,questions:[{text:'One',options:['yes','no','x','y'],correctIndex:0}]},admin,201);
 await api('GET','/test/questions?subjectId='+timed._id,null,student,403);
 await api('PUT','/users/'+user.user.id,{subjects:[subject.name,timed.name]},admin);
 const short=await api('GET','/test/questions?subjectId='+timed._id,null,student);
 const timedAnswers=[{questionIndex:0,selectedOption:short.questions[0].options.indexOf('yes')}];
 await api('POST','/test/answers',{sessionId:short.sessionId,answers:timedAnswers},student);
 await new Promise(r=>setTimeout(r,4000));
 const timedResult=await api('POST','/test/submit',{sessionId:short.sessionId,answers:timedAnswers},student);
 assert.equal(timedResult.score,100);
 const status=await api('GET','/test/status',null,student);assert.equal(status.hasActiveSession,false);
 await api('GET','/users/export?metadata=1',null,student,403);
 await api('PUT','/users/'+user.user.id,{subjects:[subject.name,timed.name]},admin);
 await api('PUT','/auth/profile',{className:'Export-'+suffix,firstName:'Ali',lastName:'G‘ulomov'},student);
 const meta=await api('GET','/users/export?metadata=1',null,admin);assert(meta.classes.includes('Export-'+suffix));
 const exported=await api('GET','/users/export?className=Export-'+suffix+'&subjectIds='+subject._id,null,admin);
 assert.equal(exported.students.length,1);assert.equal(exported.subjects.length,1);assert.equal(exported.results[0].totalQuestions,2);assert(!('password' in exported.students[0]));assert(!('questions' in exported.subjects[0]));
 console.log('PASS: export access control, exact class/subject filtering, compact historical results');
 console.log('PASS: unauthorized subject rejected; server timeout saves draft and closes session');
 console.log('PASS: health, panel, admin provisioning/login, WS authentication, image transport, duplicate rejection, draft, restart/resume, frozen grading, idempotent submit, report');
})().catch(e=>{console.error(e);process.exitCode=1});
