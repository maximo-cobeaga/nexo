export const statuses = ['pending', 'doing', 'review', 'done'];
export const labels = { pending: 'Pendiente', doing: 'En progreso', review: 'En revisión', done: 'Terminado' };
export const uid = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i=0;i<16;i++) bytes[i]=Math.floor(Math.random()*256);
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};
export const emptyState = () => ({ version: 1, revision: 0, demo: false, projects: [], tasks: [], sessions: [], activity: [], settings: { name: 'Mi espacio', dailyLimit: 3 } });
const str = (v, max = 4000) => typeof v === 'string' ? v.trim().slice(0, max) : '';
export function validateState(s) {
  if (!s || s.version !== 1 || !Array.isArray(s.projects) || !Array.isArray(s.tasks) || !Array.isArray(s.activity)) throw Error('El archivo no es un espacio Nexo válido.');
  if (s.projects.length > 1000 || s.tasks.length > 20000) throw Error('El espacio supera el límite de importación.');
  const projects = new Set(); const tasks = new Set();
  for (const p of s.projects) {
    if (!p || typeof p.id !== 'string' || projects.has(p.id) || !str(p.name, 120) || !['active', 'paused', 'archived'].includes(p.status)) throw Error('Hay proyectos inválidos o duplicados.');
    for (const field of ['name','description','about','goal','path','repository','stack','runCommand','website','notes','nextStep','lastAnalysis','color','createdAt','updatedAt']) if (p[field] !== undefined && typeof p[field] !== 'string') throw Error('El perfil de un proyecto tiene campos inválidos.');
    projects.add(p.id);
  }
  for (const t of s.tasks) {
    if (!t || typeof t.id !== 'string' || tasks.has(t.id) || !projects.has(t.projectId) || !str(t.title, 200) || !statuses.includes(t.status) || !['high', 'medium', 'low'].includes(t.priority)) throw Error('Hay tareas inválidas o sin proyecto.');
    if (t.acceptance !== undefined && (!Array.isArray(t.acceptance) || t.acceptance.some(x => typeof x !== 'string'))) throw Error('Criterios de aceptación inválidos.');
    if (t.dependsOn !== undefined && (!Array.isArray(t.dependsOn) || t.dependsOn.some(id=>typeof id !== 'string') || new Set(t.dependsOn).size!==t.dependsOn.length || t.dependsOn.includes(t.id))) throw Error('Dependencias de tarea inválidas.');
    for (const field of ['title','description','estimate','source','createdAt','updatedAt']) if (t[field] !== undefined && typeof t[field] !== 'string') throw Error('La tarea tiene campos inválidos.');
    tasks.add(t.id);
  }
  for (const t of s.tasks) if ((t.dependsOn||[]).some(id=>!tasks.has(id)||s.tasks.find(other=>other.id===id)?.projectId!==t.projectId)) throw Error('Una dependencia debe existir y pertenecer al mismo proyecto.');
  const byId=new Map(s.tasks.map(task=>[task.id,task]));const visiting=new Set(),visited=new Set();
  const visit=id=>{if(visiting.has(id))throw Error('Las dependencias no pueden formar un ciclo.');if(visited.has(id))return;visiting.add(id);for(const dependency of byId.get(id)?.dependsOn||[])visit(dependency);visiting.delete(id);visited.add(id);};
  for(const task of s.tasks)visit(task.id);
  if (s.sessions !== undefined && (!Array.isArray(s.sessions) || s.sessions.length>5000)) throw Error('Historial de sesiones inválido.');
  for (const session of s.sessions||[]) {
    if (!session||typeof session.id!=='string'||!projects.has(session.projectId)||!str(session.summary,10000)||!Number.isFinite(Date.parse(session.at))) throw Error('Una sesión tiene datos inválidos.');
    for (const field of ['summary','nextStep','agent','at']) if(session[field]!==undefined&&typeof session[field]!=='string') throw Error('Una sesión tiene campos inválidos.');
  }
  if (s.settings !== undefined && (!s.settings || typeof s.settings !== 'object' || Array.isArray(s.settings) || (s.settings.name !== undefined && typeof s.settings.name !== 'string'))) throw Error('Preferencias inválidas.');
  if (s.activity.some(a => !a || typeof a.text !== 'string' || typeof a.at !== 'string' || !Number.isFinite(Date.parse(a.at)))) throw Error('Historial inválido.');
  return s;
}
export function applyOperation(state, op) {
  const s = structuredClone(state); if(!Array.isArray(s.sessions))s.sessions=[];const now = new Date().toISOString(); let message;
  if (op.type === 'project.create') {
    const p = op.project || {};
    if (!str(p.name, 120)) throw Error('Escribí el nombre del proyecto.');
    const repository = str(p.repository, 500);
    if (repository && !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(repository)) throw Error('Usá una URL de repositorio de GitHub válida.');
    s.projects.push({ id: uid(), name: str(p.name, 120), description: str(p.description, 300), about: str(p.about), goal: str(p.goal), path: str(p.path, 1000), repository, stack: str(p.stack, 1000), runCommand: str(p.runCommand, 1000), website: str(p.website, 1000), notes: str(p.notes, 10000), nextStep: str(p.nextStep), color: ['violet','blue','green','orange','pink'].includes(p.color) ? p.color : 'violet', status: 'active', createdAt: now, updatedAt: now });
    message = `Proyecto creado: ${str(p.name, 120)}`;
  } else if (op.type === 'project.update') {
    const p = s.projects.find(x => x.id === op.id); if (!p) throw Error('No encontramos ese proyecto.');
    const patch = op.patch || {};
    for (const key of ['name','description','about','goal','path','repository','stack','runCommand','website','notes','nextStep','lastAnalysis']) if (key in patch) p[key] = str(patch[key], key === 'name' ? 120 : ['notes','lastAnalysis'].includes(key) ? 12000 : 4000);
    if (!p.name) throw Error('El proyecto necesita un nombre.');
    if (p.repository && !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(p.repository)) throw Error('Usá una URL de repositorio de GitHub válida.');
    if (p.website && !/^https?:\/\//.test(p.website)) throw Error('Usá una URL web válida que empiece con https:// o http://.');
    if ('status' in patch) { if (!['active','paused','archived'].includes(patch.status)) throw Error('Estado inválido.'); p.status = patch.status; }
    p.updatedAt = now; message = `Proyecto actualizado: ${p.name}`;
  } else if (op.type === 'task.create') {
    const t = op.task || {}; if (!s.projects.some(p => p.id === t.projectId)) throw Error('Seleccioná un proyecto.');
    if (!str(t.title, 200)) throw Error('La tarea necesita un título.');
    const dependsOn=Array.isArray(t.dependsOn)?[...new Set(t.dependsOn.filter(id=>typeof id==='string'))]:[];
    if(dependsOn.some(id=>!s.tasks.some(other=>other.id===id&&other.projectId===t.projectId)))throw Error('Las dependencias deben ser tareas existentes del mismo proyecto.');
    s.tasks.push({ id: uid(), projectId: t.projectId, title: str(t.title, 200), description: str(t.description), status: statuses.includes(t.status) ? t.status : 'pending', priority: ['high','medium','low'].includes(t.priority) ? t.priority : 'medium', estimate: str(t.estimate, 40), source: str(t.source, 1000), acceptance: Array.isArray(t.acceptance) ? t.acceptance.map(x => str(x, 500)).filter(Boolean).slice(0, 20) : [], dependsOn, suggested: !!t.suggested, today: !!t.today, createdAt: now, updatedAt: now });
    message = `${t.suggested ? 'Sugerencia recibida' : 'Tarea creada'}: ${str(t.title, 200)}`;
  } else if (op.type === 'task.update') {
    const t = s.tasks.find(x => x.id === op.id); if (!t) throw Error('No encontramos esa tarea.');
    const p = op.patch || {};
    for (const key of ['title','description','estimate','source']) if (key in p) t[key] = str(p[key], key === 'title' ? 200 : 4000);
    if (!t.title) throw Error('La tarea necesita un título.');
    if ('status' in p) { if (!statuses.includes(p.status)) throw Error('Estado inválido.'); t.status = p.status; }
    if ('priority' in p) { if (!['high','medium','low'].includes(p.priority)) throw Error('Prioridad inválida.'); t.priority = p.priority; }
    if ('today' in p) t.today = !!p.today;
    if ('suggested' in p) t.suggested = !!p.suggested;
    if ('acceptance' in p) { if (!Array.isArray(p.acceptance)) throw Error('Criterios inválidos.'); t.acceptance = p.acceptance.map(x => str(x,500)).filter(Boolean).slice(0,20); }
    if ('dependsOn' in p) { if(!Array.isArray(p.dependsOn))throw Error('Dependencias inválidas.');const ids=[...new Set(p.dependsOn.filter(id=>typeof id==='string'))];if(ids.includes(t.id)||ids.some(id=>!s.tasks.some(other=>other.id===id&&other.projectId===t.projectId)))throw Error('Las dependencias deben ser otras tareas del mismo proyecto.');t.dependsOn=ids; }
    t.updatedAt = now; message = `${p.status === 'done' ? 'Tarea terminada' : 'Tarea actualizada'}: ${t.title}`;
  } else if (op.type === 'task.delete') {
    const t = s.tasks.find(x => x.id === op.id); if (!t) throw Error('No encontramos esa tarea.');
    if(s.tasks.some(other=>(other.dependsOn||[]).includes(t.id)))throw Error('No podés eliminar una tarea que desbloquea otras. Quitá o cambiá sus dependencias primero.');
    s.tasks = s.tasks.filter(x => x.id !== op.id); message = `Tarea eliminada: ${t.title}`;
  } else if (op.type === 'session.create') {
    const entry=op.session||{};if(!s.projects.some(project=>project.id===entry.projectId))throw Error('Seleccioná un proyecto para la sesión.');if(!str(entry.summary,10000))throw Error('La sesión necesita un resumen.');
    s.sessions.unshift({id:uid(),projectId:entry.projectId,summary:str(entry.summary,10000),nextStep:str(entry.nextStep,4000),agent:str(entry.agent,120)||'Agente',at:now});message=`Sesión registrada: ${str(entry.summary,120)}`;
  } else if (op.type === 'settings.update') {
    s.settings = { ...s.settings, name: str(op.settings?.name, 80) || 'Mi espacio', dailyLimit: Math.max(1, Math.min(10, Number(op.settings?.dailyLimit) || 3)) }; message = 'Preferencias actualizadas';
  } else throw Error('Operación no reconocida.');
  s.revision = (Number(s.revision) || 0) + 1;
  s.activity.unshift({ id: uid(), text: message, at: now }); s.activity = s.activity.slice(0, 150);
  return validateState(s);
}
