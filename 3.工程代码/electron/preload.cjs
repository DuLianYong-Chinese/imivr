const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectAndSetDirectory: () => ipcRenderer.invoke('select-and-set-directory'),
  migrateWorkspace: (targetPath, confirmed) => ipcRenderer.invoke('migrate-workspace', targetPath, confirmed),
  readFile: (path) => ipcRenderer.invoke('file-read', path),
  writeFile: (path, content) => ipcRenderer.invoke('file-write', path, content),
  deleteFile: (path) => ipcRenderer.invoke('file-delete', path),
  fileExists: (path) => ipcRenderer.invoke('file-exists', path),
  listFiles: (prefix) => ipcRenderer.invoke('list-files', prefix),
  createDirectory: (path) => ipcRenderer.invoke('create-directory', path),
  deleteDirectory: (path) => ipcRenderer.invoke('delete-directory', path),
  directoryExists: (path) => ipcRenderer.invoke('directory-exists', path),
  getUserPath: () => ipcRenderer.invoke('get-user-path')
})