(function(root){
 const color = pct => pct === null ? '#fee2e2' : pct >= 80 ? '#bbf7d0' : pct >= 60 ? '#d9f99d' : pct >= 40 ? '#fef08a' : '#fed7aa';
 function rows(data) {
  const latest = new Map();
  for (const r of data.results) {const key=String(r.userId)+':'+String(r.subjectId);if(!latest.has(key))latest.set(key,r);}
  return data.students.map(u=>({id:u._id,name:[u.lastName,u.firstName].filter(Boolean).join(' ')||u.username,className:u.className||'Sinf belgilanmagan',cells:data.subjects.map(s=>{
   const r=latest.get(String(u._id)+':'+String(s._id));
   return r?{total:r.totalQuestions,correct:r.correctAnswers,pct:r.score}:{total:s.questionCount,correct:null,pct:null};
  })}));
 }
 function documentDefinition(data,stamp=new Date().toLocaleString('uz-UZ')) {
  const all=rows(data), groups=new Map();
  for(const r of all){if(!groups.has(r.className))groups.set(r.className,[]);groups.get(r.className).push(r);}
  const content=[];
  for(const [className,students] of groups) for(let offset=0;offset<data.subjects.length;offset+=6){
   const subjects=data.subjects.slice(offset,offset+6);
   const cell=(text,extra={})=>({text:String(text),alignment:'center',...extra});
   const head=[cell('№',{rowSpan:2}),cell('FISh',{rowSpan:2})], sub=['',''];
   for(const s of subjects){head.push(cell(s.name,{colSpan:3}),{},{});sub.push(cell('Jami'),cell('To‘g‘ri'),cell('Natija %'));}
   const body=[head,sub];
   students.forEach((r,i)=>{const line=[cell(i+1),cell(r.name,{alignment:'left'})];for(const c of r.cells.slice(offset,offset+6))line.push(cell(c.total),cell(c.correct??'—'),cell(c.pct===null?'Bo‘sh':c.pct+'%',{fillColor:color(c.pct),bold:true}));body.push(line);});
   content.push({text:className+' — imtihon natijalari',style:'title',...(content.length?{pageBreak:'before'}:{})},
    {text:stamp+'  •  '+students.length+' nafar talaba  •  Fanlar '+(offset+1)+'–'+(offset+subjects.length),margin:[0,0,0,10],color:'#64748b',fontSize:9},
    {table:{headerRows:2,keepWithHeaderRows:1,dontBreakRows:true,widths:[20,140,...subjects.flatMap(()=>['*','*','*'])],body},layout:{fillColor:i=>i<2?'#e2e8f0':null,hLineWidth:()=>0.5,vLineWidth:()=>0.5,hLineColor:()=>'#94a3b8',vLineColor:()=>'#94a3b8',paddingTop:()=>5,paddingBottom:()=>5}},
    {text:'Bo‘sh: tugallangan natija yo‘q. Ranglar: <40% to‘q sariq; 40–59% sariq; 60–79% och yashil; ≥80% yashil. Foiz — serverda saqlangan baho.',fontSize:8,color:'#64748b',margin:[0,10,0,0]});
  }
  return {pageSize:'A3',pageOrientation:'landscape',pageMargins:[24,28,24,30],defaultStyle:{font:'Roboto',fontSize:9},styles:{title:{fontSize:17,bold:true,color:'#0f172a',margin:[0,0,0,6]}},content,footer:(page,total)=>({text:page+' / '+total,alignment:'right',margin:[0,0,24,0],fontSize:8,color:'#64748b'})};
 }
 const api={rows,color,documentDefinition};if(typeof module!=='undefined')module.exports=api;else root.ExamExport=api;
})(typeof window==='undefined'?globalThis:window);
