'use strict';
let officePromise, databasePromise;
let pendingAttachments=[];
let picking=false;
function officeTools() { if(!officePromise)officePromise=import('./office.mjs').catch(e=>{officePromise=null;throw new Error('Dateiverarbeitung konnte nicht geladen werden: '+e.message);});return officePromise; }
function database() {
 if(!databasePromise)databasePromise=new Promise((resolve,reject)=>{
  const req=indexedDB.open('ki-workspace-files',1);req.onupgradeneeded=()=>{req.result.createObjectStore('files',{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('Dateien können auf diesem Gerät nicht gespeichert werden. '+req.error?.message));
 });return databasePromise;
}
async function fileOperation(mode,operation) {
 const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('files',mode),store=tx.objectStore('files');let result;const request=operation(store);request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(new Error('Dateispeicherung fehlgeschlagen: '+tx.error?.message));tx.onabort=()=>reject(new Error('Dateispeicherung abgebrochen.'));});
}
function getFileRecord(id){return fileOperation('readonly',store=>store.get(id));}
function putFileRecord(record){return fileOperation('readwrite',store=>store.put(record));}
function deleteFileRecord(id){return fileOperation('readwrite',store=>store.delete(id));}
function allFileRecords(){return fileOperation('readonly',store=>store.getAll());}
function blobDataURL(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Datei konnte nicht gelesen werden.'));reader.readAsDataURL(blob);});}
async function readPdf(arrayBuffer) {
 const pdfjs=await import('./vendor/pdfjs/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',location.href).href;
 const task=pdfjs.getDocument({data:new Uint8Array(arrayBuffer),isEvalSupported:false,disableFontFace:true});const pdf=await task.promise;
 try {
  if(pdf.numPages>100)throw new Error('PDF-Dateien mit mehr als 100 Seiten bitte in Abschnitte aufteilen.');
  const pages=[],images=[];let characters=0;
  for(let i=1;i<=pdf.numPages;i++) {
   const page=await pdf.getPage(i),content=await page.getTextContent();let text='';
   for(const item of content.items)if(item.str!==undefined)text+=item.str+(item.hasEOL?'\n':' ');
   characters+=text.length;if(characters>200000)throw new Error('Die PDF enthält mehr als 200.000 Zeichen. Bitte einen Ausschnitt wählen. Es wurde nichts gekürzt.');
   pages.push(`Seite ${i}:\n${text.trim()}`);
   if(text.trim().length<20) {
    if(images.length>=12)throw new Error('Mehr als zwölf eingescannte PDF-Seiten werden nicht unterstützt. Bitte einen Ausschnitt wählen.');
    const initial=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(1.5,1200/initial.width)}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;images.push({page:i,url:canvas.toDataURL('image/jpeg',.82)});canvas.width=canvas.height=0;
   }
   page.cleanup();
  }
  return {text:pages.join('\n\n'),images,description:images.length?'Text und eingescannte Seiten eingelesen; Bildunterstützung erforderlich.':'PDF-Text nach Seiten eingelesen.'};
 } finally {await task.destroy();}
}
async function prepareFile(file) {
 if(file.size>16*1024*1024)throw new Error('Die Datei ist größer als 16 MB. Bitte einen kleineren Ausschnitt wählen.');
 const ext=file.name.split('.').at(-1).toLowerCase(),record={id:crypto.randomUUID(),name:file.name,type:file.type || 'application/octet-stream',size:file.size,blob:file,created:Date.now(),category:'text'};
 if(['image/png','image/jpeg','image/gif','image/webp'].includes(file.type)){record.category='image';record.description='Bild — benötigt ein Modell mit Bildunterstützung.';return record;}
 if(ext==='pdf'){const info=await readPdf(await file.arrayBuffer());Object.assign(record,{extracted:info.text,images:info.images,description:info.description,category:'pdf'});return record;}
 if(['docx','xlsx','mid','midi'].includes(ext)){const info=await (await officeTools()).readDocument(file,await file.arrayBuffer());Object.assign(record,{extracted:info.text,description:info.description,category:ext==='midi'?'mid':ext});return record;}
 const textFile=/\.(txt|md|json|jsonl|csv|tsv|html|xml|musicxml|abc|ly|js|ts|py|lua|css|log|yaml|yml|r|sql|tex|svg)$/i.test(file.name) || file.type.startsWith('text/');
 if(!textFile)throw new Error('Dieses Format wird noch nicht gelesen. Unterstützt sind PDF, DOCX, XLSX, MIDI, Bilder und Textdateien. Audio, Video, alte DOC/XLS-Dateien und ZIP sind hier nicht unterstützt.');
 record.extracted=await file.text();if(record.extracted.length>200000)throw new Error('Die Datei enthält mehr als 200.000 Zeichen. Bitte einen Ausschnitt wählen.');record.description='Textdatei';return record;
}
async function pickAttachments(event) {
 if(busy || picking)return;const files=[...event.target.files];if(!files.length)return;
 if(files.length+pendingAttachments.length>8){status('Bis zu acht Dateien können gleichzeitig angehängt werden.',true);return;}
 picking=true;$('btn-send').disabled=true;status('Dateien werden eingelesen …');
 try {
  for(const file of files){const record=await prepareFile(file);await putFileRecord(record);pendingAttachments.push({id:record.id,name:record.name,category:record.category,description:record.description,hasImages:record.category==='image'||!!record.images?.length});}
  status('Dateien bereit. Ihre Inhalte werden mit der nächsten Nachricht an OpenRouter gesendet.');
 } catch(e){status(e.message,true);}finally {picking=false;$('btn-send').disabled=busy;renderAttachments();$('file-picker').value='';}
}
function renderAttachments() {
 setStorage('or_pending',JSON.stringify(pendingAttachments));
 const container=$('file-indicator');container.replaceChildren();container.style.display=pendingAttachments.length?'flex':'none';
 for(const record of pendingAttachments){const chip=document.createElement('div');chip.className='attachment-chip';const span=document.createElement('span');span.textContent=record.name;span.title=record.description;const button=document.createElement('button');button.className='touch-btn';button.textContent='×';button.setAttribute('aria-label',record.name+' entfernen');button.onclick=()=>{if(busy)return;pendingAttachments=pendingAttachments.filter(a=>a.id!==record.id);renderAttachments();};if(record.category==='image'){const img=document.createElement('img');img.className='attachment-thumbnail';img.alt=record.name;chip.append(img);previewRecord(record).then(d=>{if(chip.isConnected)img.src=d.url;}).catch(()=>{});}chip.append(span,button);container.append(chip);}
}
function clearPendingAttachments(){pendingAttachments=[];renderAttachments();$('file-picker').value='';}
async function messageForAPI(message,seenTextFiles=new Set()) {
 if(message.role==='assistant')return {role:message.role,content:contentText(message.content) || (message.attachments?.some(a=>a.generated)?'Ein Bild wurde erzeugt.':'')};
 if(!message.attachments?.length)return {role:message.role,content:message.content};
 const parts=[{type:'text',text:contentText(message.content) || 'Bitte betrachte die angehängten Dateien.'}];
 for(const descriptor of message.attachments){const record=await getFileRecord(descriptor.id);if(!record)throw new Error(`Die Datei „${descriptor.name}“ ist auf diesem Gerät nicht mehr vorhanden. Bitte erneut anhängen oder einen neuen Chat beginnen.`);
  if(record.extracted && seenTextFiles.has(record.id))parts.push({type:'text',text:`[Datei: ${record.name}; Dateikennung: ${record.id}; Inhalt unverändert bereits früher in diesem Chat mitgeliefert.]`});
  else if(record.extracted){seenTextFiles.add(record.id);parts.push({type:'text',text:`[Datei: ${record.name}; Dateikennung: ${record.id}; Format: ${record.category}]\n${record.extracted}\n[Ende der Datei]`});}
  if(record.category==='image')parts.push({type:'image_url',image_url:{url:await blobDataURL(record.blob)}});
  for(const image of record.images || []){parts.push({type:'text',text:`Bild von PDF-Seite ${image.page} aus ${record.name}`},{type:'image_url',image_url:{url:image.url}});}
 }
 return {role:message.role,content:parts};
}
function appendAttachmentCards(container,message) {
 for(const record of message.attachments || []){if(record.category==='image'){appendImageCard(container,record);continue;}const button=document.createElement('button');button.className='touch-btn source-file';button.textContent=record.name+' speichern';button.onclick=async()=>{try{const data=await getFileRecord(record.id);if(!data)throw new Error('Datei ist auf diesem Gerät nicht mehr vorhanden.');download(safeFilename(data.name,'datei'),data.blob,data.type);}catch(e){status(e.message,true);}};container.append(button);}
}
async function saveOfficeArtifact(spec,button) {
 button.disabled=true;const original=button.textContent;button.textContent='Datei wird erstellt …';
 try {
  const tools=await officeTools();let source;
  if(spec.sourceFileId){const record=await getFileRecord(spec.sourceFileId);if(!record || record.category!=='xlsx')throw new Error('Die Excel-Quelldatei ist nicht verfügbar.');source=record.blob;}
  const blob=await tools.createOfficeFile(spec,source);const suggested=safeFilename(spec.filename,`ergebnis.${spec.kind}`);const name=suggested.toLowerCase().endsWith('.'+spec.kind)?suggested:suggested+'.'+spec.kind;download(name,blob,blob.type);status(name+' wurde erzeugt.');
 }catch(e){status('Datei konnte nicht erzeugt werden: '+e.message,true);}finally{button.disabled=false;button.textContent=original;}
}
async function exportWorkspace() {
 if(busy || picking)return;
 try {
  status('Backup wird erstellt …');const ids=new Set(chats.flatMap(chat=>chat.messages.flatMap(msg=>(msg.attachments || []).map(a=>a.id))));
  const records=[];for(const id of ids){const record=await getFileRecord(id);if(record)records.push(record);else throw new Error('Eine Anhangsdatei fehlt. Bitte zuerst diesen Chat prüfen.');}
  const metadata={version:VERSION,chats,files:records.map(({blob,...record})=>record)};
  const blob=await (await officeTools()).zipBackup(metadata,records);download('ki-workspace-backup.zip',blob,'application/zip');status('Backup mit Chats und Anhangsdateien erstellt. API-Schlüssel sind nicht enthalten.');closeSidebar();
 }catch(e){status('Backup fehlgeschlagen: '+e.message,true);}
}
async function importWorkspace(event) {
 if(busy || picking)return;const file=event.target.files[0];if(!file)return;picking=true;$('btn-send').disabled=true;status('Backup wird eingelesen …');
 try {
  if(file.size>100*1024*1024)throw new Error('Das Backup ist größer als 100 MB.');
  let metadata,records=[];
  if(file.name.toLowerCase().endsWith('.json')){const value=JSON.parse(await file.text());metadata=Array.isArray(value)?{chats:[{title:'Importierter Chat',messages:value}],files:[]}:value;}
  else ({metadata,records}=await (await officeTools()).unzipBackup(file));
  if(!Array.isArray(metadata.chats) || !metadata.chats.length || metadata.chats.length>500 || metadata.chats.some(c=>!Array.isArray(c.messages)))throw new Error('Ungültiges Chat-Backup.');
  const idMap=new Map();for(const record of records){const id=crypto.randomUUID();idMap.set(record.id,id);await putFileRecord({...record,id});}
  const remapContent=content=>{if(typeof content!=='string')return content;for(const [oldId,newId] of idMap)content=content.replaceAll(oldId,newId);return content;};
  const added=metadata.chats.map(c=>({id:crypto.randomUUID(),title:String(c.title || 'Importierter Chat').slice(0,100),updated:Date.now(),messages:c.messages.filter(m=>['user','assistant'].includes(m.role)).map(m=>({...m,content:remapContent(m.content),pending:false,attachments:(m.attachments || []).map(a=>({...a,id:idMap.get(a.id) || a.id}))}))}));
  chats.unshift(...added);currentId=added[0].id;persist();renderChat();closeSidebar();status(added.length+' Chats importiert. Die vorhandenen Chats bleiben erhalten.');
 }catch(e){status('Import fehlgeschlagen: '+e.message,true);}finally{event.target.value='';picking=false;$('btn-send').disabled=busy;}
}
