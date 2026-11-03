const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('zoom.js', 'utf8');
const elements = Object.fromEntries(['zoom-reset','zoom-in','zoom-out'].map(id => [id, { textContent:'',disabled:false }]));
const store = new Map([['ki_workspace_ui_zoom','130']]);
const context = {
  document: { documentElement: { style:{} }, getElementById: id => elements[id] },
  localStorage: { getItem: key => store.get(key), setItem:(key,value)=>store.set(key,value) }
};
vm.createContext(context);
vm.runInContext(source,context);
assert.equal(context.document.documentElement.style.zoom,'1.3');
assert.equal(elements['zoom-reset'].textContent,'130 %');
vm.runInContext('changeUiZoom(10)',context);
assert.equal(context.document.documentElement.style.zoom,'1.4');
vm.runInContext('setUiZoom(999)',context);
assert.equal(context.document.documentElement.style.zoom,'1.5');
assert.equal(elements['zoom-in'].disabled,true);
vm.runInContext('setUiZoom(-10)',context);
assert.equal(context.document.documentElement.style.zoom,'0.7');
assert.equal(elements['zoom-out'].disabled,true);
vm.runInContext('setUiZoom(100)',context);
assert.equal(store.get('ki_workspace_ui_zoom'),'100');
assert.equal(elements['zoom-reset'].textContent,'100 %');
console.log('UI zoom logic: OK');
