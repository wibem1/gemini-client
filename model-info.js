'use strict';
// Reviewed model-specific summaries. Never apply a brand profile to unreviewed versions.
const MODEL_PROFILES={
 'openai/gpt-6.1-sol':{strength:'Breit einsetzbar für Dokumentarbeit, anspruchsvolle Analysen, Programmierung und Aufgaben mit mehreren Arbeitsschritten.',limit:'Zusätzlicher Denkaufwand kann Laufzeit und Kosten erhöhen. Ein höherer Preis garantiert kein besseres Ergebnis für deinen Auftrag.'},
 'openai/gpt-6-luna':{strength:'Preiswerte Wahl für Gespräche, einfache Auswertungen und viele alltägliche Aufgaben. Unterstützt auch aufwendigere Denkmodi.',limit:'Für besonders schwierige Aufgaben lohnt ein Vergleich mit größeren Modellen. Viel Denkaufwand kann den Preisvorteil verkleinern.'},
 'anthropic/claude-fable-5.1':{strength:'Ausgerichtet auf umfangreiche Dokumente, anspruchsvolle Analysen und längere Programmieraufgaben.',limit:'Hohe Tokenpreise, besonders für lange Antworten. Für Routinefragen lohnt ein günstigeres Vergleichsmodell.'},
 'google/gemini-3.1-pro-preview':{strength:'Breite Modellfähigkeiten für Text, Bilder, Audio, Video und Dokumente; geeignet für strukturierte Planung und Analysen.',limit:'Eine Preview-Version kann sich ändern. Audio und Video werden in dieser App noch nicht übertragen. Dieses Chatmodell liefert Text; Bilderzeugung benötigt ein Bildmodell.'},
 'google/gemini-3.8-flash':{strength:'Ausgerichtet auf Programmierung, Aufgaben mit mehreren Arbeitsschritten und ein großes Kontextfenster; günstiger als Gemini 3.1 Pro.',limit:'Auch ein großes Kontextfenster garantiert nicht, dass jedes Detail eines langen Gesprächs richtig berücksichtigt wird. Audio und Video werden in dieser App noch nicht übertragen.'},
 'deepseek/deepseek-v4.1-flash':{strength:'Interessant für preiswerte technische Arbeit, Programmierung und lange Analysen. Kann auch Bilder verstehen.',limit:'Veröffentlichte Wissenstests zeigen weiterhin Fehler. Anbieterpreise und Antwortgeschwindigkeit können je nach ausführendem Anbieter abweichen.'},
 'qwen/qwen3.8-flash':{strength:'Preiswerte, vielseitige Wahl für Dokumente, Bilder, Diagramme und Programmierung.',limit:'Eine Überlegenheit bei deutschen Texten, Kunst oder Musik ist aus dem Modellprofil nicht belegt. Nicht mit den größeren Qwen-Max-Modellen gleichsetzen.'},
 'moonshotai/kimi-k3':{strength:'Ausgerichtet auf komplexe Dokumentarbeit, Programmierung und längere Aufgaben mit Werkzeugen.',limit:'Lange Antworten können teuer sein. Fähigkeiten zum selbstständigen Arbeiten benötigen passende Werkzeuge, die dieser Chat nicht automatisch bereitstellt.'},
 'z-ai/glm-5.3-flash':{strength:'Ausgerichtet auf effiziente Programmierung, Bildverständnis und längere Aufgaben mit großem Kontext.',limit:'Das technische Profil belegt keine besondere Qualität bei literarischen oder musikalischen Aufgaben. Werkzeugfunktionen benötigen eine passende App-Anbindung.'},
 'x-ai/grok-4.7':{strength:'Ausgerichtet auf längere technische Aufgaben, Programmierung sowie professionelle Dokumentarbeit.',limit:'Spitzenergebnisse des Anbieters verwenden hohen Denkaufwand. Auch veröffentlichte Wissenstests zeigen weiterhin Fehler.'},
 'mistralai/mistral-medium-3-5':{strength:'Verarbeitet Text und Bilder; ausgelegt für Programmierung und Aufgaben mit mehreren Schritten. Öffentlich verfügbare Modellgewichte ermöglichen eigenen Betrieb.',limit:'Eigener Betrieb braucht erhebliche Hardware und wird durch OpenRouter nicht automatisch lokal. Kleineres Kontextfenster als mehrere Modelle mit einer Million Tokens.'}
};
function modelPageURL(id){return 'https://openrouter.ai/'+String(id).split('/').map(encodeURIComponent).join('/');}
function modelPrice(value){if(value===undefined||value===null||value==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;}
function modelInfoData(model,mode){
 const inputs=model.inputs||['text'],outputs=model.outputs||(mode==='image'?['image']:['text']);
 const imageInput=inputs.includes('image'),imageOutput=mode==='image'||outputs.includes('image');
 const capabilities=[mode==='image'?'Neue Bilder erstellen: Ja.':'Fragen beantworten und Texte bearbeiten: Ja.'];
 capabilities.push(imageInput?(mode==='image'?'Hochgeladene Bilder als Vorlage übergeben: Ja.':'Hochgeladene Bilder ansehen und besprechen: Ja.'):'Hochgeladene Bilder verwenden: Nein.');
 if(mode==='image'){
  capabilities.push(imageInput?'Bilder als Vorlage für Erstellung oder Bearbeitung: Ja.':'Bilder als Vorlage bearbeiten: Nein.');
  const max=model.parameters?.input_references?.max;if(Number.isFinite(Number(max))&&max!==undefined)capabilities.push('Höchstens '+max+' Referenzbilder pro Auftrag.');
 }else capabilities.push(imageOutput?'Dieses Modell bietet auch Bildausgaben an; in dieser App werden Bilder im Modus „Bild erstellen / bearbeiten“ erzeugt.':'Neue Bilder erstellen: In diesem Chatmodus nicht möglich. Wähle „Bild erstellen / bearbeiten“.');
 capabilities.push(mode==='image'?'Ergebnisbilder kannst du ansehen, speichern und erneut als Vorlage verwenden.':'Dokumente, Tabellen und MIDI: Die App bereitet Inhalte auf und erzeugt aus passenden Antworten Dateien zum Speichern.');
 const extra=inputs.filter(x=>['audio','video'].includes(x));if(extra.length)capabilities.push('Das Modell unterstützt zusätzlich '+extra.map(x=>x==='audio'?'Audio':'Video').join(' und ')+'. Diese App überträgt beides noch nicht.');
 const profile=MODEL_PROFILES[model.id];
 const strengths=profile?.strength||(mode==='image'?'Dieses Modell ist für die Bilderzeugung vorgesehen. '+(imageInput?'Es akzeptiert zusätzlich Referenzbilder.':'Es erstellt Bilder aus deiner Textbeschreibung.'):'Für dieses Modell liegt noch kein geprüftes Kurzprofil zu besonderen Stärken vor. Die unterstützten Eingaben stehen oben.');
 const limits=[profile?.limit||'Für dieses Modell liegt noch keine geprüfte Einschätzung seiner besonderen Schwächen vor.'];
 if(mode==='image')limits.push('Eine Vorlage ermöglicht Änderungen, garantiert aber keine exakte Erhaltung jedes Details.');
 else limits.push('Eine überzeugend formulierte Antwort kann trotzdem falsch sein. Stil und kreative Qualität lassen sich aus technischen Daten nicht zuverlässig vorhersagen.');
 if(/:batch\b/.test(model.id))limits.push('Batch ist für zeitversetzte Sammelaufträge gedacht. Diese App hat keinen Batch-Ablauf; wähle für den direkten Chat die Variante ohne „:batch“.');
 const costs=[],p=model.pricing||{};for(const [key,label] of [['prompt','Eingabe'],['completion','Ausgabe']]){const n=modelPrice(p[key]);if(n!==null)costs.push(label+': $'+(n*1e6).toLocaleString('de-DE',{maximumFractionDigits:4})+' pro 1 Mio. Tokens.');}
 if(!costs.length)costs.push('Für dieses Modell liefert der gespeicherte Katalog keine eindeutigen Preisangaben. Siehe das OpenRouter-Modellprofil.');
 costs.push(mode==='image'?'Bildkosten können zusätzlich von Größe, Qualität und Referenzbildern abhängen.':'Bei jeder Chatnachricht wird der bisherige Verlauf erneut als Eingabe mitgesendet. Denk-Tokens können zusätzliche Ausgabekosten verursachen.');
 return {capabilities,strengths,limits,costs,profile:!!profile};
}
function renderModelInfo(){
 const model=availableModels().find(m=>m.id===$('sel-model').value),root=$('model-info-content');root.replaceChildren();
 $('model-info-title').textContent=model?.name||'Modellinfo';
 if(!model){root.textContent='Wähle zuerst ein Modell. Die Modellliste muss dafür geladen sein.';return;}
 const info=modelInfoData(model,imageMode()?'image':'chat');
 function section(title,items){const el=document.createElement('section'),h=document.createElement('h3');h.textContent=title;el.append(h);for(const value of items){const p=document.createElement('p');p.textContent=value;el.append(p);}root.append(el);}
 section('Was geht in dieser App?',info.capabilities);
 section('Stärken / Einsatzgebiete',[info.strengths]);
 section('Grenzen und Schwächen',info.limits);
 section('Kosten',info.costs);
 if(model.context_length)section('Gesprächsumfang',['Kontextfenster: '+Number(model.context_length).toLocaleString('de-DE')+' Tokens. Darin müssen Anweisungen, Verlauf, Anhänge und die neue Antwort Platz finden.']);
 const provenance=info.profile?'Redaktionelles Kurzprofil: 03.10.2026, aus veröffentlichten Modellprofilen. Kein eigener Vergleichstest.':'Keine persönliche Rangliste; technische Angaben aus dem OpenRouter-Katalog.';
 section('Grundlage',[provenance,'Fähigkeiten und Preise werden mit der Modellliste aktualisiert. Bei gespeicherten oder Offline-Daten können sie veraltet sein.']);
 if(model.description){const details=document.createElement('details'),summary=document.createElement('summary'),p=document.createElement('p');summary.textContent='Originalbeschreibung des Anbieters (meist Englisch)';p.textContent=model.description;details.append(summary,p);root.append(details);}
 const a=document.createElement('a');a.href=modelPageURL(model.id);a.target='_blank';a.rel='noopener noreferrer';a.textContent='Modellprofil und aktuelle Preise bei OpenRouter';root.append(a);
}
function openModelInfo(){renderModelInfo();$('model-info-dialog').showModal();}
