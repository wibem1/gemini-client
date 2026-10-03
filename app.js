'use strict';
const VERSION = '1.0.0';
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
let currentAttachment=null, controller=null, busy=false, installPrompt=null;
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
  const wanted=getStorage('or_model') || $('sel-model').value;
  modelCatalog=list;
  const providers=[...new Set(list.map(m=>m.provider))].sort();
  const select=$('sel-provider');select.replaceChildren();
  for(const p of providers) { const opt=new Option(p,p); select.add(opt); }
  const model=list.find(m=>m.id===wanted);
  select.value=model?.provider || (providers.includes('google')?'google':providers[0] || '');
  filterModels(false,wanted);
}
function filterModels(userChange=false,wanted=getStorage('or_model')) {
  const select=$('sel-model');select.replaceChildren();
  for(const m of modelCatalog.filter(m=>m.provider===$('sel-provider').value).sort((a,b)=>a.name.localeCompare(b.name))) select.add(new Option(m.name,m.id));
  if([...select.options].some(o=>o.value===wanted)) select.value=wanted;
  if(userChange || !wanted) saveModelChoice();
}
function saveModelChoice() { if($('sel-model').value) setStorage('or_model',$('sel-model').value); }
async function fetchLiveModels(quiet=false) {
  try {
    const r=await request('models',{signal:AbortSignal.timeout(20000)});const d=await r.json();
    if(!Array.isArray(d.data)) throw new Error('OpenRouter hat keine Modellliste geliefert.');
    const list=d.data.filter(m=>(m.architecture?.output_modalities || ['text']).includes('text')).map(m=>({id:m.id,name:m.name || m.id,provider:m.id.split('/')[0],inputs:m.architecture?.input_modalities || ['text'],context_length:m.context_length}));
    if(!list.length) throw new Error('Keine Chatmodelle gefunden.');
    setStorage('or_catalog',JSON.stringify(list));setupDropdowns(list);
    if(!busy) status(`${list.length} Chatmodelle von OpenRouter geladen.`);
  } catch(e) {
    if(!busy) status('Modellliste konnte nicht aktualisiert werden. '+e.message+(modelCatalog.length?' Die gespeicherte Liste bleibt verfügbar.':''),true);
  }
}
async function onFilePicked(e) {
  const f=e.target.files[0];if(!f)return;
  if(f.size>8*1024*1024) { status('Bitte eine Datei mit höchstens 8 MB wählen.',true);removeFile();return; }
  const textFile=/\.(txt|md|json|jsonl|csv|tsv|html|xml|abc|ly|js|ts|py|lua|css|log|yaml|yml)$/i.test(f.name) || f.type.startsWith('text/');
  if(!f.type.startsWith('image/') && !textFile) { status('Hier werden Bilder und Textdateien unterstützt. PDF-, Audio- und Office-Dateien bitte vorher in ein passendes Format umwandeln.',true);removeFile();return; }
  $('btn-send').disabled=true;
  try {
    const data=f.type.startsWith('image/')?await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Die Datei konnte nicht gelesen werden.'));r.readAsDataURL(f);}):await f.text();
    currentAttachment={type:f.type.startsWith('image/')?'image':'text',name:f.name,data};
    $('file-name').textContent=f.name;$('file-indicator').style.display='block';
  } catch(err) { status(err.message,true); } finally { $('btn-send').disabled=busy; }
}
function removeFile() { currentAttachment=null;$('file-picker').value='';$('file-indicator').style.display='none'; }
function autoResize(el) { el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px'; }
function contentText(content) { return typeof content==='string'?content:(Array.isArray(content)?content.filter(p=>p.type==='text').map(p=>p.text).join('\n'):''); }
function renderChat(scroll=true) {
  const container=$('chat-container');container.replaceChildren();
  const chat=currentChat();
  if(!chat.messages.length) {
    const welcome=document.createElement('div');welcome.style.marginTop='8vh';
    const h=document.createElement('h2');h.textContent='Hallo, Wilhelm';
    const p=document.createElement('p');p.textContent='Wähle ein Modell und beginne den Chat.';p.className='hint';
    welcome.append(h,p);container.append(welcome);
  }
  for(const msg of chat.messages) {
    const row=document.createElement('div');row.className='msg-row '+(msg.role==='user'?'msg-user':'');
    const bubble=document.createElement('div');bubble.className=msg.role==='user'?'bubble-user':'bubble-bot';
    if(msg.error) bubble.classList.add('error');
    if(msg.role==='assistant') { const meta=document.createElement('div');meta.className='msg-meta';meta.textContent=(msg.model || 'KI')+(msg.partial?' · unterbrochen':'');bubble.append(meta); }
    const text=document.createElement('div');text.textContent=contentText(msg.content) || (msg.pending?'Antwort wird erstellt …':'');bubble.append(text);
    if(Array.isArray(msg.content)) for(const part of msg.content) if(part.type==='image_url' && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(part.image_url?.url || '')) { const img=document.createElement('img');img.src=part.image_url.url;img.alt='Angehängtes Bild';bubble.append(img); }
    row.append(bubble);container.append(row);
  }
  renderChatList();
  if(scroll) $('chat-scroll').scrollTop=$('chat-scroll').scrollHeight;
}
function renderChatList() {
  const list=$('chat-list');list.replaceChildren();
  for(const chat of chats) {
    const button=document.createElement('button');button.className='btn-side chat-item'+(chat.id===currentId?' active':'');button.textContent=chat.title;button.disabled=busy;
    button.onclick=()=>{if(busy)return;currentId=chat.id;retryAvailable=false;$('btn-retry').hidden=true;persist();renderChat();closeSidebar();};list.append(button);
  }
}
function newChat() { if(busy)return;createChat();persist();renderChat();removeFile();closeSidebar();retryAvailable=false;$('btn-retry').hidden=true; }
function clearHistory() { if(busy)return;if(!confirm('Alle gespeicherten Chats auf diesem Gerät löschen?'))return;chats=[];createChat();persist();renderChat();closeSidebar(); }
function setBusy(value) {
  busy=value;for(const id of ['btn-send','sel-provider','sel-model','file-picker']) $(id).disabled=value;
  $('btn-stop').hidden=!value;$('btn-retry').hidden=value || !retryAvailable;renderChatList();
}
function stopRequest() { controller?.abort(); }
async function consumeStream(response,onDelta) {
  if(!response.body) throw new Error('Der Browser unterstützt den Antwortstrom nicht.');
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',doneMarker=false;
  function line(value) {
    if(!value.startsWith('data:'))return;
    const data=value.slice(5).trim();if(!data)return;
    if(data==='[DONE]') { doneMarker=true;return; }
    let event;try { event=JSON.parse(data); } catch { throw new Error('OpenRouter lieferte eine ungültige Antwort.'); }
    if(event.error) throw new Error(errorMessage(event.error.code,event.error.message));
    const choice=event.choices?.[0];
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
  if(busy)return;
  const key=getStorage('or_key'),model=$('sel-model').value;
  if(!key) { openModal();status('Bitte den OpenRouter-Schlüssel in den Einstellungen speichern.',true);return; }
  if(!model) { status('Bitte zuerst die Modellliste laden.',true);return; }
  const chat=currentChat();
  if(chat.messages.some(m=>!m.error && Array.isArray(m.content) && m.content.some(p=>p.type==='image_url')) && !modelCatalog.find(m=>m.id===model)?.inputs?.includes('image')) { status('Dieser Chat enthält Bilder. Bitte ein Modell mit Bildunterstützung wählen oder einen neuen Chat beginnen.',true);return; }
  if(!retry) {
    const text=$('user-text').value.trim();if(!text && !currentAttachment)return;
    if(currentAttachment?.type==='image' && !modelCatalog.find(m=>m.id===model)?.inputs?.includes('image')) { status('Dieses Modell kann keine Bilder lesen. Bitte ein Modell mit Bildunterstützung wählen.',true);return; }
    let content=text;
    if(currentAttachment?.type==='text')content=`[Datei: ${currentAttachment.name}]\n${currentAttachment.data}\n\n${text}`;
    if(currentAttachment?.type==='image')content=[{type:'text',text:text || 'Bitte betrachte dieses Bild.'},{type:'image_url',image_url:{url:currentAttachment.data}}];
    chat.messages.push({role:'user',content});
    if(chat.messages.length===1)chat.title=(text || currentAttachment?.name || 'Chat').slice(0,70);
    $('user-text').value='';autoResize($('user-text'));removeFile();
  } else {
    const last=chat.messages.at(-1);if(!last || !(last.error || last.partial))return;
    chat.messages.pop();
  }
  // Only complete conversational messages are sent. UI error messages never become AI context.
  const messages=chat.messages.filter(m=>!m.error && !m.partial && !m.pending).map(m=>({role:m.role,content:m.content}));
  const mem=getStorage('or_mem').trim();if(mem)messages.unshift({role:'system',content:mem});
  const bot={role:'assistant',content:'',model,pending:true};chat.messages.push(bot);chat.updated=Date.now();
  controller=new AbortController();retryAvailable=false;setBusy(true);renderChat();persist();status('Antwort wird erstellt …');
  // A timeout aborts this request once; no automatic paid retries.
  const timeout=setTimeout(()=>controller?.abort('timeout'),300000);
  try {
    const response=await request('chat/completions',{key,body:{model,messages,stream:true},signal:controller.signal});
    if(response.headers.get('content-type')?.includes('text/event-stream')) {
      await consumeStream(response,(delta,actualModel)=>{bot.content+=delta;if(actualModel)bot.model=actualModel;renderChat();});
    } else {
      const data=await response.json();if(data.error)throw new Error(errorMessage(data.error.code,data.error.message));
      bot.content=contentText(data.choices?.[0]?.message?.content);bot.model=data.model || model;
    }
    if(!bot.content)throw new Error('OpenRouter lieferte keine Textantwort. Bitte ein anderes Chatmodell wählen.');
    status('Antwort vollständig.');
  } catch(e) {
    const aborted=controller.signal.aborted;
    const detail=aborted?(controller.signal.reason==='timeout'?'Zeitlimit von fünf Minuten erreicht.':'Anfrage gestoppt.'):e.message;
    if(bot.content) { bot.partial=true;status(detail+' Die bisherige Antwort bleibt erhalten.',true); }
    else { bot.error=true;bot.content=detail;status(detail,true); }
    retryAvailable=true;
  } finally {
    clearTimeout(timeout);bot.pending=false;controller=null;persist();setBusy(false);renderChat();
  }
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
renderChat();persist();
(async()=>{
  if(!modelCatalog.length)try { const r=await fetch('models.json');if(!r.ok)throw new Error();setupDropdowns(await r.json()); } catch { status('Keine Modellliste verfügbar. Bitte Internetverbindung prüfen.',true); }
  else setupDropdowns(modelCatalog);
  await fetchLiveModels(true);
})();
if('serviceWorker' in navigator && location.protocol!=='file:')navigator.serviceWorker.register('sw.js').catch(e=>status('Die Offline-Funktion konnte nicht aktiviert werden: '+e.message,true));
