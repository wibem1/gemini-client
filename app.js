'use strict';
const VERSION = '2.2.1';
const $ = id => document.getElementById(id);
const fallbackStore = {};
let storageWarning = false;
function setStorage(k,v) {
  fallbackStore[k] = v;
  try { localStorage.setItem(k,v); } catch { storageWarning = true; status('Speichern auf diesem Gerät fehlgeschlagen. Bitte den Chat exportieren.',true); }
}
function getStorage(k) {
  if (Object.hasOwn(fallbackStore,k)) return fallbackStore[k];
  try { return localStorage.getItem(k) || ''; } catch { return ''; }
}
function readJSON(key, fallback) { try { return JSON.parse(getStorage(key)) ?? fallback; } catch { return fallback; } }
function status(text,error=false) { $('status').textContent=text; $('status').classList.toggle('error',error); }
let modelCatalog = readJSON('or_catalog',[]);
if (!Array.isArray(modelCatalog)) modelCatalog=[];
let chats = readJSON('or_chats',[]);
if (!Array.isArray(chats)) chats=[];
chats=chats.filter(c=>c && typeof c.id==='string' && Array.isArray(c.messages));
let currentId=getStorage('or_current');
let controller=null, busy=false, installPrompt=null;
let retryAvailable=false;
function currentChat() { return chats.find(c=>c.id===currentId); }
function createChat() { const c={id:crypto.randomUUID(), title:'Neuer Chat', messages:[],updated:Date.now()}; chats.unshift(c);currentId=c.id;return c; }
if (!currentChat()) createChat();
function persist() { setStorage('or_chats',JSON.stringify(chats));setStorage('or_current',currentId); }
function openSidebar() { $('sidebar').classList.add('open');$('side-backdrop').classList.add('open'); }
function closeSidebar() { $('sidebar').classList.remove('open');$('side-backdrop').classList.remove('open'); }
function openModal() {
  $('input-key').value=getStorage('or_key');$('input-mem').value=getStorage('or_mem');
  $('key-result').textContent='';$('settings-modal').style.display='flex';$('input-key').focus();
}
function cancelModal() { $('settings-modal').style.display='none'; }
function closeModal() { setStorage('or_key',$('input-key').value.trim());setStorage('or_mem',$('input-mem').value.trim());cancelModal(); }
function errorMessage(code,message) {
  const explanations={401:'Der OpenRouter-Schlüssel ist ungültig oder wurde widerrufen.',402:'Das OpenRouter-Guthaben oder das Limit dieses Schlüssels reicht nicht aus.',403:'OpenRouter verweigert diese Anfrage. Prüfe die Freigaben des Schlüssels und die Nutzungsbedingungen des gewählten Modells.',404:'Das gewählte Modell ist nicht mehr verfügbar. Bitte die Modellliste aktualisieren.',429:'Das Anfragelimit ist erreicht. Bitte später erneut versuchen.',503:'Für dieses Modell ist derzeit kein Anbieter verfügbar.'};
  return [code ? `HTTP ${code}` : '',explanations[code] || '', message || 'Unbekannter Fehler'].filter(Boolean).join(' · ');
}
async function request(path,{key,body,signal}={}) {
  let response;
  try {
    response=await fetch('https://openrouter.ai/api/v1/'+path,{
      method:body?'POST':'GET', headers:{...(key?{Authorization:'Bearer '+key}:{}),...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),signal,cache:'no-store'
    });
  } catch(e) {
    if(e.name==='AbortError') throw e;
    throw new Error('OpenRouter ist nicht erreichbar. Prüfe Internetverbindung, Netzwerkfilter und Browserzugriff. '+e.message);
  }
  if(!response.ok) {
    const error=await response.json().catch(()=>({}));
    throw new Error(errorMessage(response.status,error.error?.message || response.statusText));
  }
  return response;
}
async function testConnection() {
  const key=$('input-key').value.trim();
  if(!key) { $('key-result').textContent='Bitte einen OpenRouter-Schlüssel eintragen.';return; }
  $('key-result').textContent='Verbindung wird geprüft …';
  try {
    const r=await request('key',{key,signal:AbortSignal.timeout(20000)});const d=await r.json();
    if(d.error) throw new Error(errorMessage(d.error.code,d.error.message));
    $('key-result').textContent='Verbindung erfolgreich. OpenRouter akzeptiert den Schlüssel. Eine Modellantwort wurde dabei nicht angefordert.';
  } catch(e) { $('key-result').textContent=e.name==='TimeoutError'?'Zeitüberschreitung beim Verbindungsaufbau.':e.message; }
}
function setupDropdowns(list) {
  if(list)modelCatalog=list;
  list=availableModels();
  const wanted=getStorage(modelPreference());
  const providers=[...new Set(list.map(m=>m.provider))].sort();
  const select=$('sel-provider');select.replaceChildren();
  for(const p of providers) { const opt=new Option(p,p); select.add(opt); }
  const model=list.find(m=>m.id===wanted);
  select.value=model?.provider || (providers.includes('google')?'google':providers[0] || '');
  filterModels(false,wanted);
}
function filterModels(userChange=false,wanted=getStorage(modelPreference())) {
  const select=$('sel-model');select.replaceChildren();
  for(const m of availableModels().filter(m=>m.provider===$('sel-provider').value).sort((a,b)=>a.name.localeCompare(b.name))) select.add(new Option(m.name+(m.inputs?.includes('image')?' · Bildeingabe':''),m.id));
  if([...select.options].some(o=>o.value===wanted)) select.value=wanted;
  if(userChange || !wanted) saveModelChoice();
  updateModelDetails();
}
function saveModelChoice() { if($('sel-model').value) setStorage(modelPreference(),$('sel-model').value);updateModelDetails(); }
async function fetchLiveModels(quiet=false) {
  try {
    const r=await request('models',{signal:AbortSignal.timeout(20000)});const d=await r.json();
    if(!Array.isArray(d.data)) throw new Error('OpenRouter hat keine Modellliste geliefert.');
    const list=d.data.filter(m=>(m.architecture?.output_modalities || ['text']).includes('text')).map(m=>({id:m.id,name:m.name || m.id,provider:m.id.split('/')[0],inputs:m.architecture?.input_modalities || ['text'],outputs:m.architecture?.output_modalities || ['text'],context_length:m.context_length,pricing:m.pricing}));
    if(!list.length) throw new Error('Keine Chatmodelle gefunden.');
    setStorage('or_catalog',JSON.stringify(list));setupDropdowns(list);
    if(!busy && !imageMode()) status(`${list.length} Chatmodelle von OpenRouter geladen.`);
  } catch(e) {
    if(!busy) status('Modellliste konnte nicht aktualisiert werden. '+e.message+(modelCatalog.length?' Die gespeicherte Liste bleibt verfügbar.':''),true);
  }
}
async function onFilePicked(e) { await pickAttachments(e); }
function removeFile() { clearPendingAttachments(); }

function autoResize(el) { el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';setStorage('or_draft',el.value); }
function contentText(content) { return typeof content==='string'?content:(Array.isArray(content)?content.filter(p=>p.type==='text').map(p=>p.text).join('\n'):''); }
function renderChat(scroll=true) {
  const container=$('chat-container');container.replaceChildren();
  const chat=currentChat();
  if(!chat.messages.length) {
    const welcome=document.createElement('div');welcome.style.marginTop='8vh';
    const h=document.createElement('h2');h.textContent='Hallo, Wilhelm';
    const p=document.createElement('p');p.textContent='Stelle eine Frage oder hänge Dateien an. Du kannst Dokumente, Tabellen und Musik bearbeiten und fertige Dateien speichern.';p.className='hint';
    welcome.append(h,p);container.append(welcome);
  }
  for(const msg of chat.messages) {
    const row=document.createElement('div');row.className='msg-row '+(msg.role==='user'?'msg-user':'');
    const bubble=document.createElement('div');bubble.className=msg.role==='user'?'bubble-user':'bubble-bot';
    if(msg.error) bubble.classList.add('error');
    if(msg.role==='assistant') { const meta=document.createElement('div');meta.className='msg-meta';meta.textContent=(msg.model || 'KI')+(msg.partial?' · unterbrochen':'');bubble.append(meta); }
    const text=document.createElement('div');if(msg.role==='assistant' && !msg.error && msg.content)renderAssistant(text,msg);else text.textContent=contentText(msg.content) || (msg.pending?'Antwort wird erstellt …':'');bubble.append(text);
    if(Array.isArray(msg.content)) for(const part of msg.content) if(part.type==='image_url' && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(part.image_url?.url || '')) { const img=document.createElement('img');img.src=part.image_url.url;img.alt='Angehängtes Bild';bubble.append(img); }
    appendAttachmentCards(bubble,msg);
    if(msg.role==='assistant')appendSources(bubble,msg);
    row.append(bubble);container.append(row);
  }
  renderChatList();
  if(scroll) $('chat-scroll').scrollTop=$('chat-scroll').scrollHeight;
}
function renderChatList() {
  const list=$('chat-list');list.replaceChildren();const query=($('chat-search')?.value || '').trim().toLowerCase();
  for(const chat of chats) {
    if(query && !chat.title.toLowerCase().includes(query) && !chat.messages.some(m=>contentText(m.content).toLowerCase().includes(query)))continue;
    const row=document.createElement('div');row.className='chat-list-row';
    const button=document.createElement('button');button.className='btn-side chat-item'+(chat.id===currentId?' active':'');button.textContent=chat.title;button.disabled=busy;
    button.onclick=()=>{if(busy || picking)return;currentId=chat.id;retryAvailable=false;$('btn-retry').hidden=true;persist();renderChat();closeSidebar();};
    const del=document.createElement('button');del.className='delete-chat';del.textContent='×';del.setAttribute('aria-label',chat.title+' löschen');del.disabled=busy;
    del.onclick=()=>{if(busy || picking || !confirm('Diesen Chat löschen?'))return;chats=chats.filter(c=>c.id!==chat.id);if(!currentChat()){currentId=chats[0]?.id;if(!currentChat())createChat();}persist();renderChat();};
    row.append(button,del);list.append(row);
  }
}
function newChat() { if(busy || picking)return;createChat();persist();renderChat();removeFile();$('user-text').value='';autoResize($('user-text'));closeSidebar();retryAvailable=false;$('btn-retry').hidden=true; }
function clearHistory() { if(busy || picking)return;if(!confirm('Alle gespeicherten Chats und Anhangsdateien auf diesem Gerät löschen?'))return;chats=[];createChat();persist();renderChat();removeFile();fileOperation('readwrite',store=>store.clear()).catch(e=>status(e.message,true));closeSidebar(); }
function updateModelDetails() {
  const model=availableModels().find(m=>m.id===$('sel-model').value);if(!model)return;
  const detail=[model.inputs?.includes('image')?'Eingabe: Text und Bilder':'Eingabe: Text',imageMode()?'Ausgabe: Bilder':'Ausgabe: Text'];
  if(model.context_length)detail.push('Kontext: '+Number(model.context_length).toLocaleString('de-DE')+' Tokens');
  if(model.pricing?.prompt!==undefined && model.pricing?.completion!==undefined){const input=Number(model.pricing.prompt)*1e6,output=Number(model.pricing.completion)*1e6;if(Number.isFinite(input)&&Number.isFinite(output))detail.push(`pro 1 Mio. Tokens: $${input.toFixed(2)} Eingabe / $${output.toFixed(2)} Ausgabe`);}
  $('model-details').textContent=detail.join(' · ');
}
function appendSources(container,msg) {
 const citations=(msg.annotations || []).map(a=>a.url_citation).filter(c=>c && /^https?:\/\//i.test(c.url || ''));
 if(citations.length){const sources=document.createElement('div');sources.className='sources';const title=document.createElement('strong');title.textContent='Quellen';sources.append(title);for(const citation of [...new Map(citations.map(c=>[c.url,c])).values()]){const a=document.createElement('a');a.href=citation.url;a.textContent=citation.title || citation.url;a.target='_blank';a.rel='noopener noreferrer';sources.append(a);}container.append(sources);}
 if(msg.usage){const info=document.createElement('div');info.className='msg-meta';const parts=[];if(msg.usage.total_tokens)parts.push(Number(msg.usage.total_tokens).toLocaleString('de-DE')+' Tokens');if(typeof msg.usage.cost==='number')parts.push('$'+msg.usage.cost.toFixed(5));info.textContent=parts.join(' · ');container.append(info);}
}
function setBusy(value) {
  busy=value;for(const id of ['btn-send','sel-provider','sel-model','file-picker','work-mode']) $(id).disabled=value;
  $('btn-stop').hidden=!value;$('btn-retry').hidden=value || !retryAvailable;renderChatList();
}
function stopRequest() { controller?.abort(); }
function startRequestProgress() {
  const started=Date.now(),element=$('request-progress');element.hidden=false;
  function update(){const seconds=Math.floor((Date.now()-started)/1000),minutes=Math.floor(seconds/60);element.textContent='Laufzeit: '+minutes+':'+String(seconds%60).padStart(2,'0')+' · Abbrechen mit „Stoppen“.';}
  update();const interval=setInterval(update,1000);
  return ()=>{clearInterval(interval);element.hidden=true;element.textContent='';};
}
async function consumeStream(response,onDelta,onMeta=()=>{}) {
  if(!response.body) throw new Error('Der Browser unterstützt den Antwortstrom nicht.');
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',doneMarker=false;
  function line(value) {
    if(!value.startsWith('data:'))return;
    const data=value.slice(5).trim();if(!data)return;
    if(data==='[DONE]') { doneMarker=true;return; }
    let event;try { event=JSON.parse(data); } catch { throw new Error('OpenRouter lieferte eine ungültige Antwort.'); }
    if(event.error) throw new Error(errorMessage(event.error.code,event.error.message));
    onMeta(event);
    const choice=event.choices?.[0];
    if(choice?.finish_reason==='length')throw new Error('Das Modell hat die Antwort wegen seiner Längenbegrenzung abgebrochen.');
    if(choice?.finish_reason==='error') throw new Error('OpenRouter hat die Generierung mit einem Fehler beendet.');
    if(typeof choice?.delta?.content==='string')onDelta(choice.delta.content,event.model);
  }
  try {
    while(true) {
      const {value,done}=await reader.read();buffer+=decoder.decode(value || new Uint8Array(),{stream:!done});
      const lines=buffer.split('\n');buffer=lines.pop();for(const l of lines)line(l.replace(/\r$/,''));
      if(done)break;
    }
    if(buffer.trim())line(buffer.trim());
    if(!doneMarker)throw new Error('Die Verbindung wurde vor dem Ende der Antwort geschlossen.');
  } finally { reader.releaseLock(); }
}
async function sendMessage(retry=false) {
  if(busy || picking)return;
  const key=getStorage('or_key'),model=$('sel-model').value;
  if(!key) { openModal();status('Bitte den OpenRouter-Schlüssel in den Einstellungen speichern.',true);return; }
  if(!model) { status('Bitte zuerst die Modellliste laden.',true);return; }
  const chat=currentChat();
  const imageHistory=chat.messages.some(m=>!m.error && ((Array.isArray(m.content) && m.content.some(p=>p.type==='image_url')) || m.attachments?.some(a=>a.hasImages)));
  if(!imageMode() && (imageHistory || pendingAttachments.some(a=>a.hasImages)) && !modelCatalog.find(m=>m.id===model)?.inputs?.includes('image')) { status('Dieser Auftrag enthält Bilder oder eingescannte PDF-Seiten. Bitte ein Modell mit Bildunterstützung wählen.',true);return; }
  if(imageMode() && pendingAttachments.some(a=>a.category!=='image')){status('Für die Bilderzeugung bitte Bilder als Referenz anhängen. Dokumente können im Chat besprochen werden.',true);return;}
  if(!retry) {
    const text=$('user-text').value.trim();if(!text && !pendingAttachments.length)return;
    const attachments=pendingAttachments.map(a=>({...a}));
    chat.messages.push({role:'user',content:text,attachments});
    if(chat.messages.length===1)chat.title=(text || attachments[0]?.name || 'Chat').slice(0,70);
    $('user-text').value='';autoResize($('user-text'));removeFile();
  } else {
    const last=chat.messages.at(-1);if(!last || !(last.error || last.partial))return;chat.messages.pop();
  }
  const bot={id:crypto.randomUUID(),role:'assistant',content:'',model,pending:true};chat.messages.push(bot);chat.updated=Date.now();
  controller=new AbortController();retryAvailable=false;setBusy(true);renderChat();persist();status('Dateien und Auftrag werden vorbereitet …');
  const finishProgress=startRequestProgress();
  try {
    if(imageMode()){await generateImage(chat,bot,model,key,controller.signal);status('Bild fertig. Du kannst es speichern oder weiter bearbeiten.');return;}
    const history=chat.messages.filter(m=>!m.error && !m.partial && !m.pending);
    const messages=await prepareChatMessages(history);
    if(controller.signal.aborted)throw new DOMException('Abgebrochen','AbortError');
    const textLength=messages.reduce((sum,m)=>sum+contentText(m.content).length,0);const context=modelCatalog.find(m=>m.id===model)?.context_length;
    if(context && textLength>context*3)throw new Error('Dieser Chat mit seinen Dateien ist für den Kontext des Modells zu groß. Bitte ein Modell mit größerem Kontext oder einen neuen Chat mit einem Ausschnitt verwenden. Es wurde nichts gekürzt.');
    const mem=getStorage('or_mem').trim();messages.unshift({role:'system',content:FILE_CAPABILITIES+'\n'+WORKSPACE_CAPABILITIES+(mem?'\n\nZusätzliche Angaben des Nutzers:\n'+mem:'')});
    const web=$('web-search').checked;status(web?'Websuche und Antwort werden angefordert …':'Antwort wird erstellt …');
    const response=await request('chat/completions',{key,body:{model,messages,stream:true,stream_options:{include_usage:true},plugins:web?[{id:'web',max_results:3}]:[{id:'web',enabled:false}]},signal:controller.signal});
    if(response.headers.get('content-type')?.includes('text/event-stream')) {
      await consumeStream(response,(delta,actualModel)=>{bot.content+=delta;if(actualModel)bot.model=actualModel;renderChat();},event=>{if(event.usage)bot.usage=event.usage;const annotations=event.choices?.[0]?.delta?.annotations || event.choices?.[0]?.message?.annotations;if(annotations)bot.annotations=[...(bot.annotations || []),...annotations];});
    } else {
      const data=await response.json();if(data.error)throw new Error(errorMessage(data.error.code,data.error.message));
      bot.content=contentText(data.choices?.[0]?.message?.content);bot.model=data.model || model;bot.usage=data.usage;bot.annotations=data.choices?.[0]?.message?.annotations;await storeOutputImages(bot,data.choices?.[0]?.message?.images || []);if(data.choices?.[0]?.finish_reason==='length')throw new Error('Das Modell hat die Antwort wegen seiner Längenbegrenzung abgebrochen.');
    }
    if(!bot.content && !bot.attachments?.length)throw new Error('OpenRouter lieferte keine Textantwort. Bitte ein anderes Chatmodell wählen.');
    status('Antwort vollständig.');
  } catch(e) {
    const aborted=controller.signal.aborted;
    const detail=aborted?'Anfrage von dir gestoppt.':e.message;
    if(bot.content || bot.attachments?.length) { bot.partial=true;status(detail+' Die bisherige Antwort bleibt erhalten.',true); }
    else { bot.error=true;bot.content=detail;status(detail,true); }
    retryAvailable=true;
  } finally { finishProgress();bot.pending=false;controller=null;persist();setBusy(false);renderChat(); }
}
function retryMessage() { if(retryAvailable)sendMessage(true); }
function download(name,data,type) { const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function exportMarkdown() {
  const c=currentChat();if(!c.messages.length){status('Dieser Chat ist leer.');return;}
  download('chat.md',`# ${c.title}\n\n`+c.messages.map(m=>`## ${m.role==='user'?'Wilhelm':m.model || 'KI'}\n\n${contentText(m.content)}\n`).join('\n'),'text/markdown');closeSidebar();
}
function exportJson() { download('chats.json',JSON.stringify({version:VERSION,chats},null,2),'application/json');closeSidebar(); }
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
async function installApp() {
  if(installPrompt) { await installPrompt.prompt();installPrompt=null; }
  else status('Android / Computer: Im Browsermenü „App installieren“. iPad / iPhone: In Safari „Teilen“ und „Zum Home-Bildschirm“. Danach startet die App über ihr Icon ohne Browserleiste.');
  closeSidebar();
}
$('user-text').addEventListener('keydown',e=>{if(e.key==='Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer:fine)').matches){e.preventDefault();sendMessage();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){cancelModal();closeSidebar();}});
window.addEventListener('pagehide',persist);
// Recover an interrupted session without sending the incomplete answer back to the model.
for(const chat of chats)for(const m of chat.messages)if(m.pending){m.pending=false;if(m.content)m.partial=true;else{m.error=true;m.content='Die vorherige Anfrage wurde beim Schließen unterbrochen.';}}
imageCatalog=readJSON('or_image_catalog',[]);if(!Array.isArray(imageCatalog))imageCatalog=[];
$('work-mode').value=getStorage('or_mode')==='image'?'image':'chat';
$('web-search').checked=getStorage('or_web')==='1';$('web-search').disabled=imageMode();enableImageInput();
$('user-text').value=getStorage('or_draft');autoResize($('user-text'));
pendingAttachments=readJSON('or_pending',[]);if(!Array.isArray(pendingAttachments))pendingAttachments=[];renderAttachments();
renderChat();persist();
(async()=>{
  if(!modelCatalog.length)try { const r=await fetch('models.json');if(!r.ok)throw new Error();setupDropdowns(await r.json()); } catch { status('Keine Modellliste verfügbar. Bitte Internetverbindung prüfen.',true); }
  else setupDropdowns(modelCatalog);
  await Promise.all([fetchLiveModels(true),fetchImageModels()]);
})();
if('serviceWorker' in navigator && location.protocol!=='file:')navigator.serviceWorker.register('sw.js').catch(e=>status('Die Offline-Funktion konnte nicht aktiviert werden: '+e.message,true));
