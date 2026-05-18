import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import os from 'os'
import { MarkItDown } from 'markitdown-ts'

// 初始化 markitdown 实例
const markitdown = new MarkItDown()

// 配置文件路径：环境变量 IMIVR_CONFIG_DIR > 项目目录/.imivr
function getConfigPath() {
  if (process.env.IMIVR_CONFIG_DIR) {
    return {
      dir: process.env.IMIVR_CONFIG_DIR,
      file: path.join(process.env.IMIVR_CONFIG_DIR, 'imivr.json')
    }
  }
  const projectDir = path.join(process.cwd(), '.imivr')
  return {
    dir: projectDir,
    file: path.join(projectDir, 'imivr.json')
  }
}

const configPath = getConfigPath()
const DEFAULT_CONFIG_DIR = configPath.dir
const DEFAULT_CONFIG_FILE = configPath.file

const DEFAULT_WORKSPACE_ROOT = path.join(DEFAULT_CONFIG_DIR, 'workspaces')
let currentWorkspaceRoot = DEFAULT_WORKSPACE_ROOT

function ensureConfigExists() {
  try {
    if (!fs.existsSync(DEFAULT_CONFIG_DIR)) {
      fs.mkdirSync(DEFAULT_CONFIG_DIR, { recursive: true })
      console.log('[vite-plugin-fs] 创建配置目录:', DEFAULT_CONFIG_DIR)
    }

    if (!fs.existsSync(DEFAULT_CONFIG_FILE)) {
      const defaultWorkspaceRoot = path.join(DEFAULT_CONFIG_DIR, 'workspaces')
      const initialConfig = {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: '1.0.0',
        initialized: true,
        workspaceRoot: defaultWorkspaceRoot,
        aiModels: [
          {
            id: '1777648353899',
            name: '问答模型',
            provider: 'finna',
            apiKey: 'app-9VVlZ3bB9je9BI7NkWBVxriV',
            baseURL: 'https://www.finna.com.cn/v1',
            model: 'deepseek-v4-flash',
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
      fs.writeFileSync(DEFAULT_CONFIG_FILE, JSON.stringify(initialConfig, null, 2))
      currentWorkspaceRoot = defaultWorkspaceRoot
      console.log('[vite-plugin-fs] 创建配置文件:', DEFAULT_CONFIG_FILE)
      console.log('[vite-plugin-fs] 默认工作目录:', defaultWorkspaceRoot)
    } else {
      try {
        const config = JSON.parse(fs.readFileSync(DEFAULT_CONFIG_FILE, 'utf-8'))
        if (config.workspaceRoot && fs.existsSync(config.workspaceRoot)) {
          currentWorkspaceRoot = config.workspaceRoot
          console.log('[vite-plugin-fs] 工作目录:', currentWorkspaceRoot)
        } else {
          const defaultWorkspaceRoot = path.join(DEFAULT_CONFIG_DIR, 'workspaces')
          config.workspaceRoot = defaultWorkspaceRoot
          config.initialized = true
          config.updated = new Date().toISOString()
          if (!fs.existsSync(defaultWorkspaceRoot)) {
            fs.mkdirSync(defaultWorkspaceRoot, { recursive: true })
          }
          const tempFile = DEFAULT_CONFIG_FILE + '.tmp'
          fs.writeFileSync(tempFile, JSON.stringify(config, null, 2))
          fs.renameSync(tempFile, DEFAULT_CONFIG_FILE)
          currentWorkspaceRoot = defaultWorkspaceRoot
          console.log('[vite-plugin-fs] workspaceRoot无效或不存在，重置为默认:', defaultWorkspaceRoot)
        }
      } catch (e) {
        console.error('[vite-plugin-fs] 读取配置失败:', e)
      }
    }
  } catch (error) {
    console.error('[vite-plugin-fs] 确保配置存在失败:', error)
  }
}

function hasDirectoryContent(dirPath) {
  try {
    const items = fs.readdirSync(dirPath)
    return items.length > 0
  } catch {
    return false
  }
}

// 使用 PowerShell 打开文件夹选择对话框
const PS_SCRIPT_PATH = path.join(os.tmpdir(), 'imivr-select-folder.ps1')
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
fs.writeFileSync(PS_SCRIPT_PATH, psContent)

async function selectFolderWithPowerShell() {
  return new Promise((resolve) => {
    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', PS_SCRIPT_PATH
    ], {
      windowsHide: false
    })

    let output = ''
    let resolved = false

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        console.error('[vite-plugin-fs] PowerShell 超时，强制终止')
        ps.kill()
        resolve(null)
      }
    }, 60000)

    ps.stdout.on('data', (data) => {
      output += data.toString('utf8')
    })

    ps.stderr.on('data', (data) => {
      console.error('[vite-plugin-fs] PowerShell stderr:', data.toString('utf8'))
    })

    ps.on('close', (code) => {
      clearTimeout(timeout)
      if (resolved) return
      resolved = true
      const lines = output.trim().split(/\r?\n/)
      const selectedPath = lines.find(line => {
        const trimmed = line.trim()
        return trimmed.length > 0 && /^[A-Za-z]:\\/.test(trimmed)
      })
      if (selectedPath) {
        resolve(selectedPath.trim())
        return
      }
      console.log('[vite-plugin-fs] No valid path selected, returning null')
      resolve(null)
    })

    ps.on('error', (err) => {
      clearTimeout(timeout)
      if (resolved) return
      resolved = true
      console.error('[vite-plugin-fs] Failed to spawn PowerShell:', err)
      resolve(null)
    })
  })
}

// 处理请求体的辅助函数
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (e) {
        resolve({})
      }
    })
    req.on('error', reject)
  })
}

// Vite 插件
export default function vitePluginFs() {
  return {
    name: 'vite-plugin-fs',
    configureServer(server) {
      console.log('[vite-plugin-fs] 插件已加载')

      // 确保配置启动时就存在
      ensureConfigExists()

      // 注册中间件 - 必须在 Vite 内部中间件之前
      server.middlewares.use('/api/fs', async (req, res, next) => {
        console.log('[vite-plugin-fs] 收到请求:', req.method, req.url)

        // 设置 CORS 头
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }

        // 解析路径，去掉 /api/fs 前缀
        const urlPath = req.url || '/'
        const apiPath = urlPath.split('?')[0].replace(/^\//, '')

        console.log('[vite-plugin-fs] 处理路径:', apiPath)

        try {
          // 读取配置文件
          if (apiPath === 'config' && req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json')
            const content = fs.readFileSync(DEFAULT_CONFIG_FILE, 'utf-8')
            res.end(content)
            return
          }

          // 保存配置文件
          if (apiPath === 'config' && req.method === 'POST') {
            try {
              console.log('[vite-plugin-fs] 开始保存配置...')
              const config = await parseRequestBody(req)
              console.log('[vite-plugin-fs] 接收到的配置数据:', Object.keys(config))
              
              // 确保目录存在
              if (!fs.existsSync(DEFAULT_CONFIG_DIR)) {
                console.log('[vite-plugin-fs] 创建配置目录:', DEFAULT_CONFIG_DIR)
                fs.mkdirSync(DEFAULT_CONFIG_DIR, { recursive: true })
              }
              
              // 先写入临时文件，然后重命名（原子操作）
              const tempFile = DEFAULT_CONFIG_FILE + '.tmp'
              fs.writeFileSync(tempFile, JSON.stringify(config, null, 2))
              fs.renameSync(tempFile, DEFAULT_CONFIG_FILE)
              
              console.log('[vite-plugin-fs] 配置保存成功:', DEFAULT_CONFIG_FILE)
              
              if (config.workspaceRoot) {
                currentWorkspaceRoot = config.workspaceRoot
              }
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true }))
            } catch (error) {
              console.error('[vite-plugin-fs] 保存配置失败:', error)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: error.message, stack: error.stack }))
            }
            return
          }

          // 打开文件夹选择对话框
          if (apiPath === 'select-folder-dialog' && req.method === 'POST') {
            console.log('[vite-plugin-fs] 打开文件夹选择对话框')
            const selectedPath = await selectFolderWithPowerShell()
            console.log('[vite-plugin-fs] 选择的目录:', selectedPath)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ path: selectedPath || null }))
            return
          }

          // 选择工作目录
          if (apiPath === 'select-workspace' && req.method === 'POST') {
            const { workspaceRoot } = await parseRequestBody(req)
            if (workspaceRoot) {
              const wsDir = path.join(workspaceRoot, 'workspaces')
              if (!fs.existsSync(wsDir)) {
                fs.mkdirSync(wsDir, { recursive: true })
              }
              const config = JSON.parse(fs.readFileSync(DEFAULT_CONFIG_FILE, 'utf-8'))
              config.workspaceRoot = wsDir
              config.initialized = true
              config.updated = new Date().toISOString()
              fs.writeFileSync(DEFAULT_CONFIG_FILE, JSON.stringify(config, null, 2))
              currentWorkspaceRoot = wsDir
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, workspaceRoot: wsDir }))
            } else {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Invalid workspace root' }))
            }
            return
          }

          // 迁移工作目录
          if (apiPath === 'migrate-workspace' && req.method === 'POST') {
            try {
              const { targetPath, confirmed } = await parseRequestBody(req)
              if (!targetPath) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'Missing targetPath' }))
                return
              }

              const newWsDir = path.join(targetPath, 'workspaces')

              if (fs.existsSync(newWsDir) && hasDirectoryContent(newWsDir) && confirmed !== true) {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({
                  needsConfirmation: true,
                  message: '目标目录下的 workspaces 中已有内容，迁移后该内容将被删除并替换为原工作空间内容，是否继续？'
                }))
                return
              }

              if (fs.existsSync(newWsDir)) {
                fs.rmSync(newWsDir, { recursive: true, force: true })
              }

              if (fs.existsSync(currentWorkspaceRoot)) {
                fs.cpSync(currentWorkspaceRoot, newWsDir, { recursive: true, force: true })
                console.log('[vite-plugin-fs] 已复制 workspaces:', currentWorkspaceRoot, '->', newWsDir)
              } else {
                fs.mkdirSync(newWsDir, { recursive: true })
                console.log('[vite-plugin-fs] 旧 workspaces 不存在，创建空目录:', newWsDir)
              }

              const config = JSON.parse(fs.readFileSync(DEFAULT_CONFIG_FILE, 'utf-8'))
              config.workspaceRoot = newWsDir
              config.initialized = true
              config.updated = new Date().toISOString()
              fs.writeFileSync(DEFAULT_CONFIG_FILE, JSON.stringify(config, null, 2))
              currentWorkspaceRoot = newWsDir

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({
                success: true,
                workspaceRoot: newWsDir,
                message: '工作目录迁移成功'
              }))
            } catch (error) {
              console.error('[vite-plugin-fs] 迁移工作目录失败:', error)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: error.message }))
            }
            return
          }

          // 获取工作目录 - 始终从配置文件读取最新值
          if (apiPath === 'workspace-root' && req.method === 'GET') {
            let workspaceRoot = currentWorkspaceRoot
            try {
              const config = JSON.parse(fs.readFileSync(DEFAULT_CONFIG_FILE, 'utf-8'))
              if (config.workspaceRoot) {
                workspaceRoot = config.workspaceRoot
                currentWorkspaceRoot = workspaceRoot // 同步内存中的值
              }
            } catch (e) {
              console.error('[vite-plugin-fs] 读取工作目录失败:', e)
            }
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              workspaceRoot: workspaceRoot,
              initialized: fs.existsSync(workspaceRoot)
            }))
            return
          }

          // 读取文件（相对于工作目录）
          if (apiPath === 'read' && req.method === 'GET') {
            const url = new URL(req.url, `http://${req.headers.host}`)
            const relativePath = decodeURIComponent(url.searchParams.get('path') || '')
            const filePath = path.join(currentWorkspaceRoot, relativePath)
            console.log('[vite-plugin-fs] read 请求:', relativePath, '->', filePath, '存在:', fs.existsSync(filePath))
            if (fs.existsSync(filePath)) {
              const content = fs.readFileSync(filePath, 'utf-8')
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ content }))
            } else {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'File not found' }))
            }
            return
          }

          // 写入文件（相对于工作目录）
          if (apiPath === 'write' && req.method === 'POST') {
            const { path: relativePath, content } = await parseRequestBody(req)
            const filePath = path.join(currentWorkspaceRoot, relativePath)
            const dir = path.dirname(filePath)
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true })
            }
            fs.writeFileSync(filePath, content, 'utf-8')
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true }))
            return
          }

          // 删除文件（相对于工作目录）
          if (apiPath === 'delete' && req.method === 'POST') {
            const { path: relativePath } = await parseRequestBody(req)
            const filePath = path.join(currentWorkspaceRoot, relativePath)
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath)
            }
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true }))
            return
          }

          // 检查文件/目录是否存在（相对于工作目录）
          if (apiPath === 'exists' && req.method === 'GET') {
            const url = new URL(req.url, `http://${req.headers.host}`)
            const relativePath = decodeURIComponent(url.searchParams.get('path') || '')
            const targetPath = path.join(currentWorkspaceRoot, relativePath)
            const exists = fs.existsSync(targetPath)
            console.log('[vite-plugin-fs] exists 请求:', relativePath, '->', targetPath, '结果:', exists)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ exists }))
            return
          }

          // 获取配置路径
          if (apiPath === 'config-path' && req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              path: DEFAULT_CONFIG_FILE,
              dir: DEFAULT_CONFIG_DIR,
              workspaceRoot: currentWorkspaceRoot
            }))
            return
          }

          // 重置配置
          if (apiPath === 'reset' && req.method === 'POST') {
            const defaultWorkspaceRoot = path.join(DEFAULT_CONFIG_DIR, 'workspaces')
            const initialConfig = {
              created: new Date().toISOString(),
              updated: new Date().toISOString(),
              version: '1.0.0',
              initialized: true,
              workspaceRoot: defaultWorkspaceRoot,
              aiModels: [
                {
                  id: '1777648353899',
                  name: '问答模型',
                  provider: 'finna',
                  apiKey: 'app-9VVlZ3bB9je9BI7NkWBVxriV',
                  baseURL: 'https://www.finna.com.cn/v1',
                  model: 'deepseek-v4-flash',
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
            fs.writeFileSync(DEFAULT_CONFIG_FILE, JSON.stringify(initialConfig, null, 2))
            currentWorkspaceRoot = defaultWorkspaceRoot
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true }))
            return
          }

          // 列出文件（相对于工作目录）
          if (apiPath === 'list' && req.method === 'GET') {
            const url = new URL(req.url, `http://${req.headers.host}`)
            const relativePrefix = decodeURIComponent(url.searchParams.get('prefix') || '')
            const prefix = path.join(currentWorkspaceRoot, relativePrefix)
            console.log('[vite-plugin-fs] list 请求:', relativePrefix, '->', prefix)
            const files = []

            function traverse(dir) {
              if (!fs.existsSync(dir)) {
                console.log('[vite-plugin-fs] 目录不存在:', dir)
                return
              }
              const items = fs.readdirSync(dir, { withFileTypes: true })
              console.log('[vite-plugin-fs] 读取目录:', dir, '项目数:', items.length)
              for (const item of items) {
                const fullPath = path.join(dir, item.name)
                // 返回所有路径（文件和目录），用于支持目录遍历
                files.push(path.relative(currentWorkspaceRoot, fullPath))
                if (item.isDirectory()) {
                  traverse(fullPath)
                }
              }
            }

            traverse(prefix)
            console.log('[vite-plugin-fs] 返回文件列表:', files)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(files))
            return
          }

          // 创建目录（相对于工作目录）
          if (apiPath === 'mkdir' && req.method === 'POST') {
            try {
              const { path: relativePath } = await parseRequestBody(req)
              
              if (!relativePath || !currentWorkspaceRoot) {
                throw new Error('缺少目录路径或工作目录未设置')
              }
              
              const dirPath = path.join(currentWorkspaceRoot, relativePath)
              console.log('[vite-plugin-fs] 创建目录:', dirPath)
              
              if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true })
              }
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true }))
            } catch (error) {
              console.error('[vite-plugin-fs] 创建目录失败:', error)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: error.message || '创建目录失败' }))
            }
            return
          }

          // 删除目录（相对于工作目录）
          if (apiPath === 'rmdir' && req.method === 'POST') {
            try {
              const { path: relativePath } = await parseRequestBody(req)
              
              if (!relativePath || !currentWorkspaceRoot) {
                throw new Error('缺少目录路径或工作目录未设置')
              }
              
              const dirPath = path.join(currentWorkspaceRoot, relativePath)
              console.log('[vite-plugin-fs] rmdir 请求开始, relativePath:', relativePath)
              
              if (fs.existsSync(dirPath)) {
                // Windows下Vite文件监视器可能锁定目录，导致 rmSync(recursive) 无法完全删除
                // 解决策略：先删除所有文件（不会被锁），再从叶子向根逐层删除空目录
                function deleteAllFiles(dir) {
                  const items = fs.readdirSync(dir, { withFileTypes: true })
                  for (const item of items) {
                    const fullPath = path.join(dir, item.name)
                    if (item.isDirectory()) {
                      deleteAllFiles(fullPath)
                    } else {
                      fs.unlinkSync(fullPath)
                    }
                  }
                }
                function deleteEmptyDirs(dir) {
                  const items = fs.readdirSync(dir, { withFileTypes: true })
                  for (const item of items) {
                    if (item.isDirectory()) {
                      const fullPath = path.join(dir, item.name)
                      deleteEmptyDirs(fullPath)
                      fs.rmdirSync(fullPath)
                    }
                  }
                }

                deleteAllFiles(dirPath)
                deleteEmptyDirs(dirPath)
                fs.rmdirSync(dirPath)
                console.log('[vite-plugin-fs] 删除完成')
              } else {
                console.log('[vite-plugin-fs] 目录不存在, 跳过删除')
              }
              
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true }))
            } catch (error) {
              console.error('[vite-plugin-fs] 删除目录失败:', error)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: error.message || '删除目录失败' }))
            }
            return
          }

          // 解析简历文件（PDF/Word）
          if (apiPath === 'parse-resume' && req.method === 'POST') {
            try {
              const { filePath, fileType, base64Content } = await parseRequestBody(req)
              
              let buffer
              let tempFilePath = null
              
              // 如果提供了 base64 内容，先保存到临时文件
              if (base64Content) {
                console.log('[vite-plugin-fs] 解析简历（base64），类型:', fileType)
                buffer = Buffer.from(base64Content, 'base64')
                
                // 创建临时文件
                const tempDir = path.join(os.tmpdir(), 'imivr-resumes')
                if (!fs.existsSync(tempDir)) {
                  fs.mkdirSync(tempDir, { recursive: true })
                }
                const ext = fileType === 'application/pdf' ? '.pdf' : '.docx'
                tempFilePath = path.join(tempDir, `resume-${Date.now()}${ext}`)
                fs.writeFileSync(tempFilePath, buffer)
                console.log('[vite-plugin-fs] 临时文件:', tempFilePath)
              } else if (filePath) {
                // 否则从文件读取
                tempFilePath = path.join(currentWorkspaceRoot, filePath)
                console.log('[vite-plugin-fs] 解析简历文件:', tempFilePath, '类型:', fileType)
                
                if (!fs.existsSync(tempFilePath)) {
                  res.statusCode = 404
                  res.end(JSON.stringify({ error: 'File not found' }))
                  return
                }
              } else {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'No file content provided' }))
                return
              }
              
              // 使用 markitdown-ts 解析文档
              console.log('[vite-plugin-fs] 使用 markitdown-ts 解析:', tempFilePath)
              const result = await markitdown.convert(tempFilePath)
              
              // 清理临时文件
              if (base64Content && tempFilePath && tempFilePath.includes(os.tmpdir())) {
                try {
                  fs.unlinkSync(tempFilePath)
                  console.log('[vite-plugin-fs] 清理临时文件:', tempFilePath)
                } catch (e) {
                  console.error('[vite-plugin-fs] 清理临时文件失败:', e)
                }
              }
              
              if (!result || !result.text_content) {
                res.statusCode = 500
                res.end(JSON.stringify({ error: 'Failed to parse document' }))
                return
              }
              
              let text = result.text_content
              
              // 清理 PDF 解析产生的乱码和特殊字符
              text = cleanResumeText(text)
              
              // markitdown-ts 已经返回 markdown 格式
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ 
                success: true, 
                text: text,
                markdown: text 
              }))
            } catch (error) {
              console.error('[vite-plugin-fs] 解析简历失败:', error)
              res.statusCode = 500
              res.end(JSON.stringify({ error: error.message }))
            }
            return
          }

          // 如果没有匹配的路由，返回 404
          console.log('[vite-plugin-fs] 未找到路由:', apiPath, req.method)
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'Not Found', path: apiPath, method: req.method }))

        } catch (error) {
          console.error('[vite-plugin-fs] Error:', error)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: error.message }))
        }
      })
    }
  }
}

// 清理简历文本中的乱码和特殊字符
function cleanResumeText(text) {
  if (!text) return ''

  let cleaned = text

  // 移除 PDF 解析产生的常见乱码模式（如 b7eb45a35108230d1Hd739y8FFJQw4y5UfufWOWjnvHTNhVm3w~~）
  // 这些通常是 PDF 中的水印或特殊编码
  cleaned = cleaned.replace(/[a-f0-9]{20,}[A-Za-z0-9]{10,}~~/g, '')

  // 将特殊符号（如 、、 等）替换为列表标识符 -
  cleaned = cleaned.replace(/[\uE000-\uF8FF]/g, '-')

  // 移除单独的 ~ 符号行
  cleaned = cleaned.replace(/^[\s~]+$/gm, '')

  // 移除连续的特殊字符
  cleaned = cleaned.replace(/[~`!@#$%^&*()_+=\[\]{}|;':",./<>?]{5,}/g, '')

  // 移除看起来像随机哈希的字符串（长度超过20的字母数字混合）
  cleaned = cleaned.replace(/\b[a-f0-9]{16,}\b/gi, '')

  // 移除包含大量随机字符的行
  cleaned = cleaned.replace(/^.*[a-z0-9]{15,}.*$/gim, '')

  // 减少多余空格和Tab：多个连续空格或Tab合并为1个空格
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ')

  // 清理行首空格（但保留列表格式）
  cleaned = cleaned.split('\n').map(line => {
    // 先清理行首的特殊字符和Tab，再清理多余空格
    line = line.replace(/^[\s\uE000-\uF8FF~`!@#$%^&*()_+=\[\]{}|;':",./<>?]+/, '')
    // 减少行内多余空格和Tab
    line = line.replace(/[ \t]{2,}/g, ' ').trim()
    return line
  }).filter(line => line.length > 0).join('\n')

  // 清理多个连续空行（2个以上空行合并为1个）
  cleaned = cleaned.replace(/\n{2,}/g, '\n')

  return cleaned.trim()
}
