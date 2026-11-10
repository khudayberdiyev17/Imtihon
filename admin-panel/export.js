let exportData=null, exportRequest=0, exportMetadata=false, pdfLibraries;
const exportEl=id=>document.getElementById('export-'+id);
function exportSelection(){return [...document.querySelectorAll('#export-subjects input:checked')].map(el=>el.value);}
async function loadExport(){
 if(exportMetadata){return refreshExport();}
 exportEl('message').textContent='Fanlar va sinflar yuklanmoqda…';
 try{
  const res=await apiFetch('/users/export?metadata=1');const data=await res.json();if(!res.ok)throw Error(data.error);
  for(const name of data.classes){const opt=document.createElement('option');opt.value=name;opt.textContent=name||'Sinf belgilanmagan';exportEl('class').appendChild(opt);}
  exportEl('subjects').replaceChildren();
  for(const s of data.subjects){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=s._id;input.checked=true;input.onchange=()=>{const n=exportSelection().length;exportEl('all').checked=n===data.subjects.length;exportEl('all').indeterminate=n>0&&n<data.subjects.length;refreshExport();};label.append(input,document.createTextNode(s.name));exportEl('subjects').appendChild(label);}
  exportMetadata=true;await refreshExport();
 }catch(e){exportEl('message').textContent=e.message||'Yuklashda xato';}
}
async function refreshExport(){
 const request=++exportRequest;exportData=null;exportEl('download').disabled=true;exportEl('preview').replaceChildren();
 const ids=exportSelection();if(!ids.length){exportEl('message').textContent='Kamida bitta fan tanlang.';return;}
 exportEl('message').textContent='Natijalar yuklanmoqda…';
 try{
  const params=new URLSearchParams({subjectIds:ids.join(',')});if(exportEl('class').value!=='*')params.set('className',exportEl('class').value);
  const res=await apiFetch('/users/export?'+params);const data=await res.json();if(!res.ok)throw Error(data.error);if(request!==exportRequest)return;
  exportData=data;const rows=ExamExport.rows(data);exportEl('message').textContent=rows.length?rows.length+' nafar talaba · '+data.subjects.length+' ta fan. PDF sinflar bo‘yicha alohida sahifalarga ajratiladi.':'Bu sinfda talabalar yo‘q.';
  exportEl('download').disabled=!rows.length;renderExportPreview(data,rows);
 }catch(e){if(request===exportRequest)exportEl('message').textContent=e.message||'Yuklashda xato';}
}
function renderExportPreview(data,rows){
 const table=document.createElement('table');table.className='export-table';const head=table.createTHead(),r=head.insertRow(),sub=head.insertRow();
 const th=(row,text,span=1,rs=1)=>{const c=document.createElement('th');c.textContent=text;c.colSpan=span;c.rowSpan=rs;row.appendChild(c);};
 th(r,'№',1,2);th(r,'FISh / Sinf',1,2);for(const s of data.subjects){th(r,s.name,3);['Jami','To‘g‘ri','Natija %'].forEach(t=>th(sub,t));}
 const body=table.createTBody();rows.slice(0,100).forEach((row,i)=>{const tr=body.insertRow();tr.insertCell().textContent=i+1;tr.insertCell().textContent=row.name+' / '+row.className;for(const c of row.cells){tr.insertCell().textContent=c.total;tr.insertCell().textContent=c.correct??'—';const pct=tr.insertCell();pct.textContent=c.pct===null?'Bo‘sh':c.pct+'%';pct.style.backgroundColor=ExamExport.color(c.pct);pct.style.fontWeight='700';}});
 exportEl('preview').appendChild(table);if(rows.length>100){const p=document.createElement('p');p.textContent='Ko‘rinishda dastlabki 100 talaba. PDFga barcha talabalar kiritiladi.';exportEl('preview').appendChild(p);}
}
function loadPdfLibraries(){
 if(!pdfLibraries)pdfLibraries=(async()=>{for(const src of ['vendor/pdfmake.min.js','vendor/vfs_fonts.js'])await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(Error('PDF kutubxonasini yuklab bo‘lmadi'));document.head.appendChild(script);});})().catch(e=>{pdfLibraries=null;throw e;});return pdfLibraries;
}
exportEl('download').onclick=async()=>{
 const data=exportData;if(!data?.students.length)return;const btn=exportEl('download');btn.disabled=true;btn.textContent='PDF tayyorlanmoqda…';
 try{await loadPdfLibraries();const doc=ExamExport.documentDefinition(data);await new Promise((resolve,reject)=>{try{pdfMake.createPdf(doc).getBlob(blob=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Imtihon-natijalari-'+new Date().toISOString().slice(0,10)+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);resolve();});}catch(e){reject(e);}});}catch(e){exportEl('message').textContent=e.message;}finally{btn.textContent='PDF yuklab olish';btn.disabled=!exportData?.students.length;}
};
exportEl('class').onchange=refreshExport;
exportEl('all').onchange=()=>{document.querySelectorAll('#export-subjects input').forEach(el=>el.checked=exportEl('all').checked);refreshExport();};
exportEl('refresh').onclick=()=>{exportMetadata=false;exportEl('class').replaceChildren(new Option('Barcha sinflar','*'));loadExport();};
