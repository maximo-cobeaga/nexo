import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {emptyState,applyOperation,validateState} from '../dist/domain.js';
import {Store} from '../local/store.mjs';
import {startServer} from '../local/server.mjs';
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'nexo-test-'));
const project=s=>applyOperation(s,{type:'project.create',project:{name:'Prueba',goal:'Completar un checkout verificable',path:os.tmpdir(),about:'Una tienda',stack:'React, Node',nextStep:'Probar un pago'}});
test('conserva perfiles, sugerencias y estados sin mutar el origen',()=>{
 const original=emptyState();const s=project(original);assert.equal(original.projects.length,0);assert.equal(s.projects[0].about,'Una tienda');
 const p=s.projects[0];const s2=applyOperation(s,{type:'task.create',task:{projectId:p.id,title:'Validar pago',priority:'high',suggested:true,source:'checkout.js',acceptance:['Se confirma el pedido']}});
 assert.equal(s2.tasks[0].suggested,true);assert.equal(s2.tasks[0].status,'pending');
 const s3=applyOperation(s2,{type:'task.update',id:s2.tasks[0].id,patch:{suggested:false,today:true,status:'doing'}});
 assert.equal(s3.tasks[0].suggested,false);assert.equal(s3.tasks[0].today,true);assert.equal(s3.tasks[0].status,'doing');assert.equal(s3.projects[0].nextStep,'Probar un pago');
 assert.throws(()=>applyOperation(s3,{type:'task.update',id:s3.tasks[0].id,patch:{status:'magic'}}));
 assert.throws(()=>applyOperation(s3,{type:'task.create',task:{projectId:'missing',title:'Inválida'}}));
});
test('rechaza importaciones inconsistentes y perfiles con tipos peligrosos',()=>{
 const s=project(emptyState());assert.throws(()=>validateState({...s,projects:[...s.projects,...s.projects]}));
 const bad=structuredClone(s);bad.projects[0].stack={bad:true};assert.throws(()=>validateState(bad));
 const badActivity=structuredClone(s);badActivity.activity=[{text:'prueba',at:'invalid'}];assert.throws(()=>validateState(badActivity));
});
test('conserva dependencias y sesiones sin permitir ciclos ni eliminaciones inseguras',()=>{
 const s=project(emptyState());const p=s.projects[0];const first=applyOperation(s,{type:'task.create',task:{projectId:p.id,title:'Preparar API'}});const second=applyOperation(first,{type:'task.create',task:{projectId:p.id,title:'Conectar interfaz',dependsOn:[first.tasks[0].id]}});
 assert.deepEqual(second.tasks[1].dependsOn,[first.tasks[0].id]);
 assert.throws(()=>applyOperation(second,{type:'task.delete',id:first.tasks[0].id}),/desbloquea/);
 assert.throws(()=>applyOperation(second,{type:'task.update',id:first.tasks[0].id,patch:{dependsOn:[second.tasks[1].id]}}),/ciclo/);
 const session=applyOperation(second,{type:'session.create',session:{projectId:p.id,summary:'API preparada',nextStep:'Conectar interfaz',agent:'Claude Code'}});assert.equal(session.sessions[0].nextStep,'Conectar interfaz');
});
test('dos instancias de almacenamiento ven cambios y guardan respaldo al importar',t=>{
 const dir=temp();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const a=new Store(dir),b=new Store(dir);
 a.replace(project(emptyState()));const id=a.read().projects[0].id;b.operate({type:'task.create',task:{projectId:id,title:'Un paso concreto'}});assert.equal(a.read().tasks.length,1);
 a.operate({type:'project.update',id,patch:{nextStep:'Continuar mañana'}});assert.equal(b.read().projects[0].nextStep,'Continuar mañana');
 b.replace(emptyState());assert.equal(a.read().projects.length,0);assert.ok(fs.existsSync(path.join(dir,'workspace.json.backup')));assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'workspace.json.backup'),'utf8')).tasks.length,1);
});
test('HTTP exige sesión y origen local, y conserva cambios después de reiniciar',async t=>{
 const dir=temp();const first=await startServer({port:0,store:new Store(dir)});let active=first.server;
 t.after(async()=>{if(active.listening)await new Promise(r=>active.close(r));fs.rmSync(dir,{recursive:true,force:true});});
 const health=await (await fetch(first.url+'/api/health')).json();assert.ok(health.token);
 assert.equal((await fetch(first.url+'/api/state')).status,401);
 assert.equal((await fetch(first.url+'/api/health',{headers:{Origin:'https://untrusted.example'}})).status,403);
 const options={method:'POST',headers:{'Content-Type':'application/json','X-Nexo-Token':health.token},body:JSON.stringify({type:'project.create',project:{name:'Persistente',goal:'Publicar'}})};
 const response=await fetch(first.url+'/api/operation',options);assert.equal(response.status,200);const state=await response.json();assert.equal(state.projects[0].name,'Persistente');
 assert.equal((await fetch(first.url+'/api/import',{...options,body:'{"version":1}'})).status,400);
 await new Promise(r=>active.close(r));const second=await startServer({port:0,store:new Store(dir)});active=second.server;
 const health2=await (await fetch(second.url+'/api/health')).json();const persisted=await (await fetch(second.url+'/api/state',{headers:{'X-Nexo-Token':health2.token}})).json();assert.equal(persisted.projects[0].name,'Persistente');assert.notEqual(health.token,health2.token);
});
test('MCP stdio comparte tareas y perfiles con HTTP',async t=>{
 const dir=temp();const {server,url}=await startServer({port:0,store:new Store(dir)});
 const child=spawn(process.execPath,[fileURLToPath(new URL('../local/mcp.mjs',import.meta.url))],{env:{...process.env,NEXO_DATA_DIR:dir},stdio:['pipe','pipe','pipe']});
 t.after(async()=>{child.kill();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
 const reader=readline.createInterface({input:child.stdout});const waiting=new Map();reader.on('line',line=>{const m=JSON.parse(line);waiting.get(m.id)?.(m);waiting.delete(m.id);});
 let id=0;function rpc(method,params){return new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>reject(Error('MCP timeout')),3000);waiting.set(n,m=>{clearTimeout(timer);resolve(m.result);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:n,method,params})+'\n');});}
 const init=await rpc('initialize',{});assert.equal(init.serverInfo.name,'nexo');
 const tools=await rpc('tools/list',{});assert.equal(tools.tools.length,9);
 const created=await rpc('tools/call',{name:'nexo_create_project',arguments:{name:'Desde Claude',path:dir,goal:'Terminar MVP'}});const p=JSON.parse(created.content[0].text);
 await rpc('tools/call',{name:'nexo_update_project',arguments:{id:p.id,about:'Una app de prueba',nextStep:'Conectar auth'}});
 await rpc('tools/call',{name:'nexo_create_task',arguments:{projectId:p.id,title:'Probar sesión',suggested:true,source:'auth.js'}});
 const context=await rpc('tools/call',{name:'nexo_get_context',arguments:{path:dir}});const active=JSON.parse(context.content[0].text);assert.equal(active.project.id,p.id);assert.equal(active.suggestions.length,1);
 await rpc('tools/call',{name:'nexo_record_session',arguments:{projectId:p.id,summary:'Se validó la conexión MCP',nextStep:'Continuar con la interfaz'}});
 const sessions=await rpc('tools/call',{name:'nexo_list_sessions',arguments:{projectId:p.id}});assert.equal(JSON.parse(sessions.content[0].text).length,1);
 const health=await (await fetch(url+'/api/health')).json();const state=await (await fetch(url+'/api/state',{headers:{'X-Nexo-Token':health.token}})).json();assert.equal(state.projects[0].nextStep,'Conectar auth');assert.equal(state.tasks[0].suggested,true);
 const error=await rpc('tools/call',{name:'nexo_update_task',arguments:{id:'missing',status:'done'}});assert.equal(error.isError,true);
});
