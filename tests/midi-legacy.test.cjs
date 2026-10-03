const vm=require('vm'),fs=require('fs'),assert=require('node:assert/strict'),{parseMidi}=require('midi-file');
const dir=require('path').resolve(__dirname,'..')+'/';
const c=vm.createContext({setTimeout,clearTimeout,console,TextEncoder,TextDecoder,Date,performance});c.self=c;c.importScripts=(...names)=>{for(const name of names)vm.runInContext(fs.readFileSync(dir+name,'utf8'),c);};
vm.runInContext(fs.readFileSync(dir+'midi-worker.js','utf8'),c);vm.runInContext(fs.readFileSync(dir+'files.js','utf8')+'\nthis.encodeScore=buildMidi;',c);
function run(code){return new Promise(resolve=>{c.postMessage=resolve;c.onmessage({data:{code}});});}
(async()=>{
const code=`from midiutil import MIDIFile
TEMPO = 72
midi = MIDIFile(2)
for track in (0, 1):
    midi.addTempo(track, 0, TEMPO)
    midi.addProgramChange(track, 0, 0, 0)
midi.addTrackName(0, 0, "Rechte Hand")
midi.addTrackName(1, 0, "Linke Hand")
chords = [[57,60,64],[53,57,60],[48,52,55],[55,59,62]]
for bar in range(16):
    chord=chords[bar % 4]
    for i in range(8):
        midi.addNote(1,0,chord[i % 3]-12,bar*4+i*0.5,0.5,60)
    midi.addNote(0,0,72+bar%5,bar*4,4,80)
with open("nocturne.mid","wb") as f:
    midi.writeFile(f)`;
let r=await run(code);assert(!r.error,r.error);assert.equal(r.files[0].filename,'nocturne.mid');const m=parseMidi(c.encodeScore(r.files[0]));assert.equal(m.tracks.length,3);assert.equal(m.tracks[0].filter(e=>e.type==='setTempo').length,1);assert.equal(m.tracks[0].find(e=>e.type==='setTempo').microsecondsPerBeat,833333);assert.equal(m.tracks.flat().filter(e=>e.type==='noteOn').length,144);for(const track of m.tracks.slice(1)){assert.equal(track.reduce((n,e)=>n+e.deltaTime,0),64*480);assert(track.find(e=>e.type==='programChange'));}
r=await run('from midiutil import MIDIFile\nm=MIDIFile(1)\nm.addTempo(0,0,60)\nm.addTempo(0,2,120)\nm.addProgramChange(0,1,0,40)\nm.addControllerEvent(0,1,0,64,127)\nm.addNote(0,1,60,0,4,90)\nwith open("tempo.mid","wb") as f:\n    m.writeFile(f)');assert(!r.error,r.error);const changed=parseMidi(c.encodeScore(r.files[0]));assert.equal(changed.tracks[0].filter(e=>e.type==='setTempo').length,2);assert.equal(changed.tracks[1].find(e=>e.type==='noteOn').channel,1);assert.equal(changed.tracks[1].find(e=>e.type==='programChange').programNumber,40);assert.equal(changed.tracks[1].find(e=>e.type==='controller').value,127);
r=await run('import os\n');assert(r.error);r=await run('while True:\n    pass');assert(r.error);console.log('PASS: MIDIUtil loops/chords/two hands; exact 16-bar duration and note count; tempo/program/channel/controller changes; unsupported imports and time limit.');
})().catch(e=>{console.error(e);process.exit(1)});
