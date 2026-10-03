import * as mammoth from 'mammoth/mammoth.browser.js';
import ExcelJS from 'exceljs';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { parseMidi } from 'midi-file';
import JSZip from 'jszip';
const MAX_TEXT=200000;
function guardText(text) { if(text.length>MAX_TEXT)throw new Error('Die Datei enthält mehr als 200.000 Zeichen. Bitte einen kleineren Ausschnitt verwenden. Es wurde nichts gekürzt.');return text; }
export async function readDocument(file,arrayBuffer) {
 const ext=file.name.split('.').at(-1).toLowerCase();
 if(ext==='docx') {const r=await mammoth.extractRawText({arrayBuffer});return {text:guardText(r.value),description:'Word-Inhalt als Text; das ursprüngliche Layout wird nicht übernommen.'};}
 if(ext==='xlsx') {
  const wb=new ExcelJS.Workbook();await wb.xlsx.load(arrayBuffer);const sheets=[];let cells=0;
  for(const sheet of wb.worksheets) {
   const rows=[];sheet.eachRow((row,index)=>{const values=[];row.eachCell((cell,column)=>{if(++cells>30000)throw new Error('Die Tabelle enthält mehr als 30.000 belegte Zellen. Bitte einen Ausschnitt wählen.');const value=cell.value;values.push({cell:cell.address,value:value instanceof Date?value.toISOString():value});});rows.push({row:index,cells:values});});
   sheets.push({name:sheet.name,rows});
  }
  return {text:guardText(JSON.stringify({sheets},null,2)),description:'Tabellenblätter, Zelladressen, Werte und Formeln eingelesen.'};
 }
 if(['mid','midi'].includes(ext)) {
  const midi=parseMidi(new Uint8Array(arrayBuffer));if(midi.header.framesPerSecond)throw new Error('MIDI mit SMPTE-Zeitbasis wird derzeit nicht unterstützt.');
  const ppq=midi.header.ticksPerBeat,tracks=[];let count=0;
  for(const track of midi.tracks) {
   let tick=0;const events=[];
   for(const event of track){tick+=event.deltaTime;if(++count>50000)throw new Error('Die MIDI-Datei enthält mehr als 50.000 Ereignisse. Bitte einen Ausschnitt wählen.');const {deltaTime,...data}=event;events.push({beat:tick/ppq,...data});}
   tracks.push(events);
  }
  return {text:guardText(JSON.stringify({format:midi.header.format,ticksPerBeat:ppq,tracks},null,2)),description:'MIDI-Spuren, Noten, Tempo und Controller als Ereignisse eingelesen.'};
 }
 throw new Error('Dieses Dokumentformat wird nicht unterstützt.');
}
function normalizeBlocks(spec) {
 const blocks=Array.isArray(spec.blocks)?spec.blocks:typeof spec.text==='string'?spec.text.split(/\n\s*\n/).map(text=>({type:'paragraph',text})):[];
 if(!blocks.length || blocks.length>2000)throw new Error('Das Dokument benötigt 1 bis 2.000 Inhaltsblöcke.');
 let length=0;
 for(const b of blocks){if(!b || !['heading','paragraph','list','table'].includes(b.type))throw new Error('Unbekannter Dokumentblock.');if(['heading','paragraph'].includes(b.type) && typeof b.text!=='string')throw new Error('Dokumenttext fehlt.');if(b.type==='list' && (!Array.isArray(b.items)||b.items.some(x=>typeof x!=='string')))throw new Error('Ungültige Liste.');if(b.type==='table' && (!Array.isArray(b.rows)||b.rows.length>2000||b.rows.some(r=>!Array.isArray(r)||r.length>30||r.some(x=>typeof x!=='string'&&typeof x!=='number'))))throw new Error('Ungültige Tabelle.');length+=JSON.stringify(b).length;}
 if(length>MAX_TEXT)throw new Error('Das Dokument ist zu groß.');return blocks;
}
async function makeDocx(spec) {
 const blocks=normalizeBlocks(spec),children=[];
 if(spec.title)children.push(new Paragraph({text:String(spec.title),heading:HeadingLevel.TITLE}));
 for(const b of blocks) {
  if(b.type==='heading')children.push(new Paragraph({text:b.text,heading:({1:HeadingLevel.HEADING_1,2:HeadingLevel.HEADING_2,3:HeadingLevel.HEADING_3})[b.level || 1] || HeadingLevel.HEADING_1}));
  if(b.type==='paragraph')children.push(new Paragraph({children:b.text.split('\n').map((line,i)=>new TextRun({text:line,break:i?1:0})),spacing:{after:180}}));
  if(b.type==='list')for(const item of b.items)children.push(new Paragraph({text:item,bullet:{level:0},spacing:{after:100}}));
  if(b.type==='table')children.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:b.rows.map(row=>new TableRow({children:row.map(value=>new TableCell({children:[new Paragraph(String(value))]}))}))}));
 }
 const doc=new Document({creator:'KI Workspace',title:String(spec.title || 'Dokument'),styles:{default:{document:{run:{font:'Calibri',size:22},paragraph:{spacing:{line:276}}}}},sections:[{children}]});return await Packer.toBlob(doc);
}
async function makePdf(spec) {
 const blocks=normalizeBlocks(spec),pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const fontData=await Promise.all(['regular','bold'].map(async name=>{const r=await fetch(new URL(`./vendor/fonts/${name}.ttf`,import.meta.url));if(!r.ok)throw new Error('Die PDF-Schrift konnte nicht geladen werden.');return r.arrayBuffer();}));
 const [font,bold]=await Promise.all(fontData.map(data=>pdf.embedFont(data,{subset:true})));
 const supported=new Set(font.getCharacterSet());const allText=String(spec.title || '')+JSON.stringify(blocks);for(const char of allText)if(!supported.has(char.codePointAt(0)) && !['\n','\r','\t'].includes(char))throw new Error('Die PDF-Schrift unterstützt das Zeichen „'+char+'“ nicht. Bitte DOCX verwenden oder den Text anpassen.');
 const W=595.28,H=841.89,M=48;let page,y;
 function newPage(){page=pdf.addPage([W,H]);y=H-M;}
 newPage();
 function wrap(text,f,size,width){const lines=[];for(const paragraph of String(text).split('\n')) {let line='';for(const word of paragraph.split(/\s+/)) {const candidate=line?line+' '+word:word;if(f.widthOfTextAtSize(candidate,size)<=width)line=candidate;else {if(line)lines.push(line);line='';let chunk='';for(const char of word){if(f.widthOfTextAtSize(chunk+char,size)>width){lines.push(chunk);chunk='';}chunk+=char;}line=chunk;}}lines.push(line);}return lines;}
 function write(text,size=11,f=font,indent=0){for(const line of wrap(text,f,size,W-2*M-indent)){if(y<size*1.45+M)newPage();page.drawText(line,{x:M+indent,y:y-size,size,font:f,color:rgb(.06,.09,.15)});y-=size*1.45;}y-=7;}
 if(spec.title)write(spec.title,20,bold);
 for(const block of blocks){
  if(block.type==='heading')write(block.text,block.level===2?13:16,bold);
  if(block.type==='paragraph')write(block.text);
  if(block.type==='list')for(const item of block.items)write('• '+item,11,font,10);
  if(block.type==='table'){
   const columns=Math.max(1,...block.rows.map(r=>r.length));if(columns>10)throw new Error('PDF-Tabellen unterstützen höchstens zehn Spalten.');const width=(W-2*M)/columns;
   for(let index=0;index<block.rows.length;index++){
    const cells=block.rows[index].map(value=>wrap(value,index===0?bold:font,9,width-12)),height=Math.max(1,...cells.map(c=>c.length))*13+12;
    if(height>H-2*M)throw new Error('Eine Tabellenzeile ist länger als eine PDF-Seite. Bitte kürzen.');if(y-height<M)newPage();
    for(let col=0;col<columns;col++){page.drawRectangle({x:M+col*width,y:y-height,width,height,borderWidth:.5,borderColor:rgb(.7,.75,.8),...(index===0?{color:rgb(.93,.95,.98)}:{})});for(const [line,value] of (cells[col] || []).entries())page.drawText(value,{x:M+col*width+6,y:y-9-6-line*13,size:9,font:index===0?bold:font});}y-=height;
   }y-=10;
  }
 }
 for(const [i,p] of pdf.getPages().entries())p.drawText(`${i+1} / ${pdf.getPageCount()}`,{x:W-M-40,y:24,size:9,font});
 if(spec.title)pdf.setTitle(String(spec.title));return new Blob([await pdf.save()],{type:'application/pdf'});
}
function setCell(cell,value) {
 if(value===null || ['string','number','boolean'].includes(typeof value)){if(typeof value==='number'&&!Number.isFinite(value))throw new Error('Ungültiger Zahlenwert.');cell.value=value;return;}
 if(value && typeof value.formula==='string'){cell.value={formula:value.formula.replace(/^=/,''),...(value.result!==undefined?{result:value.result}:{})};return;}
 throw new Error('Ungültiger Zellwert.');
}
async function makeXlsx(spec,sourceBlob) {
 const workbook=new ExcelJS.Workbook();if(sourceBlob)await workbook.xlsx.load(await sourceBlob.arrayBuffer());
 if(sourceBlob)for(const sheet of workbook.worksheets)sheet.eachRow(row=>row.eachCell(cell=>{const value=cell.value;if(value && typeof value==='object' && ('formula' in value || 'sharedFormula' in value)){const {result,...formula}=value;cell.value=formula;}}));
 if(!Array.isArray(spec.sheets)||!spec.sheets.length||spec.sheets.length>30)throw new Error('Eine Excel-Datei benötigt 1 bis 30 Blätter.');let total=0;
 for(const entry of spec.sheets){
  const name=String(entry.name || 'Tabelle').replace(/[\[\]:*?/\\]/g,'_').slice(0,31);let sheet=workbook.getWorksheet(name);if(!sheet)sheet=workbook.addWorksheet(name);
  if(Array.isArray(entry.rows))for(const [r,row] of entry.rows.entries()){if(!Array.isArray(row)||row.length>1000)throw new Error('Ungültige Tabellenzeile.');for(const [c,value] of row.entries()){if(++total>30000)throw new Error('Mehr als 30.000 Zellen werden nicht unterstützt.');setCell(sheet.getCell(r+1,c+1),value);}}
  if(Array.isArray(entry.updates))for(const update of entry.updates){if(++total>30000||!/^\$?[A-Z]{1,3}\$?[1-9]\d{0,6}$/.test(update.cell || ''))throw new Error('Ungültige Zelladresse.');setCell(sheet.getCell(update.cell),update.value);}
  if(entry.headerRow!==false && !sourceBlob){sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A73E8'}};}
  if(!sourceBlob)sheet.columns.forEach((column,i)=>{column.width=entry.columnWidths?.[i] || 20;});
  if(entry.freezeRows!==undefined)sheet.views=[{state:'frozen',ySplit:Math.max(0,Math.min(100,entry.freezeRows))}];
 }
 workbook.calcProperties.fullCalcOnLoad=true;return new Blob([await workbook.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
export async function createOfficeFile(spec,sourceBlob) {
 if(spec.kind==='docx')return makeDocx(spec);
 if(spec.kind==='pdf')return makePdf(spec);
 if(spec.kind==='xlsx')return makeXlsx(spec,sourceBlob);
 throw new Error('Dieses Dateiformat kann nicht erzeugt werden.');
}
export async function zipBackup(metadata,files) {
 const zip=new JSZip();zip.file('workspace.json',JSON.stringify(metadata));for(const file of files)zip.file('files/'+file.id,await file.blob.arrayBuffer());return zip.generateAsync({type:'blob',compression:'DEFLATE'});
}
export async function unzipBackup(blob) {
 const zip=await JSZip.loadAsync(await blob.arrayBuffer()),entry=zip.file('workspace.json');if(!entry)throw new Error('Kein KI-Workspace-Backup.');const metadata=JSON.parse(await entry.async('string'));const records=[];let total=0;
 if(!Array.isArray(metadata.files)||metadata.files.length>500)throw new Error('Ungültige Dateiliste im Backup.');
 for(const file of metadata.files){const entry=zip.file('files/'+file.id);if(!entry)throw new Error('Im Backup fehlt eine Datei.');const bytes=await entry.async('uint8array');total+=bytes.length;if(total>100*1024*1024)throw new Error('Das Backup enthält mehr als 100 MB Dateidaten.');records.push({...file,blob:new Blob([bytes],{type:file.type})});}
 return {metadata,records};
}
