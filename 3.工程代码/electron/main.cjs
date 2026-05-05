const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function getConfigPath() {
  if (process.env.IMIVR_CONFIG_DIR) {
    const configDir = process.env.IMIVR_CONFIG_DIR
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }
    return { dir: configDir, file: path.join(configDir, 'imivr.json') }
  }
  const projectDir = path.join(__dirname, '..', '.imivr')
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true })
  }
  return { dir: projectDir, file: path.join(projectDir, 'imivr.json') }
}

function loadConfig() {
  const { file: configPath } = getConfigPath()
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8')
      const config = JSON.parse(content)
      if (!config.workspaceRoot) {
        const { dir: configDir } = getConfigPath()
        const defaultWorkspaceRoot = path.join(configDir, 'workspaces')
        config.workspaceRoot = defaultWorkspaceRoot
        config.initialized = true
        if (!fs.existsSync(defaultWorkspaceRoot)) {
          fs.mkdirSync(defaultWorkspaceRoot, { recursive: true })
        }
        saveConfig(config)
      }
      return config
    } catch {
      return {}
    }
  }
  const { dir: configDir } = getConfigPath()
  const defaultWorkspaceRoot = path.join(configDir, 'workspaces')
  const initialConfig = {
    created: new Date().toISOString(),
    version: '1.0.0',
    initialized: true,
    workspaceRoot: defaultWorkspaceRoot,
    aiModels: [
      {
        id: '1777648353899',
        name: '问答模型',
        provider: 'finna',
        apiKey: 'app-IkDtFuscGWAj2RHbjRdo7vR7',
        baseURL: 'https://www.finna.com.cn/v1',
        model: 'deepseek-v4-pro',
        isDefault: true
      }
    ],
    aiVoiceModels: [
      {
        id: '1777648395345',
        name: '语音模型',
        provider: 'finna',
        apiKey: 'app-s30gwLaPj0RVLh6bqopm8mG7',
        baseURL: 'https://www.finna.com.cn/v1',
        model: 'qwen3-asr-flash',
        isDefault: true
      }
    ]
  }
  if (!fs.existsSync(defaultWorkspaceRoot)) {
    fs.mkdirSync(defaultWorkspaceRoot, { recursive: true })
  }
  saveConfig(initialConfig)
  return initialConfig
}

function saveConfig(config) {
  const { file: configPath } = getConfigPath()
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

ipcMain.handle('get-config', () => {
  return loadConfig()
})

ipcMain.handle('save-config', (_, config) => {
  saveConfig(config)
  return true
})

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: '选择工作空间根目录',
    buttonLabel: '选择此目录'
  })
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

ipcMain.handle('select-and-set-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: '选择工作空间根目录',
    buttonLabel: '选择此目录'
  })
  if (!result.canceled && result.filePaths.length > 0) {
    const selectedDir = result.filePaths[0]
    const wsDir = path.join(selectedDir, 'workspaces')
    if (!fs.existsSync(wsDir)) {
      fs.mkdirSync(wsDir, { recursive: true })
    }
    const config = loadConfig()
    config.workspaceRoot = wsDir
    config.initialized = true
    config.updated = new Date().toISOString()
    saveConfig(config)
    return wsDir
  }
  return null
})

function hasDirectoryContent(dirPath) {
  try {
    const items = fs.readdirSync(dirPath)
    return items.length > 0
  } catch {
    return false
  }
}

ipcMain.handle('migrate-workspace', async (_, targetPath, confirmed) => {
  try {
    if (!targetPath) {
      return { success: false, error: 'Missing targetPath' }
    }

    const newWsDir = path.join(targetPath, 'workspaces')

    if (fs.existsSync(newWsDir) && hasDirectoryContent(newWsDir) && confirmed !== true) {
      return {
        needsConfirmation: true,
        message: '目标目录下的 workspaces 中已有内容，迁移后该内容将被删除并替换为原工作空间内容，是否继续？'
      }
    }

    if (fs.existsSync(newWsDir)) {
      fs.rmSync(newWsDir, { recursive: true, force: true })
    }

    const config = loadConfig()
    if (fs.existsSync(config.workspaceRoot)) {
      fs.cpSync(config.workspaceRoot, newWsDir, { recursive: true, force: true })
    } else {
      fs.mkdirSync(newWsDir, { recursive: true })
    }

    config.workspaceRoot = newWsDir
    config.initialized = true
    config.updated = new Date().toISOString()
    saveConfig(config)

    return { success: true, workspaceRoot: newWsDir }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('file-read', async (_, filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
})

ipcMain.handle('file-write', async (_, filePath, content) => {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(filePath, content)
  return true
})

ipcMain.handle('file-delete', async (_, filePath) => {
  try {
    fs.unlinkSync(filePath)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('file-exists', async (_, filePath) => {
  return fs.existsSync(filePath)
})

ipcMain.handle('list-files', async (_, prefix) => {
  const files = []
  function traverse(dir) {
    if (!fs.existsSync(dir)) return
    const items = fs.readdirSync(dir, { withFileTypes: true })
    for (const item of items) {
      const fullPath = path.join(dir, item.name)
      if (item.isFile()) {
        files.push(fullPath)
      } else if (item.isDirectory()) {
        traverse(fullPath)
      }
    }
  }
  if (fs.existsSync(prefix)) {
    traverse(prefix)
  }
  return files
})

ipcMain.handle('create-directory', async (_, dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
  return true
})

ipcMain.handle('delete-directory', async (_, dirPath) => {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true })
    }
    return true
  } catch {
    return false
  }
})

ipcMain.handle('directory-exists', async (_, dirPath) => {
  return fs.existsSync(dirPath)
})

ipcMain.handle('get-user-path', () => {
  return app.getPath('home')
})

module.exports = { loadConfig, saveConfig, getConfigPath }