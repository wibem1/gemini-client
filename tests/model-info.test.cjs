const fs=require('fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const root=require('path').resolve(__dirname,'..')+'/';
const dom=new JSDOM(fs.readFileSync(root+'index.html','utf8'),{runScripts:'outside-only',url:'https://example.test/'}),w=dom.window;
let selected,mode='chat';w.$=id=>w.document.getElementById(id);w.availableModels=()=>selected?[selected]:[];w.imageMode=()=>mode==='image';
w.eval(fs.readFileSync(root+'model-info.js','utf8')+'\nObject.assign(window,{renderModelInfo,modelInfoData});');
function render(m){selected=m;const option=w.document.createElement('option');option.value=m.id;w.$('sel-model').replaceChildren(option);w.$('sel-model').value=m.id;w.renderModelInfo();return w.$('model-info-content').textContent;}
let text=render({id:'unknown/plain',name:'Plain',inputs:['text'],outputs:['text']});assert(text.includes('Hochgeladene Bilder verwenden: Nein.'));assert(text.includes('noch kein geprüftes Kurzprofil'));assert(text.includes('keine eindeutigen Preisangaben'));assert(!text.includes('$NaN'));
text=render({id:'google/gemini-3.1-pro-preview',name:'Gemini',inputs:['text','image','audio','video'],pricing:{prompt:'0.000002',completion:'0.000012'},context_length:1048576,description:'<img src=x onerror=alert(1)>'});assert(text.includes('ansehen und besprechen: Ja.'));assert(text.includes('Audio und Video'));assert(text.includes('Eingabe: $2'));assert(text.includes('Ausgabe: $12'));assert(text.includes('Preview-Version'));assert.equal(w.$('model-info-content').querySelector('img'),null);assert.equal(w.$('model-info-title').textContent,'Gemini');
mode='image';text=render({id:'test/image',name:'Image',inputs:['text','image'],parameters:{input_references:{max:4}}});assert(text.includes('Höchstens 4 Referenzbilder'));assert(text.includes('als Vorlage übergeben: Ja.'));assert(!text.includes('ansehen und besprechen'));assert(text.includes('keine exakte Erhaltung'));assert(!text.includes('Gemini'));
text=render({id:'test/textimage',inputs:['text']});assert(text.includes('Bilder als Vorlage bearbeiten: Nein.'));
mode='chat';text=render({id:'unknown/model:batch',inputs:['text']});assert(text.includes('keinen Batch-Ablauf'));
for(const model of JSON.parse(fs.readFileSync(root+'models.json','utf8'))){text=render(model);assert(!text.includes('undefined'));assert(!text.includes('$NaN'));assert(w.$('model-info-content').querySelector('a').href.startsWith('https://openrouter.ai/'));}
selected=null;w.renderModelInfo();assert(w.$('model-info-content').textContent.includes('Wähle zuerst'));
const sw=fs.readFileSync(root+'sw.js','utf8');assert(sw.includes("'model-info.js'"));assert(fs.readFileSync(root+'index.html','utf8').includes('src="model-info.js"'));
console.log('PASS: model info across bundled catalogue; unknown/old metadata, live price formatting, mode/reference capabilities, batch guidance, safe description rendering, offline asset.');dom.window.close();
