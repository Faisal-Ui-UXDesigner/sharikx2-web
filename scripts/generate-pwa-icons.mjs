// Rasterize the existing repository icon, without changing the visual identity.
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
try{
 const page=await browser.newPage(),svg=await readFile(new URL('../icon.svg',import.meta.url),'utf8');
 for(const [size,name] of [[192,'pwa-192.png'],[512,'pwa-512.png'],[180,'apple-touch-icon.png']]){
  const data=await page.evaluate(async({svg,size})=>{
   const img=new Image();img.src='data:image/svg+xml;base64,'+btoa(svg);await img.decode();
   const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;canvas.getContext('2d').drawImage(img,0,0,size,size);return canvas.toDataURL('image/png').split(',')[1];
  },{svg,size});
  await writeFile(new URL(`../assets/${name}`,import.meta.url),Buffer.from(data,'base64'));
 }
}finally{await browser.close();}
