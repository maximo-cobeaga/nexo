const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('nexoDesktop',Object.freeze({
  chooseFolder:()=>ipcRenderer.invoke('nexo:choose-folder')
}));
