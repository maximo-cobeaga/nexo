import {emptyState} from './domain.js';
export function demoState(){
 const s=emptyState();s.demo=true;const now=new Date().toISOString();
 s.projects=[
  {id:'demo-trena',name:'Trena',description:'Entrenar mejor, todos los días.',goal:'Publicar una primera versión para registrar rutinas y progreso.',path:'',repository:'',color:'orange',status:'active',createdAt:now},
  {id:'demo-diagramia',name:'Diagramia',description:'De una idea a un diagrama.',goal:'Completar un flujo de creación y guardado de diagramas.',path:'',repository:'',color:'violet',status:'active',createdAt:now},
  {id:'demo-intrek',name:'Intrek Store',description:'Tiendas que hacen crecer negocios.',goal:'Terminar una tienda piloto con catálogo y checkout.',path:'',repository:'',color:'green',status:'active',createdAt:now},
  {id:'demo-kampiva',name:'Kampiva',description:'Un copiloto para tu contenido.',goal:'Validar el flujo de creación de una publicación.',path:'',repository:'',color:'blue',status:'paused',createdAt:now}
 ];
 const profiles={
  'demo-trena':{about:'Una app de entrenamiento para organizar rutinas, registrar series y pesos, y ver la evolución con el tiempo. La idea es tener el entrenamiento y los hábitos en un mismo lugar.',stack:'React Native, Expo, TypeScript',runCommand:'npm run start',nextStep:'Retomar el historial de rutinas. Cuando esté conectado, revisar el resumen que aparece al terminar un entrenamiento.',notes:'Contexto de ejemplo. Las tareas y tecnologías de esta demo son ilustrativas; reemplazalas por las de tu proyecto.'},
  'demo-diagramia':{about:'Un espacio para convertir ideas en diagramas con ayuda de IA. El editor permite organizar nodos y conexiones, mientras un chat acompaña la creación.',stack:'React, Django, PostgreSQL',runCommand:'docker compose up -d',nextStep:'Revisar el guardado de posiciones de los nodos y verificar que el diagrama se recupere como estaba.',notes:'Mantener el primer flujo simple: crear, editar, guardar y volver a abrir.'},
  'demo-intrek':{about:'Una plataforma de tiendas con diseño personalizado e integraciones reutilizables. El primer objetivo es validar una tienda piloto antes de sumar nuevos clientes.',stack:'JavaScript, API, PostgreSQL',runCommand:'npm run dev',nextStep:'Recorrer el checkout de la tienda piloto y anotar dónde se corta la compra.',notes:'Separar lo necesario para la tienda piloto de las mejoras para futuras tiendas.'},
  'demo-kampiva':{about:'Un copiloto para crear y organizar contenido para pequeños negocios. Primero se valida un flujo de uso individual.',stack:'Por definir',nextStep:'Volver cuando el proyecto prioritario esté terminado.',notes:'En pausa para mantener el foco.'}
 };
 s.projects=s.projects.map(p=>({...p,...profiles[p.id]}));
 const rows=[
 ['Trena','Diseñar el resumen de entrenamiento','Mostrar series, repeticiones y duración al finalizar.','pending','high','45 min',true],
 ['Intrek Store','Revisar el flujo de checkout','Recorrer una compra completa y documentar los pasos que faltan.','pending','high','1 h',false],
 ['Diagramia','Guardar la posición de los nodos','Recuperar la distribución al volver a abrir un diagrama.','pending','medium','30 min',false],
 ['Trena','Conectar el historial de rutinas','Vincular la pantalla de historial con las rutinas guardadas.','doing','high','1 h',true],
 ['Diagramia','Mejorar el estado vacío del editor','Agregar una guía breve para crear el primer diagrama.','doing','medium','25 min',false],
 ['Intrek Store','Validar el catálogo en mobile','Revisar navegación y tarjetas de producto en pantallas chicas.','review','medium','20 min',true],
 ['Trena','Definir la identidad visual','Paleta coral, tipografía y componentes principales.','done','low','',false],
 ['Diagramia','Crear la estructura del editor','Panel lateral y espacio central de trabajo.','done','medium','',false]
 ];
 s.tasks=rows.map((r,i)=>({id:`demo-task-${i}`,projectId:s.projects.find(p=>p.name===r[0]).id,title:r[1],description:r[2],status:r[3],priority:r[4],estimate:r[5],today:r[6],suggested:false,acceptance:['El flujo funciona de principio a fin.','Se verificó en escritorio y mobile.'],source:'Ejemplo ilustrativo; no proviene de una revisión de tu código.',createdAt:now,updatedAt:now}));
 s.tasks.push({id:'demo-suggestion',projectId:'demo-trena',title:'Comprobar la persistencia de las series',description:'Ejemplo de un pendiente sugerido por IA que requiere tu revisión.',status:'pending',priority:'medium',suggested:true,today:false,source:'Sugerencia de ejemplo, sin archivos reales analizados.',acceptance:['Los datos se conservan al cerrar y abrir la app.'],createdAt:now,updatedAt:now});
 s.activity=[{id:'a1',text:'Completaste: Definir la identidad visual',at:now},{id:'a2',text:'Trena · Conectar el historial de rutinas pasó a En progreso',at:now},{id:'a3',text:'Espacio de ejemplo listo para explorar',at:now}];return s;
}
