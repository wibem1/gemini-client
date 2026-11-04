const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('zoom.js', 'utf8');
const elements = Object.fromEntries(['zoom-reset','zoom-in','zoom-out'].map(id => [id, { textContent:'',disabled:false }]));
const store = new Map([['ki_workspace_ui_zoom','130']]);
const context = {
  window: {innerHeight:1080,innerWidth:810,visualViewport:{height:1080,addEventListener(){}},addEventListener(){}},
  document: { documentElement: { style:{setProperty(key,value){this[key]=value;} } }, getElementById: id => elements[id] },
  localStorage: { getItem: key => store.get(key), setItem:(key,value)=>store.set(key,value) }
};
vm.createContext(context);
vm.runInContext(source,context);

assert.equal(context.document.documentElement.style['--ui-zoom'],'1.3');
assert.equal(elements['zoom-reset'].textContent,'130 %');
vm.runInContext('changeUiZoom(10)',context);

vm.runInContext('setUiZoom(999)',context);

assert.equal(context.document.documentElement.style['--ui-zoom'],'1.5');
assert.equal(elements['zoom-in'].disabled,true);
vm.runInContext('setUiZoom(-10)',context);

assert.equal(elements['zoom-out'].disabled,true);
vm.runInContext('setUiZoom(100)',context);
assert.equal(store.get('ki_workspace_ui_zoom'),'100');
assert.equal(elements['zoom-reset'].textContent,'100 %');
console.log('UI zoom logic: OK');

// Regression: scaling the page must also compensate the viewport-sized shell.
const html = fs.readFileSync('index.html', 'utf8');
assert.match(html, /--ui-zoom:\s*1;/);
assert.match(html, /zoom:\s*var\(--ui-zoom\)/);
assert.equal(context.document.documentElement.style['--app-height'],'1080px');
context.window.visualViewport.height=600;
vm.runInContext('setUiZoom(150)',context);
assert.equal(context.document.documentElement.style['--app-height'],'400px');
assert.equal(context.document.documentElement.style['--app-width'],'540px');
assert.match(html, /#chat-scroll\s*\{[^}]*min-height:\s*0;/s);
