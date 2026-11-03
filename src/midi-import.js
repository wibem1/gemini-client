// Lossless event table: integer ticks avoid rounded beat positions, and shared
// layouts avoid repeating long property names for every MIDI event.
export function describeMidi(midi) {
 if(midi.header.framesPerSecond)throw new Error('MIDI mit SMPTE-Zeitbasis wird derzeit nicht unterstützt.');
 const layouts=[],ids=new Map();let count=0;
 const tracks=midi.tracks.map(track=>{
  let tick=0;
  return track.map(event=>{
   tick+=event.deltaTime;
   if(++count>50000)throw new Error('Die MIDI-Datei enthält mehr als 50.000 Ereignisse. Bitte einen Ausschnitt wählen.');
   const {deltaTime,type,...data}=event;
   const fields=Object.keys(data),key=JSON.stringify([type,fields]);
   if(!ids.has(key)){ids.set(key,layouts.length);layouts.push({type,fields});}
   return [tick,ids.get(key),...fields.map(field=>data[field])];
  });
 });
 return JSON.stringify({format:midi.header.format,ticksPerBeat:midi.header.ticksPerBeat,
  encoding:'Each track row is [absoluteTick, layoutIndex, ...fieldValues]. layouts[layoutIndex] defines event type and ordered fields. Time in quarter notes = absoluteTick / ticksPerBeat. All events and fields are retained; channels are zero-based.',
  layouts,tracks});
}
