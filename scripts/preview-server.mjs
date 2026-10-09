import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';

const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.ttf':'font/ttf','.png':'image/png'};

// A loopback-only server shared by the manual preview and isolated browser tests.
export async function startPreviewServer({root,port=0}){
 const directory=resolve(root);
 const server=http.createServer(async(req,res)=>{
  try{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const path=resolve(directory,'.'+pathname);
   if(path!==directory&&!path.startsWith(directory+sep))throw new Error('OUTSIDE_PREVIEW');
   const file=path===directory?resolve(directory,'index.html'):path;
   const content=await readFile(file);
   res.setHeader('Content-Type',MIME[extname(file)]||'application/octet-stream');
   res.end(content);
  }catch{
   res.writeHead(404);
   res.end('Not found');
  }
 });
 await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(port,'127.0.0.1',resolve);
 });
 return {
  origin:`http://127.0.0.1:${server.address().port}`,
  close:()=>new Promise((resolve,reject)=>{
   server.close(error=>error?reject(error):resolve());
   server.closeIdleConnections();
  })
 };
}
