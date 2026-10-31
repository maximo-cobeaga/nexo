import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {analyze} from '../local/analysis.mjs';
test('rechaza carpetas inexistentes y objetivos vacíos antes de ejecutar Claude',async()=>{
 await assert.rejects(analyze({path:'/missing-nexo-project',goal:'MVP'},[],()=>{},()=>{}),/carpeta local/);
 await assert.rejects(analyze({path:os.tmpdir(),goal:''},[],()=>{},()=>{}),/objetivo/);
});
test('muestra un error concreto cuando Claude Code no está instalado',async t=>{
 const old=process.env.NEXO_CLAUDE_BIN;process.env.NEXO_CLAUDE_BIN=path.join(os.tmpdir(),'nonexistent-nexo-claude');t.after(()=>{if(old===undefined)delete process.env.NEXO_CLAUDE_BIN;else process.env.NEXO_CLAUDE_BIN=old;});
 const error=await new Promise(async(resolve,reject)=>{await analyze({path:os.tmpdir(),goal:'MVP'},[],()=>reject(Error('Unexpected success')),resolve);});assert.match(error.message,/No se encontró Claude Code/);
});
test('procesa salida estructurada usando un CLI simulado, sin llamar a servicios de IA',async t=>{
 if(process.platform==='win32')return t.skip('Fixture ejecutable POSIX');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexo-analysis-'));const bin=path.join(dir,'mock-claude');
 fs.writeFileSync(bin,'#!/usr/bin/env node\nconsole.log(JSON.stringify({structured_output:{summary:"Un checkout por completar",tasks:[{title:"Conectar confirmación",description:"Completar el flujo",priority:"high",source:"checkout.js",acceptance:["El pedido se confirma"]}]}}));\n',{mode:0o700});
 const old=process.env.NEXO_CLAUDE_BIN;process.env.NEXO_CLAUDE_BIN=bin;t.after(()=>{if(old===undefined)delete process.env.NEXO_CLAUDE_BIN;else process.env.NEXO_CLAUDE_BIN=old;fs.rmSync(dir,{recursive:true,force:true});});
 const data=await new Promise(async(resolve,reject)=>{await analyze({path:dir,goal:'Completar checkout'},[],resolve,reject);});assert.equal(data.tasks.length,1);assert.equal(data.tasks[0].priority,'high');
});
