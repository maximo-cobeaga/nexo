import readline from 'node:readline';
import path from 'node:path';
import { Store } from './store.mjs';
const store = new Store();
const object = properties => ({type:'object',properties,additionalProperties:false});
const text = description => ({type:'string',description});
const normalized = value => process.platform==='win32' ? path.resolve(value).toLocaleLowerCase() : path.resolve(value);
function projectForPath(projects, requestedPath) {
  if (!requestedPath || typeof requestedPath !== 'string' || !path.isAbsolute(requestedPath)) return null;
  const target=normalized(requestedPath);
  return projects
    .filter(project=>project.path&&path.isAbsolute(project.path))
    .filter(project=>{const relative=path.relative(normalized(project.path),target);return !relative.startsWith('..')&&!path.isAbsolute(relative);})
    .sort((a,b)=>normalized(b.path).length-normalized(a.path).length)[0]||null;
}
function contextFor(project, state) {
  const tasks=state.tasks.filter(task=>task.projectId===project.id);
  return {project,pendingTasks:tasks.filter(task=>!task.suggested&&task.status!=='done'),suggestions:tasks.filter(task=>task.suggested),recentActivity:state.activity.filter(entry=>tasks.some(task=>entry.text.includes(task.title))||entry.text.includes(project.name)).slice(0,12)};
}
const tools = [
  {name:'nexo_list_projects',description:'Lista proyectos Nexo, objetivos y carpetas registradas.',inputSchema:object({})},
  {name:'nexo_get_context',description:'Obtiene el perfil y los pendientes del proyecto activo. Sin path, intenta reconocer el proyecto por la carpeta actual del agente. Usalo al iniciar o al preguntar qué falta.',inputSchema:object({path:text('Carpeta absoluta del proyecto, opcional')})},
  {name:'nexo_list_tasks',description:'Consulta tareas de todos los proyectos o de un proyecto. Con path, resuelve el proyecto por su carpeta. Incluye sugerencias por revisar.',inputSchema:object({projectId:text('ID del proyecto'),path:text('Carpeta absoluta del proyecto'),status:{type:'string',enum:['pending','doing','review','done']}})},
  {name:'nexo_update_project',description:'Completa o actualiza el perfil del proyecto tras inspeccionar su código y documentación. Guardá qué es, tecnologías, cómo ejecutarlo, decisiones y dónde quedó la última sesión. No inventes datos sin evidencia.',inputSchema:{...object({id:text('ID del proyecto'),name:text('Nombre claro del proyecto'),description:text('Resumen en una frase'),about:text('Qué es, para quién y cómo funciona'),goal:text('Definición de terminado'),path:text('Carpeta local absoluta ya registrada'),repository:text('URL de GitHub verificada'),stack:text('Tecnologías separadas por comas'),runCommand:text('Comando para iniciar el proyecto; no se ejecuta'),website:text('URL publicada verificada'),notes:text('Decisiones, hallazgos y recordatorios'),nextStep:text('Dónde quedó la sesión y cómo continuar'),status:{type:'string',enum:['active','paused','archived']}}),required:['id']}},
  {name:'nexo_create_project',description:'Registra un proyecto y su objetivo; no mueve ni modifica su código.',inputSchema:{...object({name:text('Nombre'),path:text('Carpeta local absoluta'),repository:text('URL GitHub opcional'),goal:text('Objetivo y definición de terminado')}),required:['name','goal']}},
  {name:'nexo_create_task',description:'Crea una tarea. Para pendientes inferidos del código usá suggested=true e indicá evidencia en source.',inputSchema:{...object({projectId:text('ID del proyecto'),title:text('Título concreto'),description:text('Contexto y próximo paso'),priority:{type:'string',enum:['high','medium','low']},estimate:text('Estimación orientativa'),source:text('Archivo, línea o evidencia; diferenciar hipótesis'),acceptance:{type:'array',items:{type:'string'}},dependsOn:{type:'array',items:{type:'string'},description:'IDs de tareas que deben terminar antes'},suggested:{type:'boolean'}}),required:['projectId','title']}},
  {name:'nexo_update_task',description:'Actualiza una tarea y su estado. Marcá done solamente tras verificar sus criterios. No marca completado por un commit.',inputSchema:{...object({id:text('ID de tarea'),status:{type:'string',enum:['pending','doing','review','done']},description:text('Avances, bloqueos y próximo paso'),priority:{type:'string',enum:['high','medium','low']},today:{type:'boolean'},dependsOn:{type:'array',items:{type:'string'},description:'IDs de tareas bloqueantes'}}),required:['id']}},
  {name:'nexo_list_sessions',description:'Lista los resúmenes de sesiones de agentes, para retomar el trabajo sin perder contexto.',inputSchema:object({projectId:text('ID del proyecto')})},
  {name:'nexo_record_session',description:'Guarda el cierre de una sesión: avances, bloqueos y siguiente paso. Usala al terminar de trabajar.',inputSchema:{...object({projectId:text('ID del proyecto'),summary:text('Qué se hizo, qué se verificó y bloqueos'),nextStep:text('Siguiente paso concreto'),agent:text('Nombre del agente o herramienta')}),required:['projectId','summary']}}
];
export function dispatch(method, params={}) {
  if(method==='initialize') return {protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'nexo',version:'0.1.0'},instructions:'Leé el objetivo antes de proponer tareas. No inventes pendientes. Creá sugerencias con evidencia. Registrá próximos pasos al cerrar una sesión.'};
  if(method==='ping') return {};
  if(method==='tools/list') return {tools};
  if(method==='tools/call') {
    try {
      const a=params.arguments||{}; let result;
      switch(params.name) {
        case 'nexo_list_projects': result=store.read().projects; break;
        case 'nexo_get_context': {const state=store.read();const requestedPath=a.path||process.cwd();const project=projectForPath(state.projects,requestedPath);if(!project)throw Error(`No hay un proyecto Nexo registrado para ${requestedPath}. Registralo con su carpeta absoluta o indicá path.`);result=contextFor(project,state);break;}
        case 'nexo_list_tasks': {const state=store.read();const byPath=a.path?projectForPath(state.projects,a.path):null;if(a.path&&!byPath)throw Error(`No hay un proyecto Nexo registrado para ${a.path}.`);const projectId=a.projectId||byPath?.id;result=state.tasks.filter(t=>(!projectId||t.projectId===projectId)&&(!a.status||t.status===a.status));break;}
        case 'nexo_create_project': result=store.operate({type:'project.create',project:a}).projects.at(-1); break;
        case 'nexo_update_project': {const {id,...patch}=a;result=store.operate({type:'project.update',id,patch}).projects.find(p=>p.id===id);break;}
        case 'nexo_create_task': result=store.operate({type:'task.create',task:a}).tasks.at(-1); break;
        case 'nexo_update_task': {const {id,...patch}=a;result=store.operate({type:'task.update',id,patch}).tasks.find(t=>t.id===id);break;}
        case 'nexo_list_sessions': result=(store.read().sessions||[]).filter(session=>!a.projectId||session.projectId===a.projectId);break;
        case 'nexo_record_session': result=store.operate({type:'session.create',session:a}).sessions.at(0);break;
        default: throw Error('Herramienta desconocida');
      }
      return {content:[{type:'text',text:JSON.stringify(result)}]};
    } catch(e) {return {isError:true,content:[{type:'text',text:e.message}]};}
  }
  throw Error('Método no soportado');
}
const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
lines.on('line',line=>{
  let m; try {m=JSON.parse(line);} catch {process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'JSON inválido'}})+'\n');return;}
  if(m.id===undefined) return;
  try {process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result:dispatch(m.method,m.params)})+'\n');}
  catch(e){process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,error:{code:-32601,message:e.message}})+'\n');}
});
