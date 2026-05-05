import { FileNotFoundError } from './errors'

// API 基础路径
const API_BASE = '/api/fs'

// API 调用函数
async function apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`)
  }

  const text = await response.text()
  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// 读取配置文件
async function readConfigFromFile(): Promise<Record<string, any>> {
  try {
    const data = await apiCall('config')
    return data
  } catch (error) {
    console.error('读取配置文件失败:', error)
    return {}
  }
}

// 写入配置文件
async function writeConfigToFile(config: Record<string, any>): Promise<boolean> {
  try {
    await apiCall('config', {
      method: 'POST',
      body: JSON.stringify(config)
    })
    return true
  } catch (error) {
    console.error('写入配置文件失败:', error)
    return false
  }
}

// 打开文件夹选择对话框
export async function selectFolderDialog(): Promise<string | null> {
  try {
    const data = await apiCall('select-folder-dialog', { method: 'POST' })
    return data.path || null
  } catch (error) {
    console.error('打开文件夹选择对话框失败:', error)
    return null
  }
}

// 检查系统是否已初始化（有工作目录）
export async function hasRootHandle(): Promise<boolean> {
  try {
    const config = await readConfigFromFile()
    return config.initialized === true && config.workspaceRoot !== null
  } catch {
    return false
  }
}

// 获取当前工作目录
export async function getWorkspaceRoot(): Promise<string | null> {
  try {
    const data = await apiCall('workspace-root')
    return data.workspaceRoot
  } catch {
    return null
  }
}

// 选择工作目录
export async function selectWorkspace(workspaceRoot: string): Promise<boolean> {
  try {
    await apiCall('select-workspace', {
      method: 'POST',
      body: JSON.stringify({ workspaceRoot })
    })
    return true
  } catch (error) {
    console.error('选择工作目录失败:', error)
    return false
  }
}

export interface MigrateWorkspaceResult {
  success: boolean
  needsConfirmation?: boolean
  message?: string
  workspaceRoot?: string
}

export async function migrateWorkspace(targetPath: string, confirmed: boolean = false): Promise<MigrateWorkspaceResult> {
  try {
    const result = await apiCall('migrate-workspace', {
      method: 'POST',
      body: JSON.stringify({ targetPath, confirmed })
    })
    return result
  } catch (error: any) {
    console.error('迁移工作目录失败:', error)
    return { success: false, message: error?.message || '迁移失败' }
  }
}

// 获取配置
export async function getConfig(): Promise<Record<string, any>> {
  try {
    return await readConfigFromFile()
  } catch {
    return {}
  }
}

// 保存配置
export async function saveConfig(config: Record<string, any>): Promise<boolean> {
  return await writeConfigToFile(config)
}

// 重置配置
export async function resetConfig(): Promise<boolean> {
  try {
    await apiCall('reset', { method: 'POST' })
    return true
  } catch (error) {
    console.error('重置配置失败:', error)
    return false
  }
}

// 获取配置路径
export async function getConfigPath(): Promise<{ path: string; dir: string; workspaceRoot: string | null }> {
  try {
    return await apiCall('config-path')
  } catch {
    return { path: 'D:/.imivr/imivr.json', dir: 'D:/.imivr', workspaceRoot: null }
  }
}

// 获取用户路径（配置目录）
export async function getUserPath(): Promise<string> {
  const { dir } = await getConfigPath()
  return dir
}

// 文件操作（相对于工作目录）
export async function readFile(relativePath: string): Promise<string> {
  try {
    const data = await apiCall(`read?path=${encodeURIComponent(relativePath)}`)
    if (typeof data === 'object' && data !== null && 'content' in data) {
      return typeof data.content === 'string' ? data.content : String(data.content)
    }
    if (typeof data === 'string') return data
    return ''
  } catch (error) {
    throw new FileNotFoundError(relativePath)
  }
}

export async function writeFile(relativePath: string, content: string): Promise<boolean> {
  try {
    await apiCall('write', {
      method: 'POST',
      body: JSON.stringify({ path: relativePath, content })
    })
    return true
  } catch (error) {
    console.error('写入文件失败:', error)
    return false
  }
}

export async function deleteFile(relativePath: string): Promise<boolean> {
  try {
    await apiCall('delete', {
      method: 'POST',
      body: JSON.stringify({ path: relativePath })
    })
    return true
  } catch (error) {
    console.error('删除文件失败:', error)
    return false
  }
}

export async function exists(relativePath: string): Promise<boolean> {
  console.log('[filesystem] exists 被调用, relativePath:', relativePath)
  try {
    const data = await apiCall(`exists?path=${encodeURIComponent(relativePath)}`)
    console.log('[filesystem] exists 返回:', data)
    return data.exists
  } catch (error) {
    console.error('[filesystem] exists 失败, 返回 false:', error)
    return false
  }
}

export async function listFiles(relativePrefix: string): Promise<string[]> {
  try {
    return await apiCall(`list?prefix=${encodeURIComponent(relativePrefix)}`)
  } catch {
    return []
  }
}

export async function atomicWrite(relativePath: string, content: string): Promise<boolean> {
  return writeFile(relativePath, content)
}

export async function copyFile(src: string, dest: string): Promise<boolean> {
  try {
    const content = await readFile(src)
    return writeFile(dest, content)
  } catch {
    return false
  }
}

export async function moveFile(src: string, dest: string): Promise<boolean> {
  const success = await copyFile(src, dest)
  if (success) {
    await deleteFile(src)
  }
  return success
}

export async function createDirectory(relativePath: string): Promise<boolean> {
  try {
    await apiCall('mkdir', {
      method: 'POST',
      body: JSON.stringify({ path: relativePath })
    })
    return true
  } catch (error) {
    console.error('创建目录失败:', error)
    return false
  }
}

export async function deleteDirectory(relativePath: string): Promise<boolean> {
  console.log('[filesystem] deleteDirectory 被调用, relativePath:', relativePath)
  try {
    const result = await apiCall('rmdir', {
      method: 'POST',
      body: JSON.stringify({ path: relativePath })
    })
    console.log('[filesystem] deleteDirectory apiCall 返回:', result)
    return true
  } catch (error) {
    console.error('[filesystem] deleteDirectory apiCall 失败:', error)
    return false
  }
}

export async function directoryExists(relativePath: string): Promise<boolean> {
  return exists(relativePath)
}

// 解析简历文件（PDF/Word）
export async function parseResume(
  filePath: string,
  fileType: string,
  base64Content?: string
): Promise<{ text: string; markdown: string } | null> {
  try {
    const data = await apiCall('parse-resume', {
      method: 'POST',
      body: JSON.stringify({ filePath, fileType, base64Content })
    })
    return { text: data.text, markdown: data.markdown }
  } catch (error) {
    console.error('解析简历失败:', error)
    return null
  }
}

// 兼容旧的导出
export async function requestRootDirectory(): Promise<boolean> {
  return true
}

export async function selectDirectory(): Promise<boolean> {
  return true
}

export async function initConfig(): Promise<void> {
  // 不需要手动初始化，服务端会自动处理
}
