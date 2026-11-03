import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseMidi,writeMidi} from 'midi-file';
import {describeMidi} from '../src/midi-import.js';
function verify(midi){
 const text=describeMidi(midi),table=JSON.parse(text);
 assert.equal(table.tracks.length,midi.tracks.length);
 table.tracks.forEach((rows,i)=>{let tick=0;rows.forEach(([position,id,...values],j)=>{
  const {deltaTime,...expected}=midi.tracks[i][j];tick+=deltaTime;
  const layout=table.layouts[id];
  assert.equal(position,tick);
  assert.deepEqual({type:layout.type,...Object.fromEntries(layout.fields.map((key,k)=>[key,values[k]]))},expected);
 });assert.equal(rows.length,midi.tracks[i].length);});
 return text;
}
const events=[{deltaTime:0,meta:true,type:'setTempo',microsecondsPerBeat:500000},{deltaTime:0,meta:true,type:'timeSignature',numerator:6,denominator:8,metronome:24,thirtyseconds:8}];
for(let i=0;i<1700;i++)events.push({deltaTime:1,channel:0,type:'noteOn',noteNumber:48+i%36,velocity:80},{deltaTime:119,channel:0,type:'noteOff',noteNumber:48+i%36,velocity:0});
events.push({deltaTime:0,type:'endOfTrack',meta:true});
const midi=parseMidi(writeMidi({header:{format:0,numTracks:1,ticksPerBeat:480},tracks:[events]}));
assert(JSON.stringify(midi,null,2).length>200000);
assert(verify(midi).length<200000);
if(process.argv[2]){const bytes=fs.readFileSync(process.argv[2]);const real=parseMidi(bytes);const text=verify(real);assert(text.length<200000);console.log('Real MIDI: all events and exact ticks verified; '+text.length+' characters.');}
assert.throws(()=>describeMidi({header:{framesPerSecond:25},tracks:[]}),/SMPTE/);
console.log('PASS: compact MIDI import preserves every event, field and integer tick.');
