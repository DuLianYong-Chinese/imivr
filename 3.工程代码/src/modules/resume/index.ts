import type { ResumeData } from '@/types'
import { exists, readFile, writeFile, deleteFile, listFiles } from '@/core/filesystem'
import { parseMarkdown, stringifyMarkdown } from '@/core/markdown'
import { callAIWithJSON } from '@/core/ai'
import { getPromptsForJobRole } from '@/core/plugin'

export class ResumeNotFoundError extends Error {
  constructor(public interviewId: string) {
    super(`Resume not found for interview: ${interviewId}`)
    this.name = 'ResumeNotFoundError'
  }
}

export class InterviewNotFoundError extends Error {
  constructor(public interviewId: string) {
    super(`Interview not found: ${interviewId}`)
    this.name = 'InterviewNotFoundError'
  }
}

async function findInterviewDir(interviewId: string): Promise<string | null> {
  const files = await listFiles('')
  const interviewPaths = files.filter(f => f.includes('/interviews/') && f.includes(interviewId))
  
  if (interviewPaths.length === 0) return null
  
  const match = interviewPaths[0].match(/^([^/]+\/interviews\/[^/]+)/)
  return match ? match[1] : null
}

export async function getResume(interviewId: string): Promise<ResumeData> {
  const interviewDir = await findInterviewDir(interviewId)
  
  if (!interviewDir) {
    throw new InterviewNotFoundError(interviewId)
  }

  const resumePath = `${interviewDir}/resume.md`
  
  if (!(await exists(resumePath))) {
    throw new ResumeNotFoundError(interviewId)
  }

  const content = await readFile(resumePath)
  const { metadata } = parseMarkdown<ResumeData>(content)
  
  return metadata
}

export async function updateResume(
  interviewId: string,
  updates: Partial<ResumeData>
): Promise<void> {
  const interviewDir = await findInterviewDir(interviewId)
  
  if (!interviewDir) {
    throw new InterviewNotFoundError(interviewId)
  }

  const resumePath = `${interviewDir}/resume.md`
  
  if (!(await exists(resumePath))) {
    throw new ResumeNotFoundError(interviewId)
  }

  const content = await readFile(resumePath)
  const { metadata, body } = parseMarkdown<ResumeData>(content)
  
  const updatedMetadata: ResumeData = {
    ...metadata,
    ...updates,
  }
  
  const newContent = stringifyMarkdown(updatedMetadata, body)
  await writeFile(resumePath, newContent)
}

export async function deleteResume(interviewId: string): Promise<void> {
  const interviewDir = await findInterviewDir(interviewId)
  
  if (!interviewDir) return

  const filesToDelete = ['resume.pdf', 'resume.md', 'resume.doc', 'resume.docx']
  
  for (const file of filesToDelete) {
    const filePath = `${interviewDir}/${file}`
    if (await exists(filePath)) {
      await deleteFile(filePath)
    }
  }
}

export async function parseResumeContent(
  interviewId: string,
  rawText: string,
  jobRole: string
): Promise<ResumeData> {
  const prompts = getPromptsForJobRole(jobRole)
  
  const result = await callAIWithJSON<ResumeData>(
    prompts.resumeAnalysis,
    { resumeText: rawText }
  )
  
  result.parsed_at = new Date().toISOString()
  result.parse_status = 'success'
  
  const interviewDir = await findInterviewDir(interviewId)
  if (interviewDir) {
    const resumePath = `${interviewDir}/resume.md`
    const body = buildResumeBody(result)
    const content = stringifyMarkdown(result, body)
    await writeFile(resumePath, content)
  }
  
  return result
}

function buildResumeBody(data: ResumeData): string {
  let body = `# 候选人简历 - ${data.candidate_name || '未知'}\n\n`
  
  body += `## 基本信息\n`
  body += `- 姓名：${data.candidate_name || '未知'}\n`
  if (data.contact) body += `- 联系方式：${data.contact}\n`
  if (data.email) body += `- 邮箱：${data.email}\n`
  if (data.work_years) body += `- 工作年限：${data.work_years}年\n`
  
  if (data.education && data.education.length > 0) {
    body += `\n## 教育背景\n`
    body += `| 时间 | 学校 | 专业 | 学历 |\n`
    body += `|------|------|------|------|\n`
    for (const edu of data.education) {
      body += `| ${edu.start_date} ~ ${edu.end_date} | ${edu.school} | ${edu.major} | ${edu.degree} |\n`
    }
  }
  
  if (data.work_experience && data.work_experience.length > 0) {
    body += `\n## 工作经历\n`
    for (const work of data.work_experience) {
      body += `\n### ${work.company} - ${work.position}\n`
      body += `**时间**：${work.start_date} ~ ${work.end_date}\n`
      if (work.responsibilities && work.responsibilities.length > 0) {
        body += `\n**主要职责**：\n`
        for (const resp of work.responsibilities) {
          body += `- ${resp}\n`
        }
      }
    }
  }
  
  if (data.skills && data.skills.length > 0) {
    body += `\n## 技能栈\n`
    for (const skill of data.skills) {
      body += `- ${skill}\n`
    }
  }
  
  if (data.projects && data.projects.length > 0) {
    body += `\n## 项目经验\n`
    for (const project of data.projects) {
      body += `\n### ${project.name}\n`
      if (project.tech_stack) {
        body += `**技术栈**：${project.tech_stack.join(', ')}\n`
      }
      if (project.contribution) {
        body += `**个人贡献**：${project.contribution}\n`
      }
    }
  }
  
  return body
}

export async function listResumes(options?: {
  jobRole?: string
  parseStatus?: 'success' | 'failed' | 'pending'
}): Promise<Array<{ interviewId: string; candidateName: string; parseStatus: string }>> {
  const prefix = options?.jobRole 
    ? `${options.jobRole}/interviews/`
    : ''
  
  const files = await listFiles(prefix)
  const resumeFiles = files.filter(f => f.endsWith('/resume.md'))
  
  const resumes: Array<{ interviewId: string; candidateName: string; parseStatus: string }> = []
  
  for (const file of resumeFiles) {
    try {
      const content = await readFile(file)
      const { metadata } = parseMarkdown<ResumeData>(content)
      
      if (options?.parseStatus && metadata.parse_status !== options.parseStatus) continue
      
      const interviewId = file.split('/')[4] || ''
      resumes.push({
        interviewId,
        candidateName: metadata.candidate_name || '未知',
        parseStatus: metadata.parse_status || 'pending',
      })
    } catch {
      // Skip invalid files
    }
  }
  
  return resumes
}
