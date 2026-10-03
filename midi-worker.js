'use strict';
importScripts('vendor/skulpt/skulpt.min.js','vendor/skulpt/skulpt-stdlib.js');
const MIDI_MODULE = `
_WORKSPACE_FILES = []
class MIDIFile:
    def __init__(self, numTracks=1, *args, **kwargs):
        if not isinstance(numTracks, int) or numTracks < 1 or numTracks > 15:
            raise ValueError('MIDI benötigt 1 bis 15 Spuren')
        self.tracks = [{'name': 'Spur ' + str(i+1), 'program': 0, 'channel': 0, 'notes': [], 'programs': [], 'controllers': []} for i in range(numTracks)]
        self.tempos = []
        self.signature = [4,4]
        self.count = 0
        self.ticks = kwargs.get('ticks_per_quarternote',960) if kwargs.get('eventtime_is_ticks',False) else 1
    def addTrackName(self, track, time, trackName):
        self.tracks[track]['name'] = trackName
    def addTempo(self, track, time, tempo):
        self.tempos.append({'start': time/self.ticks, 'tempo': tempo})
    def addTimeSignature(self, track, time, numerator, denominator, clocks_per_tick=24, notes_per_quarter=8):
        if time != 0:
            raise ValueError('Taktwechsel im MIDIUtil-Code werden noch nicht unterstützt')
        self.signature = [numerator,2**denominator]
    def addProgramChange(self, track, channel, time, program):
        self.tracks[track]['programs'].append({'start': time/self.ticks, 'program':program, 'channel':channel})
    def addControllerEvent(self, track, channel, time, controller_number, parameter):
        self.tracks[track]['controllers'].append({'start':time/self.ticks,'channel':channel,'controller':controller_number,'value':parameter})
    def addNote(self, track, channel, pitch, time, duration, volume, annotation=None):
        self.count += 1
        if self.count > 50000:
            raise ValueError('Die Komposition enthält mehr als 50.000 Noten')
        if volume == 0:
            return
        self.tracks[track]['notes'].append({'pitch':pitch,'start':time/self.ticks,'duration':duration/self.ticks,'velocity':volume,'channel':channel})
    def writeFile(self, file):
        tempos = self.tempos or [{'start':0,'tempo':120}]
        score = {'filename':getattr(file,'name','komposition.mid'),'tempo':tempos[0]['tempo'],'tempos':tempos,'timeSignature':self.signature,'tracks':self.tracks}
        _WORKSPACE_FILES.append(score)
`;
const FILE_PREFIX = `
class _WorkspaceFile:
    def __init__(self, name, mode):
        if 'r' in mode or 'a' in mode:
            raise ValueError('Die MIDI-Umwandlung liest keine Dateien')
        self.name = str(name)
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def close(self):
        pass
    def write(self, data):
        raise ValueError('Nur MIDIUtil-Ausgaben werden unterstützt')
def open(name, mode='r', *args, **kwargs):
    return _WorkspaceFile(name, mode)
`;
self.onmessage=async event=>{
 try {
  const code=event.data?.code;if(typeof code!=='string' || code.length>200000)throw new Error('Die MIDI-Antwort ist zu groß oder ungültig.');
  Sk.configure({__future__:Sk.python3,execLimit:2500,yieldLimit:25,output:()=>{},read:path=>{
   if(/(?:^|\/)midiutil\/(?:__init__\.py)$/.test(path) || /(?:^|\/)midiutil\.py$/.test(path))return MIDI_MODULE;
   if(/(?:^|\/)(?:math|random)\.(?:js|py)$/.test(path) && Sk.builtinFiles.files[path])return Sk.builtinFiles.files[path];
   throw new Error('Dieses Zusatzmodul wird bei der MIDI-Umwandlung nicht unterstützt.');
  },inputfun:()=>{throw new Error('Eingaben sind bei der MIDI-Umwandlung nicht vorgesehen.');}});
  await Sk.misceval.asyncToPromise(()=>Sk.importMainWithBody('<midi>',false,FILE_PREFIX+'\n'+code,true));
  const module=Sk.sysmodules.mp$subscript(new Sk.builtin.str('midiutil'));
  const files=Sk.ffi.remapToJs(module.$d._WORKSPACE_FILES);
  if(!Array.isArray(files) || !files.length)throw new Error('Die Antwort hat keine MIDI-Datei erzeugt.');
  self.postMessage({files});
 }catch(e){self.postMessage({error:e.toString()});}
};
