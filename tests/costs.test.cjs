const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const root=require('path').resolve(__dirname,'..')+'/';
const current=fs.readFileSync(root+'files.js','utf8');
function promptLength(source){const c=vm.createContext({TextEncoder});vm.runInContext(source+'\nthis.prompt=FILE_CAPABILITIES+WORKSPACE_CAPABILITIES;',c);return c.prompt.length;}
const before=3733,after=promptLength(current);assert(after<before*.7);console.log(`PASS: file instructions ${before} -> ${after} characters (${Math.round((1-after/before)*100)}% reduction).`);
const settings={or_cache:'1'},c=vm.createContext({getStorage:key=>settings[key]||'',contentText:content=>typeof content==='string'?content:content.filter(p=>p.type==='text').map(p=>p.text).join('\n')});const app=fs.readFileSync(root+'app.js','utf8');vm.runInContext(app.slice(app.indexOf('\nfunction formatUsage'))+'\nthis.usage=formatUsage;this.cache=applyPromptCaching;',c);
const short=[{role:'system',content:'Format'},{role:'user',content:'Frage'}];assert.equal(c.cache(short,'anthropic/claude'),false);
const make=()=>[{role:'system',content:'Format'},{role:'user',content:'original '.repeat(3000)},{role:'assistant',content:'Analyse'},{role:'user',content:'Folgefrage'}];
let msgs=make(),beforeContent=msgs.map(m=>c.contentText(m.content));assert.equal(c.cache(msgs,'anthropic/claude'),true);assert.equal(msgs[2].content[0].cache_control.type,'ephemeral');assert.deepEqual(msgs.map(m=>c.contentText(m.content)),beforeContent);assert.equal(msgs.at(-1).content,'Folgefrage');assert.equal(msgs.length,4);
msgs=make();assert.equal(c.cache(msgs,'openai/model'),false);settings.or_cache='0';assert.equal(c.cache(make(),'anthropic/claude'),false);
const text=c.usage({prompt_tokens:10000,completion_tokens:4599,total_tokens:14599,completion_tokens_details:{reasoning_tokens:3000},prompt_tokens_details:{cached_tokens:8000,cache_write_tokens:500},cost:.32263});for(const part of ['Eingabe: 10.000','Ausgabe: 4.599','davon Denken: 3.000','davon Cache gelesen: 8.000','Cache neu geschrieben: 500','$0.32263'])assert(text.includes(part),part);assert(!c.usage({total_tokens:9,cost:0}).includes('Denken'));assert(c.usage({total_tokens:9,cost:0}).includes('Gesamt: 9'));
console.log('PASS: opt-in Claude cache, small-prompt exclusion, complete history retained, other models untouched; usage details without inventing missing counters.');
