const {app,BrowserWindow,shell,dialog,ipcMain}=require('electron');
let localServer;
app.whenReady().then(async()=>{
  const {pathToFileURL}=require('node:url');const path=require('node:path');
  const {startServer}=await import(pathToFileURL(path.join(__dirname,'../local/server.mjs')).href);
  const {Store}=await import(pathToFileURL(path.join(__dirname,'../local/store.mjs')).href);
  const started=await startServer({port:0,store:new Store()});localServer=started.server;
  function open(){
    const win=new BrowserWindow({width:1440,height:940,minWidth:900,minHeight:640,title:'Nexo',backgroundColor:'#171821',autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,preload:path.join(__dirname,'preload.cjs')}});
    win.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\//.test(url))shell.openExternal(url);return {action:'deny'};});
    win.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==started.url){event.preventDefault();if(/^https:\/\//.test(url))shell.openExternal(url);}});
    win.loadURL(started.url);
  }
  ipcMain.handle('nexo:choose-folder',async event=>{const win=BrowserWindow.fromWebContents(event.sender);const result=await dialog.showOpenDialog(win,{title:'Elegí la carpeta del proyecto',properties:['openDirectory','createDirectory']});return result.canceled?null:result.filePaths[0]||null;});
  open();app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)open();});
}).catch(error=>{require('electron').dialog.showErrorBox('Nexo no pudo iniciar',error.message);app.quit();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',()=>localServer?.close());
