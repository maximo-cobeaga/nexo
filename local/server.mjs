import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { Store } from './store.mjs';
import { analyze } from './analysis.mjs';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const cloneRepository=(repository,directory)=>new Promise((resolve,reject)=>{
  if(!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(repository))return reject(Error('El repositorio debe ser una URL válida de GitHub.'));
  if(fs.existsSync(directory))return reject(Error('Ya existe una carpeta para este repositorio. Elegí una carpeta local o eliminá esa copia antes de reintentar.'));
  fs.mkdirSync(path.dirname(directory),{recursive:true,mode:0o700});
  execFile('git',['clone','--depth','1',repository,directory],{timeout:180000,windowsHide:true},error=>error?reject(Error(`No se pudo clonar el repositorio. ${error.message}`)):resolve(directory));
});
export async function startServer({port=Number(process.env.PORT)||4318,store=new Store()}={}) {
  const token=crypto.randomBytes(32).toString('hex');const jobs=new Map();let childProcesses=new Set();
  const json=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  const body=async req=>{let text='';for await(const d of req){text+=d;if(text.length>5_000_000)throw Error('El archivo es demasiado grande.');}return JSON.parse(text||'{}');};
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    const address=server.address();const expected=`127.0.0.1:${address.port}`;
    if(req.headers.host!==expected && req.headers.host!==`localhost:${address.port}`){json(res,403,{error:'Host no permitido'});return;}
    const url=new URL(req.url,`http://${expected}`);
    try {
      if(url.pathname.startsWith('/api/')) {
        const origin=req.headers.origin;
        if(origin && ![`http://${expected}`,`http://localhost:${address.port}`].includes(origin)){json(res,403,{error:'Origen no permitido'});return;}
        if(url.pathname==='/api/health'&&req.method==='GET'){json(res,200,{local:true,version:'0.1.0',token,mcpPath:fileURLToPath(new URL('./mcp.mjs',import.meta.url)),node:process.execPath,dataDirectory:store.dir});return;}
        if(req.headers['x-nexo-token']!==token){json(res,401,{error:'Sesión local inválida. Recargá Nexo.'});return;}
        if(url.pathname==='/api/state'&&req.method==='GET'){json(res,200,store.read());return;}
        if(url.pathname==='/api/operation'&&req.method==='POST'){json(res,200,store.operate(await body(req)));return;}
        if(url.pathname==='/api/import'&&req.method==='POST'){json(res,200,store.replace(await body(req)));return;}
        if(url.pathname==='/api/claude'&&req.method==='GET') {
          execFile(process.env.NEXO_CLAUDE_BIN||'claude',['--version'],{timeout:7000,windowsHide:true},(err,out)=>json(res,200,{available:!err,version:err?null:out.trim()}));return;
        }
        if(url.pathname==='/api/analyze'&&req.method==='POST') {
          const {projectId}=await body(req);const s=store.read();let project=s.projects.find(p=>p.id===projectId);if(!project)throw Error('Proyecto inexistente');
          if(!project.path&&project.repository){const parts=new URL(project.repository).pathname.replace(/^\//,'').replace(/\.git$/,'').split('/');const destination=path.join(store.dir,'projects',`${parts[0]}--${parts[1]}`);await cloneRepository(project.repository,destination);store.operate({type:'project.update',id:projectId,patch:{path:destination,nextStep:'Repositorio clonado. Pendiente de análisis inicial.'}});project=store.read().projects.find(p=>p.id===projectId);}
          if([...jobs.values()].some(j=>j.status==='running'))throw Error('Ya hay un análisis en curso. Esperá a que termine.');
          const id=crypto.randomUUID();const job={id,projectId,status:'running',startedAt:new Date().toISOString()};jobs.set(id,job);
          let child;
          try {child=await analyze(project,s.tasks.filter(t=>t.projectId===projectId),data=>{
            try {
              store.operate({type:'project.update',id:projectId,patch:{...(data.profile||{}),lastAnalysis:data.summary}});
              let count=0;for(const t of data.tasks){if(store.read().tasks.some(x=>x.projectId===projectId&&x.title.toLocaleLowerCase()===t.title.toLocaleLowerCase()))continue;store.operate({type:'task.create',task:{...t,projectId,suggested:true}});count++;}
              Object.assign(job,{status:'completed',summary:data.summary,count});
            }catch(e){Object.assign(job,{status:'failed',error:e.message});}
            childProcesses.delete(child);
          },err=>{Object.assign(job,{status:'failed',error:err.message});childProcesses.delete(child);});childProcesses.add(child);child.once('close',()=>childProcesses.delete(child));}
          catch(e){jobs.delete(id);throw e;}
          json(res,202,job);return;
        }
        if(url.pathname==='/api/jobs'&&req.method==='GET'){json(res,200,[...jobs.values()].slice(-20));return;}
        json(res,404,{error:'Ruta no encontrada'});return;
      }
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
      const requested=decodeURIComponent(url.pathname);const file=path.resolve(root,'.'+(requested==='/'?'/index.html':requested));
      const relative=path.relative(root,file);
      if(relative.startsWith('..')||path.isAbsolute(relative)||!fs.statSync(file,{throwIfNoEntry:false})?.isFile()){res.writeHead(404);res.end('No encontrado');return;}
      res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
    }catch(e){json(res,400,{error:e.message});}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  server.on('close',()=>{for(const c of childProcesses)c.kill();});
  return {server,url:`http://127.0.0.1:${server.address().port}`};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){startServer().then(({url})=>console.log(`Nexo listo: ${url}`)).catch(e=>{console.error(e.message);process.exitCode=1;});}
