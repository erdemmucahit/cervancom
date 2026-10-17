import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { Readable } from 'node:stream';
import { openDatabase } from './environment.ts';
import { createApp, securityHeaders } from './app.ts';

const production=process.env.CERPLUS_MODE==='production';
const origin=process.env.CERPLUS_ORIGIN||'http://localhost:4321';
if (production && !origin.startsWith('https://')) throw new Error('Üretimde HTTPS CERPLUS_ORIGIN zorunlu.');
const db=await openDatabase(),handle=createApp(db,{origin,production});
const serveStatic=process.argv.includes('--static'),root=resolve('dist');
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.pdf':'application/pdf','.xml':'application/xml','.txt':'text/plain'};
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url||'/',origin);
    if (url.pathname.startsWith('/cerplus/api/')) {
      const headers=new Headers();for(const[key,value]of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
      const init:RequestInit & {duplex?:string}={method:req.method,headers};
      if(!['GET','HEAD'].includes(req.method||'GET')){init.body=Readable.toWeb(req) as any;init.duplex='half';}
      const response=await handle(new Request(url,init),req.socket.remoteAddress||'local');
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    if (serveStatic && ['GET','HEAD'].includes(req.method||'GET')) {
      const path=resolve(root,`.${decodeURIComponent(url.pathname)}`);
      if(path!==root && !path.startsWith(root+sep)){res.writeHead(404);res.end();return;}
      let file=path;
      if((await stat(file)).isDirectory())file=resolve(file,'index.html');
      const content=await readFile(file);
      res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream',...(url.pathname.startsWith('/cerplus')?securityHeaders:{})});
      res.end(req.method==='HEAD'?undefined:content);return;
    }
    res.writeHead(404);res.end('Bulunamadı.');
  } catch {res.writeHead(404);res.end('Bulunamadı.');}
});
server.requestTimeout=30000;
server.listen(Number(process.env.CERPLUS_PORT||4322),'127.0.0.1',()=>console.log(`Cerplus ${serveStatic?'site ve API':'API'}: http://localhost:${process.env.CERPLUS_PORT||4322} · arayüz origin: ${origin}`));
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{server.close(()=>{void db.close().then(()=>process.exit(0));});});
