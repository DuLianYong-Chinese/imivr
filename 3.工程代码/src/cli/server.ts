import express from 'express'
import { createServer } from 'http'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, rmdirSync, cpSync, rmSync, renameSync } from 'fs'
import { spawn } from 'child_process'
import os from 'os'
import openBrowser from 'open'
import { MarkItDown } from 'markitdown-ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const markitdown = new MarkItDown()

function getConfigDir(): string {
  if (process.env.IMIVR_CONFIG_DIR) {
    return process.env.IMIVR_CONFIG_DIR
  }
  const home = os.homedir()
  return join(home, '.imivr')
}

function getConfigFile(): string {
  return join(getConfigDir(), 'imivr.json')
}

function getDefaultWorkspaceRoot(): string {
  return join(getConfigDir(), 'workspaces')
}

function ensureConfigExists(): { configDir: string; configFile: string; workspaceRoot: string } {
  const configDir = getConfigDir()
  const configFile = getConfigFile()
  const defaultWsRoot = getDefaultWorkspaceRoot()

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
  }

  if (!existsSync(configFile)) {
    if (!existsSync(defaultWsRoot)) {
      mkdirSync(defaultWsRoot, { recursive: true })
    }
    const initialConfig = {
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      version: '1.0.0',
      initialized: true,
      workspaceRoot: defaultWsRoot,
      aiModels: [],
      aiVoiceModels: [],
    }
    writeFileSync(configFile, JSON.stringify(initialConfig, null, 2))
  }

  let workspaceRoot = defaultWsRoot
  try {
    const config = JSON.parse(readFileSync(configFile, 'utf-8'))
    if (config.workspaceRoot && existsSync(config.workspaceRoot)) {
      workspaceRoot = config.workspaceRoot
    }
  } catch {}

  return { configDir, configFile, workspaceRoot }
}

function readConfig(): any {
  const configFile = getConfigFile()
  if (existsSync(configFile)) {
    return JSON.parse(readFileSync(configFile, 'utf-8'))
  }
  return {}
}

function writeConfig(config: any): void {
  const configFile = getConfigFile()
  const configDir = getConfigDir()
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
  }
  const tempFile = configFile + '.tmp'
  writeFileSync(tempFile, JSON.stringify(config, null, 2))
  renameSync(tempFile, configFile)
}

function hasDirectoryContent(dirPath: string): boolean {
  try {
    return readdirSync(dirPath).length > 0
  } catch {
    return false
  }
}

const PS_SCRIPT_PATH = join(os.tmpdir(), 'imivr-select-folder.ps1')
const PS_SCRIPT_CONTENT = `
chcp 65001 | Out-Null
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
$folderBrowser = New-Object System.Windows.Forms.FolderBrowserDialog
$folderBrowser.Description = "选择工作目录"
$folderBrowser.RootFolder = "MyComputer"
$folderBrowser.ShowNewFolderButton = $true
$result = $folderBrowser.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    [System.Console]::WriteLine($folderBrowser.SelectedPath)
} else {
    [System.Console]::WriteLine("")
}
`
const bom = Buffer.from([0xEF, 0xBB, 0xBF])
const psContent = Buffer.concat([bom, Buffer.from(PS_SCRIPT_CONTENT, 'utf8')])
writeFileSync(PS_SCRIPT_PATH, psContent)

async function selectFolderWithPowerShell(): Promise<string | null> {
  return new Promise((resolve) => {
    const ps = spawn('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS_SCRIPT_PATH,
    ], { windowsHide: false })

    let output = ''
    let resolved = false

    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; ps.kill(); resolve(null) }
    }, 60000)

    ps.stdout.on('data', (data: Buffer) => { output += data.toString('utf8') })
    ps.on('close', () => {
      clearTimeout(timeout)
      if (resolved) return
      resolved = true
      const lines = output.trim().split(/\r?\n/)
      const selectedPath = lines.find(line => {
        const trimmed = line.trim()
        return trimmed.length > 0 && /^[A-Za-z]:\\/.test(trimmed)
      })
      resolve(selectedPath ? selectedPath.trim() : null)
    })
    ps.on('error', () => { clearTimeout(timeout); if (!resolved) { resolved = true; resolve(null) } })
  })
}

function cleanResumeText(text: string): string {
  if (!text) return ''
  let cleaned = text
  cleaned = cleaned.replace(/[a-f0-9]{20,}[A-Za-z0-9]{10,}~~/g, '')
  cleaned = cleaned.replace(/[\uE000-\uF8FF]/g, '-')
  cleaned = cleaned.replace(/^[\s~]+$/gm, '')
  cleaned = cleaned.replace(/[~`!@#$%^&*()_+=\[\]{}|;':",./<>?]{5,}/g, '')
  cleaned = cleaned.replace(/\b[a-f0-9]{16,}\b/gi, '')
  cleaned = cleaned.replace(/^.*[a-z0-9]{15,}.*$/gim, '')
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ')
  cleaned = cleaned.split('\n').map(line => {
    line = line.replace(/^[\s\uE000-\uF8FF~`!@#$%^&*()_+=\[\]{}|;':",./<>?]+/, '')
    line = line.replace(/[ \t]{2,}/g, ' ').trim()
    return line
  }).filter(line => line.length > 0).join('\n')
  cleaned = cleaned.replace(/\n{2,}/g, '\n')
  return cleaned.trim()
}

export interface StartOptions {
  port: number
  open: boolean
}

export async function startServer(options: StartOptions): Promise<void> {
  const { configDir, configFile, workspaceRoot } = ensureConfigExists()
  let currentWorkspaceRoot = workspaceRoot

  const app = express()

  app.use(express.json({ limit: '50mb' }))

  app.use('/api/fs', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') { res.status(204).end(); return }
    next()
  })

  app.get('/api/fs/config', (_req, res) => {
    const content = readFileSync(configFile, 'utf-8')
    res.json(JSON.parse(content))
  })

  app.post('/api/fs/config', (req, res) => {
    try {
      writeConfig(req.body)
      if (req.body.workspaceRoot) {
        currentWorkspaceRoot = req.body.workspaceRoot
      }
      res.json({ success: true })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  app.post('/api/fs/select-folder-dialog', async (_req, res) => {
    const selectedPath = await selectFolderWithPowerShell()
    res.json({ path: selectedPath || null })
  })

  app.post('/api/fs/select-workspace', (req, res) => {
    const { workspaceRoot: wsRoot } = req.body
    if (wsRoot) {
      if (!existsSync(wsRoot)) mkdirSync(wsRoot, { recursive: true })
      const config = readConfig()
      config.workspaceRoot = wsRoot
      config.initialized = true
      config.updated = new Date().toISOString()
      writeConfig(config)
      currentWorkspaceRoot = wsRoot
      res.json({ success: true, workspaceRoot: wsRoot })
    } else {
      res.status(400).json({ error: 'Invalid workspace root' })
    }
  })

  app.post('/api/fs/migrate-workspace', (req, res) => {
    try {
      const { targetPath, confirmed } = req.body
      if (!targetPath) { res.status(400).json({ error: 'Missing targetPath' }); return }

      const newWsDir = targetPath
      if (existsSync(newWsDir) && hasDirectoryContent(newWsDir) && confirmed !== true) {
        res.json({
          needsConfirmation: true,
          message: '目标目录中已有内容，迁移后该内容将被删除并替换为原工作空间内容，是否继续？',
        })
        return
      }

      if (existsSync(newWsDir)) rmSync(newWsDir, { recursive: true, force: true })
      if (existsSync(currentWorkspaceRoot)) {
        cpSync(currentWorkspaceRoot, newWsDir, { recursive: true, force: true })
      } else {
        mkdirSync(newWsDir, { recursive: true })
      }

      const config = readConfig()
      config.workspaceRoot = newWsDir
      config.initialized = true
      config.updated = new Date().toISOString()
      writeConfig(config)
      currentWorkspaceRoot = newWsDir

      res.json({ success: true, workspaceRoot: newWsDir, message: '工作目录迁移成功' })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  app.get('/api/fs/workspace-root', (_req, res) => {
    let wsRoot = currentWorkspaceRoot
    try {
      const config = readConfig()
      if (config.workspaceRoot) wsRoot = config.workspaceRoot
    } catch {}
    res.json({ workspaceRoot: wsRoot, initialized: existsSync(wsRoot) })
  })

  app.get('/api/fs/read', (req, res) => {
    const relativePath = decodeURIComponent(req.query.path as string || '')
    const filePath = join(currentWorkspaceRoot, relativePath)
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8')
      res.json({ content })
    } else {
      res.status(404).json({ error: 'File not found' })
    }
  })

  app.post('/api/fs/write', (req, res) => {
    const { path: relativePath, content } = req.body
    const filePath = join(currentWorkspaceRoot, relativePath)
    const dir = resolve(filePath, '..')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(filePath, content, 'utf-8')
    res.json({ success: true })
  })

  app.post('/api/fs/delete', (req, res) => {
    const { path: relativePath } = req.body
    const filePath = join(currentWorkspaceRoot, relativePath)
    if (existsSync(filePath)) unlinkSync(filePath)
    res.json({ success: true })
  })

  app.get('/api/fs/exists', (req, res) => {
    const relativePath = decodeURIComponent(req.query.path as string || '')
    const targetPath = join(currentWorkspaceRoot, relativePath)
    res.json({ exists: existsSync(targetPath) })
  })

  app.get('/api/fs/config-path', (_req, res) => {
    res.json({ path: configFile, dir: configDir, workspaceRoot: currentWorkspaceRoot })
  })

  app.post('/api/fs/reset', (_req, res) => {
    const defaultWsRoot = getDefaultWorkspaceRoot()
    const initialConfig = {
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      version: '1.0.0',
      initialized: true,
      workspaceRoot: defaultWsRoot,
      aiModels: [],
      aiVoiceModels: [],
    }
    if (!existsSync(defaultWsRoot)) mkdirSync(defaultWsRoot, { recursive: true })
    writeConfig(initialConfig)
    currentWorkspaceRoot = defaultWsRoot
    res.json({ success: true })
  })

  app.get('/api/fs/list', (req, res) => {
    const relativePrefix = decodeURIComponent(req.query.prefix as string || '')
    const prefix = join(currentWorkspaceRoot, relativePrefix)
    const files: string[] = []

    function traverse(dir: string) {
      if (!existsSync(dir)) return
      const items = readdirSync(dir, { withFileTypes: true })
      for (const item of items) {
        const fullPath = join(dir, item.name)
        files.push(resolve(currentWorkspaceRoot, fullPath).replace(currentWorkspaceRoot + '\\', '').replace(/\\/g, '/'))
        if (item.isDirectory()) traverse(fullPath)
      }
    }

    traverse(prefix)
    res.json(files)
  })

  app.post('/api/fs/mkdir', (req, res) => {
    try {
      const { path: relativePath } = req.body
      if (!relativePath || !currentWorkspaceRoot) throw new Error('缺少目录路径或工作目录未设置')
      const dirPath = join(currentWorkspaceRoot, relativePath)
      if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true })
      res.json({ success: true })
    } catch (error: any) {
      res.status(500).json({ error: error.message || '创建目录失败' })
    }
  })

  app.post('/api/fs/rmdir', (req, res) => {
    try {
      const { path: relativePath } = req.body
      if (!relativePath || !currentWorkspaceRoot) throw new Error('缺少目录路径或工作目录未设置')
      const dirPath = join(currentWorkspaceRoot, relativePath)

      if (existsSync(dirPath)) {
        function deleteAllFiles(dir: string) {
          const items = readdirSync(dir, { withFileTypes: true })
          for (const item of items) {
            const fullPath = join(dir, item.name)
            if (item.isDirectory()) deleteAllFiles(fullPath)
            else unlinkSync(fullPath)
          }
        }
        function deleteEmptyDirs(dir: string) {
          const items = readdirSync(dir, { withFileTypes: true })
          for (const item of items) {
            if (item.isDirectory()) {
              const fullPath = join(dir, item.name)
              deleteEmptyDirs(fullPath)
              rmdirSync(fullPath)
            }
          }
        }
        deleteAllFiles(dirPath)
        deleteEmptyDirs(dirPath)
        rmdirSync(dirPath)
      }
      res.json({ success: true })
    } catch (error: any) {
      res.status(500).json({ error: error.message || '删除目录失败' })
    }
  })

  app.post('/api/fs/parse-resume', async (req, res) => {
    try {
      const { filePath, fileType, base64Content } = req.body
      let tempFilePath: string | null = null

      if (base64Content) {
        const buffer = Buffer.from(base64Content, 'base64')
        const tempDir = join(os.tmpdir(), 'imivr-resumes')
        if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true })
        const ext = fileType === 'application/pdf' ? '.pdf' : '.docx'
        tempFilePath = join(tempDir, `resume-${Date.now()}${ext}`)
        writeFileSync(tempFilePath, buffer)
      } else if (filePath) {
        tempFilePath = join(currentWorkspaceRoot, filePath)
        if (!existsSync(tempFilePath)) { res.status(404).json({ error: 'File not found' }); return }
      } else {
        res.status(400).json({ error: 'No file content provided' }); return
      }

      const result = await markitdown.convert(tempFilePath)

      if (base64Content && tempFilePath && tempFilePath.includes(os.tmpdir())) {
        try { unlinkSync(tempFilePath) } catch {}
      }

      if (!result || !result.text_content) {
        res.status(500).json({ error: 'Failed to parse document' }); return
      }

      const text = cleanResumeText(result.text_content)
      res.json({ success: true, text, markdown: text })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  const webDist = resolve(__dirname, '../../dist/web')
  if (existsSync(webDist)) {
    app.use(express.static(webDist))
    app.use((_req, res) => {
      res.sendFile(join(webDist, 'index.html'))
    })
  }

  const server = createServer(app)

  server.listen(options.port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${options.port}`
    console.log(`\n  🎯 我是面试官 已启动！`)
    console.log(`  📍 本地地址: ${url}\n`)

    if (options.open) {
      openBrowser(url)
    }
  })
}
