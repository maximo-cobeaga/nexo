# Nexo

Un espacio personal para recordar qué estás construyendo, priorizar lo pendiente y continuar cada proyecto con Claude Code.

## Qué funciona en esta versión

- Vista inicial de tareas agrupadas por prioridad, filtro por proyecto/estado y tablero Kanban con drag and drop.
- Perfil por proyecto: descripción, objetivo, carpeta, repositorio, tecnologías, URL, comando de inicio, notas y dónde quedó la última sesión.
- Creación/edición de tareas, criterios de aceptación, dependencias entre tareas, selección para Mi día, búsqueda global y actividad.
- Historial de sesiones: el agente puede guardar avances, bloqueos y el siguiente paso para retomar sin perder contexto.
- Propuestas de Claude separadas de las tareas aceptadas, con evidencia y revisión.
- Web con almacenamiento en el navegador, exportación/importación JSON y manifest PWA.
- Servicio local HTTP y servidor MCP stdio que comparten un archivo persistente.
- App Electron con la misma interfaz y servicio local integrado.

La demo web contiene datos ilustrativos y lo indica explícitamente. El servicio local empieza vacío. Los datos de un navegador web publicado y los del escritorio **no se sincronizan automáticamente**: exportá/importá para trasladarlos. Si abrís en el navegador la URL del servicio local, sí ves los mismos datos que usa el MCP.

## Inicio en Windows, macOS o Linux

Requisito: Node.js 22 o superior. Descomprimí este proyecto y abrí una terminal en su carpeta.

```sh
npm start
```

Abrí `http://127.0.0.1:4318`. El servidor y el MCP usan solamente módulos de Node.js: **no hace falta instalar dependencias para este modo**.

Los datos se guardan en `~/.nexo-workspace/workspace.json` (en Windows, dentro de tu carpeta de usuario). `NEXO_DATA_DIR` permite elegir otra ubicación. No configures rutas diferentes entre el servidor y el MCP si querés que compartan el mismo espacio. Las escrituras usan un lock y reemplazo atómico. Al importar, el servicio local conserva `workspace.json.backup`.

## Conectar Claude Code

Con Nexo local abierto, entrá a **Claude Code** en la barra lateral y copiá el comando con la ruta de tu instalación. También podés registrar el MCP manualmente:

```sh
claude mcp add --transport stdio --scope user nexo -- node "RUTA_ABSOLUTA_A_NEXO/local/mcp.mjs"
```

Reiniciá la sesión de Claude Code y verificá la conexión con `/mcp`. No hace falta que el servidor web esté abierto para que el MCP funcione.

Herramientas disponibles:

| Herramienta | Uso |
| --- | --- |
| `nexo_list_projects` | Leer todos los perfiles |
| `nexo_get_context` | Leer automáticamente el perfil y pendientes del proyecto de la carpeta actual |
| `nexo_list_tasks` | Consultar tareas, estados y sugerencias |
| `nexo_create_project` | Registrar un proyecto y su objetivo |
| `nexo_update_project` | Guardar resumen, tecnologías, notas y próximo paso |
| `nexo_create_task` | Crear tareas con evidencia y criterios de aceptación |
| `nexo_update_task` | Actualizar contexto, estado, prioridad y Mi día |
| `nexo_list_sessions` | Consultar los cierres de sesiones anteriores |
| `nexo_record_session` | Guardar avances, bloqueos y próximo paso al cerrar una sesión |

Al comenzar una sesión podés pedir: “Consultá Nexo con `nexo_get_context` para este proyecto. Leé el código y la documentación, completá todo el perfil que puedas demostrar (qué es, tecnologías, comando de inicio, notas y próximo paso) y decime qué falta. Proponé pendientes necesarios para cumplir el objetivo, sin duplicarlos.” El agente usa `nexo_update_project`; no inventa campos sin evidencia. El MCP reconoce el proyecto por la carpeta actual (o se le puede indicar `path`) y lee el mismo archivo que la interfaz local. Por eso, un cambio aceptado en cualquiera de los dos lados queda disponible inmediatamente para el otro; la interfaz local lo refresca automáticamente.

Al terminar: “Actualizá las tareas verificadas, usá `nexo_record_session` con lo avanzado, los bloqueos y el próximo paso, y actualizá el perfil si cambió el contexto.” Una tarea puede declarar `dependsOn` para que Nexo muestre que está bloqueada hasta que se complete su predecesora.

## Botón Analizar con IA

Usa tu instalación del **CLI nativo de Claude Code** (v2.1.248 o superior), ya autenticado. Ejecutá primero `claude --version` y `claude auth login` en tu terminal. El análisis usa tu plan o credenciales configuradas, con sus límites/costos. No se inicia automáticamente. Además de sugerencias, completa los campos del perfil que pueda verificar desde el código y la documentación; nunca adivina datos faltantes.

Flujo rápido: creá el proyecto, elegí su carpeta desde el explorador de la app de escritorio **o** pegá una URL de GitHub y presioná **Analizar**. Si solo hay un repositorio de GitHub, Nexo lo clona una vez dentro de `~/.nexo-workspace/projects/` y después lo analiza. No hace falta definir la descripción ni el objetivo antes: el agente propone ambos cuando encuentra evidencia. Para clonar, Git debe estar instalado y el repositorio debe ser accesible para tu usuario.

Registrá una **carpeta absoluta existente** y un objetivo. El botón ejecuta `claude -p` en modo restringido, con hooks desactivados, salida JSON estructurada y herramientas limitadas a Read, Glob y Grep, sin MCP adicional. No permite herramientas de edición o shell en ese análisis. Los resultados son sugerencias revisables. La respuesta se valida antes de guardarla; el perfil conserva el resumen del último análisis. Un análisis dura como máximo 5 minutos.

Si el CLI no está en el PATH, definí `NEXO_CLAUDE_BIN` con la ruta al ejecutable nativo. Las instalaciones npm que usan `claude.cmd` en Windows deben migrar al CLI nativo o usar el MCP desde Claude Code. La app informa los errores de instalación y autenticación. La generación real requiere tu equipo y cuenta: las pruebas del repositorio usan un CLI simulado.

El repositorio de GitHub se guarda como enlace. Esta versión no clona automáticamente, no sincroniza GitHub Issues, no inspecciona otros equipos y no ejecuta código del proyecto desde las tarjetas.

## Escritorio

```sh
npm install
npm run desktop
```

Electron abre el servicio en un puerto local disponible, con aislamiento de contexto y sin Node.js en la interfaz. Comparte el directorio de datos con `npm start` y el MCP. Incluye una API aislada y mínima para elegir carpetas locales desde el escritorio, sin exponer Node.js a la interfaz. La app debe abrirse desde un entorno con Claude Code en el PATH para usar el análisis.

Para generar un instalador en tu propio sistema:

```sh
npm run build:desktop
```

El instalador aparece en `release/` (NSIS en Windows, DMG en macOS, AppImage en Linux). También se generó un paquete portable Windows x64: descomprimí todo el ZIP y ejecutá `Nexo.exe`, sin moverlo fuera de su carpeta. El portable no está firmado y no se pudo ejecutar en Windows desde este entorno Linux. Se requiere Node.js instalado para ejecutar el MCP por stdio incluso desde la app empaquetada.

## Pruebas

```sh
npm test
```

Verifican perfiles y tareas, validación de importaciones, persistencia, aislamiento de API local, protocolo MCP compartido con HTTP y manejo del análisis de Claude (incluido un CLI simulado).

## Arquitectura

- `dist/`: interfaz web sin dependencias, manifest y service worker.
- `dist/domain.js`: operaciones y validación compartidas por navegador y servidor.
- `local/store.mjs`: persistencia con lock de procesos y escritura atómica.
- `local/server.mjs`: servicio HTTP ligado a loopback; valida Host, Origin y un token efímero por sesión.
- `local/mcp.mjs`: JSON-RPC MCP por stdio; nunca imprime logs en stdout.
- `local/analysis.mjs`: integración con Claude Code CLI.
- `desktop/main.cjs`: contenedor Electron.

## Alcance y próximos servicios externos

Nexo ya cubre en local sesiones y dependencias. La interfaz local y el MCP están sincronizados porque ambos operan sobre el mismo `workspace.json`; no hay una cola ni una copia secundaria.

La sincronización entre equipos o con la web publicada requiere un servicio remoto, autenticación y una política de conflictos. La integración bidireccional con GitHub Issues requiere una GitHub App u OAuth/PAT con permisos del repositorio. No se implementan con credenciales implícitas ni se almacenan tokens en `workspace.json`. Cuando se defina el proveedor de identidad, hosting y permisos, estos servicios se pueden añadir sin cambiar el modelo local.

No hay porcentajes de avance inferidos por IA: el progreso es la proporción de tareas aceptadas que marcaste como terminadas.
