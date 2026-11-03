const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const app=fs.readFileSync(require('path').join(__dirname,'../app.js'),'utf8');
const settings={};const ctx=vm.createContext({TextDecoder,ReadableStream,Response,errorMessage:(_,m)=>m,getStorage:k=>settings[k]||'',modelCatalog:[{id:'test',max_output_tokens:20000}]});
vm.runInContext(app.slice(app.indexOf('async function consumeStream('),app.indexOf('async function sendMessage('))+app.slice(app.indexOf('\nfunction outputOptions(')),ctx);
(async()=>{
 let text='',usage=null;
 const events=[{id:'gen-test',choices:[{delta:{content:'<score-partwise>'},finish_reason:'length'}]},{choices:[],usage:{completion_tokens:8192,completion_tokens_details:{reasoning_tokens:8000},cost:.08}}];
 const wire=events.map(e=>'data: '+JSON.stringify(e)+'\n\n').join('')+'data: [DONE]\n\n';
 // Break across arbitrary byte boundaries, including within JSON and SSE framing.
 const bytes=new TextEncoder().encode(wire);let offset=0;
 const response=new Response(new ReadableStream({pull(c){if(offset>=bytes.length){c.close();return;}c.enqueue(bytes.slice(offset,offset+=11));}}));
 await assert.rejects(ctx.consumeStream(response,d=>text+=d,e=>{if(e.usage)usage=e.usage}),/Ausgabelimit/);
 assert.equal(text,'<score-partwise>');assert.equal(usage.completion_tokens,8192);assert.equal(usage.cost,.08);
 settings.or_output_limit='auto';assert.equal(Object.keys(ctx.outputOptions('test')).length,0);
 settings.or_output_limit='32768';assert.equal(ctx.outputOptions('test').max_tokens,20000);assert.equal(ctx.outputOptions('unknown').max_tokens,32768);
 settings.or_output_limit='-1';assert.equal(Object.keys(ctx.outputOptions('test')).length,0);
 let normal='';await ctx.consumeStream(new Response('data: '+JSON.stringify({choices:[{delta:{content:'OK'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'),d=>normal+=d);assert.equal(normal,'OK');
 console.log('PASS: final text plus late usage survive length finish; normal SSE and explicit output limits.');
})().catch(e=>{console.error(e);process.exitCode=1;});
