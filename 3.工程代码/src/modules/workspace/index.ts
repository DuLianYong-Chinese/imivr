import type { 
  WorkspaceInfo, 
  WorkspaceDetail, 
  WorkspaceMetadata, 
  CreateWorkspaceInput,
  ValidationResult 
} from '@/types'
import { 
  exists, 
  readFile, 
  writeFile, 
  deleteFile, 
  listFiles,
  createDirectory,
  deleteDirectory 
} from '@/core/filesystem'
import { parseMarkdown, stringifyMarkdown } from '@/core/markdown'
import { FileNotFoundError } from '@/core/filesystem/errors'

export class WorkspaceNotFoundError extends Error {
  constructor(public jobRole: string) {
    super(`Workspace not found: ${jobRole}`)
    this.name = 'WorkspaceNotFoundError'
  }
}

export class WorkspaceExistsError extends Error {
  constructor(public jobRole: string) {
    super(`Workspace already exists: ${jobRole}`)
    this.name = 'WorkspaceExistsError'
  }
}

export class WorkspaceCreationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspaceCreationError'
  }
}

export async function listWorkspaces(
  options?: { category?: string }
): Promise<WorkspaceInfo[]> {
  console.log('[listWorkspaces] 开始加载工作空间列表')
  const workspacePaths = await listFiles('')
  console.log('[listWorkspaces] 获取到的文件路径:', workspacePaths)
  
  const workspaceDirs = new Set(
    workspacePaths
      .map(p => p.replace(/\\/g, '/').split('/')[0])
      .filter(Boolean)
  )
  console.log('[listWorkspaces] 解析出的工作空间目录:', Array.from(workspaceDirs))

  const workspaces: WorkspaceInfo[] = []
  console.log('[listWorkspaces] 开始遍历工作空间目录:', Array.from(workspaceDirs))

  for (const dir of workspaceDirs) {
    try {
      const workspacePath = `${dir}`
      const workspaceFile = `${workspacePath}/workspace.md`
      
      console.log('[listWorkspaces] 检查文件:', workspaceFile, '存在:', await exists(workspaceFile))
      
      if (!(await exists(workspaceFile))) continue
      
      const content = await readFile(workspaceFile)
      const { metadata } = parseMarkdown<WorkspaceMetadata>(content)
      
      if (options?.category && metadata.category !== options.category) continue
      
      const questionCount = await countQuestions(workspacePath)
      const interviewCount = await countInterviews(workspacePath)
      
      workspaces.push({
        job_role: metadata.job_role,
        workspace_name: metadata.workspace_name,
        category: metadata.category,
        target_levels: metadata.target_levels,
        created_at: metadata.created_at,
        question_count: questionCount,
        interview_count: interviewCount,
      })
      console.log('[listWorkspaces] 成功加载工作空间:', metadata.workspace_name)
    } catch (error) {
      console.warn(`[listWorkspaces] 读取工作空间失败: ${dir}`, error)
    }
  }

  console.log('[listWorkspaces] 最终工作空间列表:', workspaces)
  return workspaces
}

export async function getWorkspaceDetail(jobRole: string): Promise<WorkspaceDetail> {
  const workspacePath = `${jobRole}`
  const workspaceFile = `${workspacePath}/workspace.md`

  if (!(await exists(workspaceFile))) {
    throw new WorkspaceNotFoundError(jobRole)
  }

  const content = await readFile(workspaceFile)
  const { metadata, body } = parseMarkdown<WorkspaceMetadata>(content)

  const questionStats = {
    total: await countQuestions(workspacePath),
    by_difficulty: await countQuestionsByDifficulty(workspacePath),
    by_category: {},
    by_dimension: {},
    jd_count: await countJDConfigs(workspacePath),
  }

  return {
    ...metadata,
    content: body,
    question_stats: questionStats,
    interview_count: await countInterviews(workspacePath),
  }
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceInfo> {
  const workspacePath = `${input.job_role}`
  const workspaceFile = `${workspacePath}/workspace.md`

  if (await exists(workspaceFile)) {
    throw new WorkspaceExistsError(input.job_role)
  }

  validateWorkspaceInput(input)

  const now = new Date().toISOString()
  const metadata: WorkspaceMetadata = {
    job_role: input.job_role,
    workspace_name: input.workspace_name,
    category: input.category,
    target_levels: input.target_levels,
    evaluation_dimensions: input.evaluation_dimensions,
    created_at: now,
    updated_at: now,
  }

  const body = buildWorkspaceBody(input)

  await createDirectory(workspacePath)
  await createDirectory(`${workspacePath}/interviews`)
  await createDirectory(`${workspacePath}/templates`)

  const content = stringifyMarkdown(metadata, body)
  await writeFile(workspaceFile, content)

  return {
    job_role: metadata.job_role,
    workspace_name: metadata.workspace_name,
    category: metadata.category,
    target_levels: metadata.target_levels,
    created_at: metadata.created_at,
    question_count: 0,
    interview_count: 0,
  }
}

export async function updateWorkspace(
  jobRole: string,
  updates: Partial<CreateWorkspaceInput>
): Promise<void> {
  const workspacePath = `${jobRole}`
  const workspaceFile = `${workspacePath}/workspace.md`

  if (!(await exists(workspaceFile))) {
    throw new WorkspaceNotFoundError(jobRole)
  }

  const content = await readFile(workspaceFile)
  const { metadata, body } = parseMarkdown<WorkspaceMetadata>(content)

  const updatedMetadata: WorkspaceMetadata = {
    ...metadata,
    ...updates,
    updated_at: new Date().toISOString(),
  }

  const newContent = stringifyMarkdown(updatedMetadata, body)
  await writeFile(workspaceFile, newContent)
}

export async function deleteWorkspace(jobRole: string, force = false): Promise<void> {
  console.log('[deleteWorkspace] 开始删除, jobRole:', jobRole, 'force:', force)
  const workspacePath = `${jobRole}`

  const workspaceExists = await exists(`${workspacePath}/workspace.md`)
  console.log('[deleteWorkspace] 检查 workspace.md 存在:', workspaceExists)
  if (!workspaceExists) {
    console.error('[deleteWorkspace] workspace.md 不存在, 抛出 WorkspaceNotFoundError')
    throw new WorkspaceNotFoundError(jobRole)
  }

  const interviewCount = await countInterviews(workspacePath)
  console.log('[deleteWorkspace] 面试记录数量:', interviewCount)
  if (interviewCount > 0 && !force) {
    console.error('[deleteWorkspace] 有面试记录且 force=false, 拒绝删除')
    throw new Error(`Workspace has ${interviewCount} interviews. Use force=true to delete.`)
  }

  console.log('[deleteWorkspace] 开始调用 deleteDirectory, path:', workspacePath)
  const deleted = await deleteDirectory(workspacePath)
  console.log('[deleteWorkspace] deleteDirectory 返回:', deleted)
  if (!deleted) {
    console.error('[deleteWorkspace] deleteDirectory 返回 false, 删除失败')
    throw new Error(`删除工作空间目录失败: ${workspacePath}`)
  }
  console.log('[deleteWorkspace] 删除成功, jobRole:', jobRole)
}

export async function validateWorkspace(jobRole: string): Promise<ValidationResult> {
  const issues: string[] = []
  const workspacePath = `${jobRole}`

  const requiredDirs = [
    'question-bank',
    'interviews',
    'templates',
  ]

  for (const dir of requiredDirs) {
    const dirPath = `${workspacePath}/${dir}`
    const files = await listFiles(dirPath)
    if (files.length === 0 && !dir.includes('L')) {
      // Only warn for non-level directories
    }
  }

  try {
    const workspaceFile = `${workspacePath}/workspace.md`
    const content = await readFile(workspaceFile)
    const { metadata } = parseMarkdown<WorkspaceMetadata>(content)

    if (!metadata.evaluation_dimensions || metadata.evaluation_dimensions.length === 0) {
      issues.push('缺少考察维度配置')
    }

    const weightSum = metadata.evaluation_dimensions?.reduce((sum, d) => sum + d.weight, 0) ?? 0
    if (Math.abs(weightSum - 1) > 0.01) {
      issues.push(`权重总和不为1: ${weightSum.toFixed(2)}`)
    }
  } catch {
    issues.push('workspace.md 文件损坏或格式错误')
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}

function validateWorkspaceInput(input: CreateWorkspaceInput): void {
  if (!input.job_role.match(/^[a-z_]+$/)) {
    throw new WorkspaceCreationError('工种代码只能包含小写字母和下划线')
  }

  if (input.job_role.length < 2 || input.job_role.length > 30) {
    throw new WorkspaceCreationError('工种代码长度必须在2-30之间')
  }

  const weightSum = input.evaluation_dimensions.reduce((sum, d) => sum + d.weight, 0)
  if (Math.abs(weightSum - 1) > 0.01) {
    throw new WorkspaceCreationError(`考察维度权重总和必须为1，当前为${weightSum.toFixed(2)}`)
  }
}

function buildWorkspaceBody(input: CreateWorkspaceInput): string {
  return `# ${input.workspace_name} - 工作空间

## 考察维度

${input.evaluation_dimensions.map(d => `- **${d.name}** (${(d.weight * 100).toFixed(0)}%): ${d.description || ''}`).join('\n')}

## 职级要求

### P3-P4 初级
具备基础工作能力，需要一定指导

### P5 中级
独立完成工作，具备一定问题解决能力

### P6 高级
技术骨干，能解决复杂问题，指导他人

### P7 专家
领域专家，能引领技术方向
`
}

async function countQuestions(workspacePath: string): Promise<number> {
  const files = await listFiles(`${workspacePath}/question-bank/`)
  // 统一处理 Windows 和 Unix 路径分隔符
  return files.filter(f => f.replace(/\\/g, '/').endsWith('.md')).length
}

async function countQuestionsByDifficulty(workspacePath: string): Promise<Record<string, number>> {
  const difficulties = ['L1-初级', 'L2-中级', 'L3-高级', 'L4-专家', 'L5-大神']
  const result: Record<string, number> = {}

  for (const diff of difficulties) {
    const files = await listFiles(`${workspacePath}/question-bank/${diff}/`)
    result[diff] = files.filter(f => f.replace(/\\/g, '/').endsWith('.md')).length
  }

  return result
}

async function countJDConfigs(workspacePath: string): Promise<number> {
  const files = await listFiles(`${workspacePath}/templates/`)
  return files.filter(f => {
    const normalizedPath = f.replace(/\\/g, '/')
    const fileName = normalizedPath.split('/').pop() || normalizedPath
    return fileName.startsWith('jd-') && fileName.endsWith('-template.md')
  }).length
}

async function countInterviews(workspacePath: string): Promise<number> {
  const prefix = `${workspacePath}/interviews/`
  const files = await listFiles(prefix)
  const interviewDirs = new Set(
    files
      .map(f => f.replace(/\\/g, '/'))
      .map(f => {
        const relativePath = f.startsWith(prefix) ? f.slice(prefix.length) : f
        const parts = relativePath.split('/')
        return parts[0]
      })
      .filter(name => name && name.length > 0)
  )
  return interviewDirs.size
}
