import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { emptyState, validateState, applyOperation } from '../dist/domain.js';
export const dataDirectory = () => path.resolve(process.env.NEXO_DATA_DIR || path.join(os.homedir(), '.nexo-workspace'));
export class Store {
  constructor(dir = dataDirectory()) { this.dir = dir; this.file = path.join(dir, 'workspace.json'); fs.mkdirSync(dir,{recursive:true,mode:0o700}); }
  read() { if (!fs.existsSync(this.file)) return emptyState(); return validateState(JSON.parse(fs.readFileSync(this.file,'utf8'))); }
  locked(fn) {
    const lock = this.file + '.lock'; const start = Date.now(); let fd;
    while (fd === undefined) { try { fd = fs.openSync(lock,'wx',0o600); } catch(e) { if(e.code !== 'EEXIST') throw e; if(Date.now()-start>3500) throw Error('El espacio está ocupado. Reintentá; si se interrumpió un proceso, revisá workspace.json.lock.'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20); } }
    try { return fn(); } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
  }
  write(s) { validateState(s); const tmp = this.file + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp,JSON.stringify(s,null,2),{mode:0o600}); fs.renameSync(tmp,this.file); return s; }
  operate(op) { return this.locked(() => this.write(applyOperation(this.read(),op))); }
  replace(state) { return this.locked(() => { const current=this.read(); const s=structuredClone(validateState(state)); s.revision=(current.revision||0)+1; if(fs.existsSync(this.file)) fs.copyFileSync(this.file,this.file+'.backup'); return this.write(s); }); }
}
