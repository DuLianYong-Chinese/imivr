import type { JDConfig, CreateJDInput, ValidationResult } from '@/types'
import { exists, readFile, writeFile, deleteFile, listFiles } from '@/core/filesystem'
import { parseMarkdown, stringifyMarkdown } from '@/core/markdown'

export class JDNotFoundError extends Error {
  constructor(public jdId: string) {
    super(`JD config not found: ${jdId}`)
    this.name = 'JDNotFoundError'
  }
}

export async function createJD(input: CreateJDInput): Promise<JDConfig> {
  const jdId = `jd-${Date.now()}`
  const jdPath = `${input.job_role}/templates/${jdId}.md`
  
  const now = new Date().toISOString()
  const jdConfig: JDConfig = {
    ...input,
    jd_id: jdId,
    created_at: now,
    updated_at: now,
  }
  
  const body = buildJDBody(jdConfig)
  const content = stringifyMarkdown(jdConfig, body)
  
  await writeFile(jdPath, content)
  
  return jdConfig
}

export async function getJD(jdId: string, jobRole?: string): Promise<JDConfig> {
  let jdPath: string | null = null
  
  if (jobRole) {
    jdPath = `${jobRole}/templates/${jdId}.md`
    if (!(await exists(jdPath))) {
      jdPath = null
    }
  }
  
  if (!jdPath) {
    jdPath = await findJDFileById(jdId)
  }
  
  if (!jdPath || !(await exists(jdPath))) {
    throw new JDNotFoundError(jdId)
  }
  
  const content = await readFile(jdPath)
  const { metadata } = parseMarkdown<JDConfig>(content)
  
  return metadata
}

export async function updateJD(jdId: string, updates: Partial<CreateJDInput>): Promise<void> {
  const jdPath = await findJDFileById(jdId)
  
  if (!jdPath || !(await exists(jdPath))) {
    throw new JDNotFoundError(jdId)
  }
  
  const content = await readFile(jdPath)
  const { metadata, body } = parseMarkdown<JDConfig>(content)
  
  const updatedMetadata: JDConfig = {
    ...metadata,
    ...updates,
    updated_at: new Date().toISOString(),
  }
  
  const newContent = stringifyMarkdown(updatedMetadata, body)
  await writeFile(jdPath, newContent)
}

export async function deleteJD(jdId: string): Promise<void> {
  const jdPath = await findJDFileById(jdId)
  
  if (!jdPath || !(await exists(jdPath))) {
    throw new JDNotFoundError(jdId)
  }
  
  await deleteFile(jdPath)
}

export async function listJD(options?: { jobRole?: string }): Promise<JDConfig[]> {
  const prefix = options?.jobRole
    ? `${options.jobRole}/templates/`
    : ''
  
  const files = await listFiles(prefix)
  const jdFiles = files.filter(f => f.includes('/templates/') && f.endsWith('.md'))
  
  const jdList: JDConfig[] = []
  
  for (const file of jdFiles) {
    try {
      const content = await readFile(file)
      const { metadata } = parseMarkdown<JDConfig>(content)
      
      if (metadata.jd_id) {
        jdList.push(metadata)
      }
    } catch {
    }
  }
  
  return jdList.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function validateJD(jdId: string): Promise<ValidationResult> {
  const issues: string[] = []
  
  try {
    const jd = await getJD(jdId)
    
    if (!jd.position_name) issues.push('缺少岗位名称')
    if (!jd.target_level) issues.push('缺少目标职级')
    if (!jd.required_skills || jd.required_skills.length === 0) {
      issues.push('缺少必备技能')
    }
    
    if (jd.evaluation_dimensions) {
      const weightSum = jd.evaluation_dimensions.reduce((sum, d) => sum + d.weight, 0)
      if (Math.abs(weightSum - 1) > 0.01) {
        issues.push(`权重总和不为1: ${weightSum.toFixed(2)}`)
      }
    }
  } catch {
    issues.push('JD配置不存在或格式错误')
  }
  
  return {
    valid: issues.length === 0,
    issues,
  }
}

async function findJDFileById(jdId: string): Promise<string | null> {
  const files = await listFiles('')
  const jdFiles = files.filter(f => f.includes('/templates/') && f.includes(jdId))
  
  return jdFiles.length > 0 ? jdFiles[0] : null
}

function buildJDBody(jd: JDConfig): string {
  let body = `# JD配置 - ${jd.position_name}\n\n`
  
  body += `## 岗位描述\n${jd.description || '暂无描述'}\n\n`
  
  body += `## 岗位要求\n`
  body += `- 目标职级：${jd.target_level}\n`
  if (jd.min_experience) body += `- 最低经验：${jd.min_experience}年\n`
  if (jd.education_requirement) body += `- 学历要求：${jd.education_requirement}\n`
  
  body += `\n### 必备技能\n`
  for (const skill of jd.required_skills) {
    body += `- ${skill}\n`
  }
  
  if (jd.preferred_skills && jd.preferred_skills.length > 0) {
    body += `\n### 加分技能\n`
    for (const skill of jd.preferred_skills) {
      body += `- ${skill}\n`
    }
  }
  
  body += `\n## 考察维度\n`
  body += `| 维度 | 权重 | 说明 |\n`
  body += `|------|------|------|\n`
  for (const dim of jd.evaluation_dimensions) {
    body += `| ${dim.name} | ${(dim.weight * 100).toFixed(0)}% | ${dim.description || ''} |\n`
  }
  
  if (jd.other_requirements) {
    body += `\n## 其他要求\n${jd.other_requirements}\n`
  }
  
  return body
}