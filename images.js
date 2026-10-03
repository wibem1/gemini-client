'use strict';
let imageCatalog=[];
const imagePreviewCache=new Map();
function imageMode(){return $('work-mode')?.value==='image';}
function availableModels(){return imageMode()?imageCatalog:modelCatalog;}
function modelPreference(){return imageMode()?'or_image_model':'or_model';}
function changeWorkMode(){if(busy)return;setStorage('or_mode',$('work-mode').value);setupDropdowns();$('web-search').disabled=imageMode();$('user-text').placeholder=imageMode()?'Bild beschreiben oder Änderung angeben …':'Nachricht eingeben …';}
async function fetchImageModels(){
 try{const r=await request('images/models',{signal:AbortSignal.timeout(20000)});const d=await r.json();if(!Array.isArray(d.data))throw new Error('Keine Bildmodelle geliefert.');imageCatalog=d.data.map(m=>({id:m.id,name:m.name,provider:m.id.split('/')[0],inputs:m.architecture?.input_modalities || ['text'],outputs:['image'],parameters:m.supported_parameters || {}}));setStorage('or_image_catalog',JSON.stringify(imageCatalog));if(imageMode()){setupDropdowns();if(!busy)status(imageCatalog.length+' Bildmodelle von OpenRouter geladen.');}}
 catch(e){if(imageMode())status('Bildmodelle konnten nicht geladen werden. '+e.message,true);}
}
async function imageBlob(url){
 if(typeof url!=='string'||!/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(url))throw new Error('OpenRouter lieferte kein unterstütztes Bildformat.');
 const comma=url.indexOf(','),mime=url.slice(5,comma).split(';')[0].toLowerCase(),data=atob(url.slice(comma+1));const bytes=new Uint8Array(data.length);for(let i=0;i<data.length;i++)bytes[i]=data.charCodeAt(i);return new Blob([bytes],{type:mime});
}
async function storeOutputImages(message,items,signal){
 const added=[];
 for(const [i,item] of items.entries()){
  const url=item.image_url?.url || item.url || (item.b64_json?'data:'+(item.media_type || 'image/png')+';base64,'+item.b64_json:'');
  if(!url)continue;
  let blob;if(/^https:\/\//i.test(url)){const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer',signal});if(!response.ok)throw new Error('Das Ergebnisbild konnte nicht gespeichert werden.');blob=await response.blob();if(!['image/png','image/jpeg','image/webp','image/gif'].includes(blob.type))throw new Error('Unbekanntes Bildformat.');}else blob=await imageBlob(url);
  const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'}[blob.type],id=crypto.randomUUID(),name='bild-'+Date.now()+'-'+(i+1)+'.'+ext;
  await putFileRecord({id,name,type:blob.type,size:blob.size,blob,category:'image',created:Date.now(),description:'Von der KI erzeugtes Bild'});added.push({id,name,category:'image',hasImages:true,generated:true});
 }
 if(added.length)message.attachments=[...(message.attachments || []),...added];return added;
}
function previewRecord(record){
 if(!imagePreviewCache.has(record.id))imagePreviewCache.set(record.id,getFileRecord(record.id).then(r=>{if(!r)throw new Error('Bild ist auf diesem Gerät nicht mehr vorhanden.');return {url:URL.createObjectURL(r.blob),blob:r.blob};}).catch(e=>{imagePreviewCache.delete(record.id);throw e;}));return imagePreviewCache.get(record.id);
}
function openImagePreview(url,name){
 const dialog=$('image-viewer');$('image-full').src=url;$('image-full').alt=name;$('image-view-title').textContent=name;dialog.showModal();
}
function appendImageCard(container,record){
 const card=document.createElement('figure');card.className='image-card';const open=document.createElement('button');open.className='image-open';open.setAttribute('aria-label',record.name+' groß anzeigen');const img=document.createElement('img');img.alt=record.name;open.append(img);const caption=document.createElement('figcaption');caption.textContent=record.name;
 const save=document.createElement('button');save.className='touch-btn';save.textContent='Bild speichern';save.onclick=async()=>{try{const data=await previewRecord(record);download(record.name,data.blob,data.blob.type);}catch(e){status(e.message,true);}};
 const reuse=document.createElement('button');reuse.className='touch-btn';reuse.textContent='Als Anhang verwenden';reuse.onclick=()=>{if(busy||picking)return;if(pendingAttachments.length>=8){status('Bis zu acht Anhänge sind möglich.',true);return;}pendingAttachments.push({...record});renderAttachments();$('user-text').focus();status('Bild ist für die nächste Nachricht angehängt.');};
 const controls=document.createElement('div');controls.className='image-actions';controls.append(save,reuse);card.append(open,caption,controls);container.append(card);previewRecord(record).then(data=>{if(card.isConnected){img.src=data.url;open.onclick=()=>openImagePreview(data.url,record.name);}}).catch(e=>{caption.textContent=e.message;});
}
async function generateImage(chat,bot,model,key,signal){
 const history=chat.messages.filter(m=>m!==bot&&!m.error&&!m.partial&&!m.pending),last=history.at(-1);if(!contentText(last?.content).trim())throw new Error('Bitte beschreibe das gewünschte Bild oder die Änderung.');
 let refs=last.attachments?.filter(a=>a.category==='image') || [];
 if(!refs.length){const previous=[...history].reverse().find(m=>m.attachments?.some(a=>a.category==='image'));refs=previous?.attachments.filter(a=>a.category==='image') || [];}
 const chosen=availableModels().find(m=>m.id===model);if(refs.length&&!chosen?.inputs.includes('image'))throw new Error('Dieses Bildmodell verarbeitet keine Referenzbilder. Bitte ein Modell mit Bildeingabe wählen.');
 const max=chosen?.parameters?.input_references?.max;if(max!==undefined&&refs.length>max)throw new Error('Dieses Modell akzeptiert höchstens '+max+' Referenzbilder.');
 const references=[];for(const ref of refs){const record=await getFileRecord(ref.id);if(!record)throw new Error('Referenzbild fehlt auf diesem Gerät.');references.push({type:'image_url',image_url:{url:await blobDataURL(record.blob)}});}
 const prompt=(getStorage('or_mem')?'Zusätzliche Angaben: '+getStorage('or_mem')+'\n\n':'')+history.map(m=>(m.role==='user'?'Auftrag: ':'Bisheriges Ergebnis: ')+contentText(m.content)).join('\n\n');
 status(refs.length?'Bild wird mit '+refs.length+' Referenzbild(ern) bearbeitet …':'Bild wird erzeugt …');
 const response=await request('images',{key,body:{model,prompt,...(chosen?.parameters?.output_format?.values?.includes('png')?{output_format:'png'}:{}),...(references.length?{input_references:references}:{})},signal});const data=await response.json();if(data.error)throw new Error(errorMessage(data.error.code,data.error.message));
 const added=await storeOutputImages(bot,data.data || [],signal);if(!added.length)throw new Error('OpenRouter lieferte kein Ergebnisbild.');bot.content='';bot.usage=data.usage;bot.model=data.model || model;
}
function enableImageInput(){
 $('user-text').addEventListener('paste',e=>{const files=[...(e.clipboardData?.files || [])].filter(f=>f.type.startsWith('image/'));if(files.length){e.preventDefault();pickAttachments({target:{files}});}});
 const area=$('chat-scroll');area.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files'))e.preventDefault();});area.addEventListener('drop',e=>{if(e.dataTransfer?.files.length){e.preventDefault();pickAttachments({target:{files:e.dataTransfer.files}});}});
}

async function prepareChatMessages(history){
 const messages=[],seenTextFiles=new Set();for(const message of history)messages.push(await messageForAPI(message,seenTextFiles));
 const last=history.at(-1);if(last?.role!=='user'||last.attachments?.some(a=>a.hasImages))return messages;
 const previous=[...history].reverse().find(m=>m.role==='assistant'&&m.attachments?.some(a=>a.generated));
 if(previous){const refs=previous.attachments.filter(a=>a.generated);const target=messages.at(-1);const parts=typeof target.content==='string'?[{type:'text',text:target.content}]:target.content;parts.push({type:'text',text:'Zuletzt im Chat erzeugtes Bild für diesen Folgeauftrag:'});for(const ref of refs){const record=await getFileRecord(ref.id);if(!record)throw new Error('Das vorherige Ergebnisbild fehlt auf diesem Gerät.');parts.push({type:'image_url',image_url:{url:await blobDataURL(record.blob)}});}target.content=parts;}
 return messages;
}

async function refreshAllModels(){await Promise.all([fetchLiveModels(),fetchImageModels()]);}
