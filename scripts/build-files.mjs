import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
await build({entryPoints:['src/office.js'],bundle:true,platform:'browser',format:'esm',target:'chrome110',minify:true,legalComments:'linked',outfile:'office.mjs'});
await mkdir('vendor/pdfjs',{recursive:true});
for(const name of ['pdf.mjs','pdf.worker.mjs'])await copyFile('node_modules/pdfjs-dist/legacy/build/'+name,'vendor/pdfjs/'+name);
await copyFile('node_modules/pdfjs-dist/LICENSE','vendor/pdfjs/LICENSE.txt');
