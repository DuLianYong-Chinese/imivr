import type { Interview, InterviewDetail, CreateInterviewInput, UpdateInterviewInput, ResumeData, Dimension } from '@/types'
import { exists, readFile, writeFile, deleteFile, listFiles, createDirectory, deleteDirectory, getConfig } from '@/core/filesystem'
import { parseMarkdown, stringifyMarkdown } from '@/core/markdown'
import { v4 as uuidv4 } from 'uuid'

export class InterviewNotFoundError extends Error {
  constructor(public interviewId: string) {
    super(`Interview not found: ${interviewId}`)
    this.name = 'InterviewNotFoundError'
  }
}

export class InterviewNotCompletedError extends Error {
  constructor(public interviewId: string) {
    super(`Interview not completed: ${interviewId}`)
    this.name = 'InterviewNotCompletedError'
  }
}

export async function listInterviews(
  options?: {
    jobRole?: string
    status?: string
    page?: number
    pageSize?: number
  }
): Promise<Interview[]> {
  const prefix = options?.jobRole
    ? `${options.jobRole}/interviews/`
    : ''
  
  const files = await listFiles(prefix)
  // 统一处理 Windows 和 Unix 路径分隔符
  const interviewFiles = files.filter(f => {
    const normalizedPath = f.replace(/\\/g, '/')
    return normalizedPath.endsWith('/interview.md')
  })
  
  const interviews: Interview[] = []
  
  for (const file of interviewFiles) {
    try {
      const content = await readFile(file)
      const { metadata } = parseMarkdown<Interview>(content)

      if (options?.status && metadata.status !== options.status) continue

      // difficulty_levels 已经存储在 interview.md 的 metadata 中，直接读取
      // 无需再读取 difficulty-config.json

      interviews.push(metadata)
    } catch {
      // Skip invalid files
    }
  }
  
  interviews.sort((a, b) => b.created_at.localeCompare(a.created_at))
  
  const page = options?.page || 1
  const pageSize = options?.pageSize || 20
  const start = (page - 1) * pageSize
  const end = start + pageSize
  
  return interviews.slice(start, end)
}

export async function getInterview(interviewId: string): Promise<Interview> {
  const interviewPath = await findInterviewFile(interviewId)
  
  if (!interviewPath) {
    throw new InterviewNotFoundError(interviewId)
  }
  
  const content = await readFile(interviewPath)
  const { metadata } = parseMarkdown<Interview>(content)
  
  return metadata
}

export async function getInterviewDetail(interviewId: string): Promise<InterviewDetail> {
  console.log('[getInterviewDetail] 查找面试:', interviewId)
  const interviewDir = await findInterviewDir(interviewId)
  console.log('[getInterviewDetail] 找到目录:', interviewDir)
  
  if (!interviewDir) {
    throw new InterviewNotFoundError(interviewId)
  }
  
  const interviewPath = `${interviewDir}/interview.md`
  console.log('[getInterviewDetail] 读取文件:', interviewPath)
  const content = await readFile(interviewPath)
  console.log('[getInterviewDetail] 文件内容长度:', content.length)
  const { metadata, body } = parseMarkdown<Interview>(content)
  
  const detail: InterviewDetail = {
    ...metadata,
    content: body,
  }
  
  const resumePath = `${interviewDir}/resume.md`
  console.log('[getInterviewDetail] 检查简历文件:', resumePath, '存在:', await exists(resumePath))
  if (await exists(resumePath)) {
    const resumeContent = await readFile(resumePath)
    const { metadata: resumeMeta, body: resumeBody } = parseMarkdown(resumeContent)
    detail.resume = {
      candidate_name: resumeMeta.candidate_name || metadata.candidate_name || '',
      ...resumeMeta,
      content: resumeBody,
    } as ResumeData
    console.log('[getInterviewDetail] 简历数据:', resumeMeta)
  }
  
  const questionsPath = `${interviewDir}/questions.md`
  console.log('[getInterviewDetail] 检查问题清单:', questionsPath, '存在:', await exists(questionsPath))
  if (await exists(questionsPath)) {
    const questionsContent = await readFile(questionsPath)
    const { metadata: questionsMeta, body: questionsBody } = parseMarkdown(questionsContent)
    detail.questions = {
      ...questionsMeta,
      questions: parseQuestionsFromBody(questionsBody),
    } as any
    console.log('[getInterviewDetail] 问题清单数据:', questionsMeta)
  }
  
  const answersPath = `${interviewDir}/answers.md`
  console.log('[getInterviewDetail] 检查答题记录:', answersPath, '存在:', await exists(answersPath))
  if (await exists(answersPath)) {
    const answersContent = await readFile(answersPath)
    const { metadata: answersMeta, body: answersBody } = parseMarkdown(answersContent)
    detail.answers = {
      ...answersMeta,
      answers: parseAnswersFromBody(answersBody),
    } as any
  }
  
  const assessmentPath = `${interviewDir}/assessment.md`
  console.log('[getInterviewDetail] 检查评定结果:', assessmentPath, '存在:', await exists(assessmentPath))
  if (await exists(assessmentPath)) {
    const assessmentContent = await readFile(assessmentPath)
    const { metadata: assessmentMeta } = parseMarkdown(assessmentContent)
    detail.assessment = assessmentMeta as any
    console.log('[getInterviewDetail] 评定结果数据:', assessmentMeta)
  }
  
  return detail
}

export async function createInterview(input: CreateInterviewInput): Promise<Interview> {
  const interviewId = `int-${Date.now()}-${uuidv4().substring(0, 8)}`
  const dateForDir = input.interviewDate.replace(/[: ]/g, '-').substring(0, 10)
  const interviewDir = `${input.jobRole}/interviews/${dateForDir}-${input.candidateName}`

  await createDirectory(interviewDir)

  const now = new Date().toISOString()
  const interview: Interview = {
    interview_id: interviewId,
    candidate_name: input.candidateName,
    interviewer: input.interviewer,
    interview_date: input.interviewDate,
    job_role: input.jobRole,
    target_level: input.targetLevel,
    jd_id: input.jdId,
    status: 'pending',
    created_at: now,
    updated_at: now,
    // 将题库信息直接存储到 interview.md 的 metadata 中，格式为 L1-初级
    difficulty_levels: input.difficultyLevels?.map((level: string) => {
      const levelMap: Record<string, string> = {
        'L1': 'L1-初级',
        'L2': 'L2-中级',
        'L3': 'L3-高级',
        'L4': 'L4-专家',
        'L5': 'L5-大神',
      }
      return levelMap[level] || level
    }) || [],
  }

  const body = buildInterviewBody(interview)
  const content = stringifyMarkdown(interview, body)

  await writeFile(`${interviewDir}/interview.md`, content)

  const answersContent = stringifyMarkdown(
    { interview_id: interviewId, candidate_name: input.candidateName, status: 'pending' },
    '# 面试答题记录\n\n## 答题明细\n'
  )
  await writeFile(`${interviewDir}/answers.md`, answersContent)

  return interview
}

export async function updateInterview(input: UpdateInterviewInput): Promise<Interview> {
  const interviewDir = await findInterviewDir(input.interviewId)

  if (!interviewDir) {
    throw new InterviewNotFoundError(input.interviewId)
  }

  const interviewPath = `${interviewDir}/interview.md`
  const content = await readFile(interviewPath)
  const { metadata } = parseMarkdown<Interview>(content)

  // 更新字段
  const updatedMetadata: Interview = {
    ...metadata,
    interviewer: input.interviewer ?? metadata.interviewer,
    interview_date: input.interviewDate ?? metadata.interview_date,
    target_level: input.targetLevel ?? metadata.target_level,
    jd_id: input.jdId !== undefined ? (input.jdId || undefined) : metadata.jd_id,
    elapsed_seconds: input.elapsed_seconds !== undefined ? input.elapsed_seconds : metadata.elapsed_seconds,
    status: input.status ?? metadata.status,
    updated_at: new Date().toISOString(),
  }

  // 更新难度等级配置到 interview.md 的 metadata 中
  if (input.difficultyLevels) {
    updatedMetadata.difficulty_levels = input.difficultyLevels.map((level: string) => {
      const levelMap: Record<string, string> = {
        'L1': 'L1-初级',
        'L2': 'L2-中级',
        'L3': 'L3-高级',
        'L4': 'L4-专家',
        'L5': 'L5-大神',
      }
      return levelMap[level] || level
    })
  }
  
  // 更新面试目录名（仅在面试日期或候选人姓名实际变化时）
  const dateChanged = input.interviewDate && input.interviewDate !== metadata.interview_date
  const nameChanged = false
  const shouldRename = dateChanged || nameChanged
  
  let finalInterviewDir = interviewDir
  if (shouldRename) {
    const newDirName = `${updatedMetadata.interview_date.replace(/[: ]/g, '-').substring(0, 10)}-${updatedMetadata.candidate_name}`
    const currentDirMatch = interviewDir.match(/\/interviews\/(.+)$/)
    const currentDirName = currentDirMatch ? currentDirMatch[1] : ''
    
    if (currentDirName !== newDirName) {
      const parentDir = interviewDir.substring(0, interviewDir.lastIndexOf('/'))
      const newInterviewDir = `${parentDir}/${newDirName}`
      
      if (await exists(newInterviewDir)) {
        throw new Error('该面试日期和候选人组合已存在')
      }
      
      const files = await listFiles(interviewDir)
      await createDirectory(newInterviewDir)
      
      for (const file of files) {
        const fileName = file.replace(/\\/g, '/').split('/').pop()
        if (fileName) {
          const fileContent = await readFile(file)
          await writeFile(`${newInterviewDir}/${fileName}`, fileContent)
        }
      }
      
      for (const file of files) {
        await deleteFile(file)
      }
      await deleteDirectory(interviewDir)
      
      finalInterviewDir = newInterviewDir
    }
  }
  
  // 保存更新后的 interview.md
  const newBody = buildInterviewBody(updatedMetadata)
  const newContent = stringifyMarkdown(updatedMetadata, newBody)
  await writeFile(`${finalInterviewDir}/interview.md`, newContent)
  
  return updatedMetadata
}

export async function startInterview(interviewId: string): Promise<void> {
  const interviewDir = await findInterviewDir(interviewId)
  
  if (!interviewDir) {
    throw new InterviewNotFoundError(interviewId)
  }
  
  const interviewPath = `${interviewDir}/interview.md`
  const content = await readFile(interviewPath)
  const { metadata, body } = parseMarkdown<Interview>(content)
  
  if (metadata.status !== 'pending') {
    throw new Error('Interview already started')
  }
  
  const updatedMetadata: Interview = {
    ...metadata,
    status: 'in_progress',
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  
  const newContent = stringifyMarkdown(updatedMetadata, body)
  await writeFile(interviewPath, newContent)
}

export async function endInterview(interviewId: string): Promise<void> {
  const interviewDir = await findInterviewDir(interviewId)
  
  if (!interviewDir) {
    throw new InterviewNotFoundError(interviewId)
  }
  
  const interviewPath = `${interviewDir}/interview.md`
  const content = await readFile(interviewPath)
  const { metadata, body } = parseMarkdown<Interview>(content)
  
  if (metadata.status !== 'in_progress') {
    throw new Error('Interview not in progress')
  }
  
  const completedAt = new Date()
  const startedAt = new Date(metadata.started_at!)
  const durationMinutes = Math.round((completedAt.getTime() - startedAt.getTime()) / 60000)
  
  const updatedMetadata: Interview = {
    ...metadata,
    status: 'completed',
    completed_at: completedAt.toISOString(),
    duration_minutes: durationMinutes,
    updated_at: completedAt.toISOString(),
  }
  
  const newContent = stringifyMarkdown(updatedMetadata, body)
  await writeFile(interviewPath, newContent)
}

export async function saveResume(
  interviewId: string,
  resumeData: {
    candidate_name: string
    contact?: string
    email?: string
    skills?: string[]
    content?: string
  }
): Promise<void> {
  const interviewDir = await findInterviewDir(interviewId)
  
  if (!interviewDir) {
    throw new InterviewNotFoundError(interviewId)
  }
  
  const resumePath = `${interviewDir}/resume.md`
  const body = resumeData.content || `# 简历 - ${resumeData.candidate_name}\n\n## 基本信息\n\n- 姓名：${resumeData.candidate_name}\n- 联系方式：${resumeData.contact || '-'}\n- 邮箱：${resumeData.email || '-'}\n\n## 技能\n\n${resumeData.skills?.map(s => `- ${s}`).join('\n') || '暂无'}\n`
  
  const resumeContent = stringifyMarkdown(
    {
      candidate_name: resumeData.candidate_name,
      contact: resumeData.contact,
      email: resumeData.email,
      skills: resumeData.skills,
      parsed_at: new Date().toISOString(),
    },
    body
  )
  
  await writeFile(resumePath, resumeContent)
}

export async function recordAnswer(
  interviewId: string,
  questionId: string,
  answerContent: string
): Promise<void> {
  const interviewDir = await findInterviewDir(interviewId)

  if (!interviewDir) {
    throw new InterviewNotFoundError(interviewId)
  }

  const answersPath = `${interviewDir}/answers.md`
  const content = await readFile(answersPath)
  const { metadata, body } = parseMarkdown(content)

  const updatedBody = updateAnswerInBody(body, questionId, {
    answer_content: answerContent,
    answer_status: 'answered',
  })

  const newContent = stringifyMarkdown(metadata, updatedBody)
  await writeFile(answersPath, newContent)
}

export async function saveAnswer(
  interviewId: string,
  questionId: string,
  data: {
    score?: number
    candidate_response?: string
    question?: string
    answer?: string
    ai_score?: number
  }
): Promise<void> {
  const interviewDir = await findInterviewDir(interviewId)

  if (!interviewDir) {
    throw new InterviewNotFoundError(interviewId)
  }

  const answersPath = `${interviewDir}/answers.md`
  let content = ''
  let metadata: any = { interview_id: interviewId }
  let body = ''

  if (await exists(answersPath)) {
    content = await readFile(answersPath)
    const parsed = parseMarkdown(content)
    metadata = parsed.metadata
    body = parsed.body
  }

  const updatedBody = updateOrCreateAnswer(body, questionId, data)
  const newContent = stringifyMarkdown(metadata, updatedBody)
  await writeFile(answersPath, newContent)
}

function updateOrCreateAnswer(
  body: string,
  questionId: string,
  data: {
    score?: number
    candidate_response?: string
    question?: string
    answer?: string
    ai_score?: number
  }
): string {
  const sectionStart = `### ${questionId}`

  const fieldMap: Record<string, string> = {}

  let cleanedBody = body
  let found = false

  while (true) {
    const idx = cleanedBody.indexOf(sectionStart)
    if (idx === -1) break
    found = true

    const nextIdx = cleanedBody.indexOf('\n### ', idx + sectionStart.length)
    const end = nextIdx !== -1 ? nextIdx : cleanedBody.length
    const section = cleanedBody.substring(idx, end)

    section.split('\n').filter(line => line.startsWith('- **') && line.includes('**:')).forEach(line => {
      const m = line.match(/- \*\*([^*]+)\*\*: (.+)/)
      if (m) fieldMap[m[1]] = m[2]
    })

    cleanedBody = cleanedBody.substring(0, idx) + cleanedBody.substring(end)
  }

  if (data.score !== undefined) fieldMap['评分'] = String(data.score)
  if (data.candidate_response !== undefined) fieldMap['候选人回答'] = data.candidate_response
  if (data.ai_score !== undefined) fieldMap['AI评分'] = String(data.ai_score)

  const newFields = Object.entries(fieldMap)
    .map(([name, value]) => `- **${name}**: ${value}`)
    .join('\n')
  const newSection = `\n${sectionStart}\n${newFields}\n`

  if (found) {
    return cleanedBody + newSection
  }

  let section = `\n### ${questionId}\n`
  if (data.question) section += `- **问题**: ${data.question}\n`
  if (data.answer) section += `- **参考答案**: ${data.answer}\n`
  if (data.candidate_response) section += `- **候选人回答**: ${data.candidate_response}\n`
  if (data.score !== undefined) section += `- **评分**: ${data.score}\n`
  section += `- **记录时间**: ${new Date().toISOString()}\n`
  return body + section
}

export async function saveAssessment(
  interviewId: string,
  assessmentData: {
    recommended_level?: string
    comprehensive_score?: number
    hiring_recommendation?: string
    hiring_reason?: string
    communication_score?: number
    project_score?: number
    potential_score?: number
    values_score?: number
    candidate_bonus_score?: number
  }
): Promise<void> {
  const interviewDir = await findInterviewDir(interviewId)
  if (!interviewDir) throw new InterviewNotFoundError(interviewId)

  const detail = await getInterviewDetail(interviewId)
  const assessmentPath = `${interviewDir}/assessment.md`

  let existingMeta: any = {
    interview_id: interviewId,
    candidate_name: detail.candidate_name,
    job_role: detail.job_role,
    target_level: detail.target_level,
  }

  if (await exists(assessmentPath)) {
    const content = await readFile(assessmentPath)
    const { metadata } = parseMarkdown(content)
    existingMeta = { ...existingMeta, ...metadata }
  }

  const updatedMeta = {
    ...existingMeta,
    ...assessmentData,
    assessed_at: new Date().toISOString(),
    assessment_method: 'manual' as const,
  }

  const body = buildAssessmentBody(updatedMeta)
  const content = stringifyMarkdown(updatedMeta, body)
  await writeFile(assessmentPath, content)
}

function buildAssessmentBody(data: any): string {
  let body = `# 面试评定结果 - ${data.candidate_name}\n\n`
  body += `## 评定信息\n`
  body += `| 项目 | 内容 |\n`
  body += `|------|------|\n`
  body += `| 推荐职级 | ${data.recommended_level || '-'} |\n`
  body += `| 综合得分 | ${data.comprehensive_score || '-'} |\n`
  body += `| 录用建议 | ${data.hiring_recommendation || '-'} |\n`
  body += `| 沟通能力 | ${data.communication_score || '-'} |\n`
  body += `| 项目能力 | ${data.project_score || '-'} |\n`
  body += `| 潜力 | ${data.potential_score || '-'} |\n`
  body += `| 价值观 | ${data.values_score || '-'} |\n`
  body += `| 手动加分 | ${data.candidate_bonus_score || 0} |\n`
  if (data.hiring_reason) body += `\n## 评定理由\n${data.hiring_reason}\n`
  return body
}

export async function deleteInterview(interviewId: string): Promise<void> {
  const interviewDir = await findInterviewDir(interviewId)

  if (!interviewDir) return

  // 删除目录下的所有文件
  const files = await listFiles(interviewDir)
  for (const file of files) {
    await deleteFile(file)
  }

  // 删除空目录
  await deleteDirectory(interviewDir)
}

export async function findInterviewDir(interviewId: string): Promise<string | null> {
  console.log('[findInterviewDir] 查找面试ID:', interviewId)
  const files = await listFiles('')
  console.log('[findInterviewDir] 文件总数:', files.length)
  
  // 找到所有 interview.md 文件
  const interviewFiles = files.filter(f => {
    const normalizedPath = f.replace(/\\/g, '/')
    return normalizedPath.endsWith('/interview.md') && normalizedPath.includes('/interviews/')
  })
  
  console.log('[findInterviewDir] interview.md 文件数:', interviewFiles.length)
  
  // 读取每个 interview.md 文件，查找匹配的 interviewId
  for (const file of interviewFiles) {
    try {
      const content = await readFile(file)
      const { metadata } = parseMarkdown<Interview>(content)
      if (metadata.interview_id === interviewId) {
        // 提取目录路径
        const normalizedPath = file.replace(/\\/g, '/')
        const match = normalizedPath.match(/^([^/]+\/interviews\/[^/]+)/)
        if (match) {
          console.log('[findInterviewDir] 找到匹配:', match[1])
          return match[1]
        }
      }
    } catch (error) {
      console.warn('[findInterviewDir] 读取文件失败:', file, error)
    }
  }
  
  console.log('[findInterviewDir] 未找到匹配的面试')
  return null
}

async function findInterviewFile(interviewId: string): Promise<string | null> {
  const interviewDir = await findInterviewDir(interviewId)
  return interviewDir ? `${interviewDir}/interview.md` : null
}

function buildInterviewBody(interview: Interview): string {
  let body = `# 面试记录 - ${interview.candidate_name}\n\n`
  
  body += `## 基本信息\n`
  body += `| 项目 | 内容 |\n`
  body += `|------|------|\n`
  body += `| 候选人 | ${interview.candidate_name} |\n`
  body += `| 面试官 | ${interview.interviewer} |\n`
  body += `| 面试工种 | ${interview.job_role} |\n`
  body += `| 目标职级 | ${interview.target_level} |\n`
  body += `| 面试日期 | ${interview.interview_date} |\n`
  body += `| 面试状态 | ${interview.status} |\n`
  
  return body
}

function parseQuestionsFromBody(body: string): any[] {
  const questions: any[] = []
  const blocks = body.split(/### Q\d+:/).filter(block => block.trim())
  
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim())
    
    const title = lines[0] || ''
    let difficulty = ''
    let dimension = ''
    let category = ''
    let answer = ''
    
    for (const line of lines) {
      const diffMatch = line.match(/\*\*难度\*\*[：:]\s*(.+)/)
      if (diffMatch) difficulty = diffMatch[1]
      
      const dimMatch = line.match(/\*\*考察维度\*\*[：:]\s*(.+)/)
      if (dimMatch) dimension = dimMatch[1]

      const catMatch = line.match(/\*\*类型\*\*[：:]\s*(.+)/)
      if (catMatch) category = catMatch[1]
      
      const ansMatch = line.match(/\*\*参考答案[：:]\*\*\s*(.+)/)
      if (ansMatch) answer = ansMatch[1]
    }
    
    if (!answer) {
      const ansIndex = block.indexOf('**参考答案')
      if (ansIndex !== -1) {
        const afterAnswer = block.substring(ansIndex).replace(/\*\*参考答案[：:]\*\*\s*/, '').trim()
        answer = afterAnswer.split(/\n###/)[0].trim()
      }
    }
    
    if (title) {
      questions.push({
        id: `Q${questions.length + 1}`,
        question_id: `Q${questions.length + 1}`,
        title: title,
        question: title,
        difficulty: difficulty || 'L2-中级',
        evaluation_dimension: dimension || '综合能力',
        category: category,
        answer: answer,
      })
    }
  }
  
  return questions
}

export interface CandidateTag {
  category: string
  tags: string[]
}

export async function generateCandidateTags(interviewId: string, onChunk?: (chunk: string) => void): Promise<CandidateTag[]> {
  const detail = await getInterviewDetail(interviewId)
  if (!detail.resume || !detail.resume.content) {
    throw new Error('请先上传候选人简历')
  }
  
  const interviewDir = await findInterviewDir(interviewId)
  if (!interviewDir) throw new InterviewNotFoundError(interviewId)
  
  const config = await getConfig()
  const defaultModel = config.aiModels?.find((m: any) => m.isDefault)
  if (!defaultModel) throw new Error('请先在系统设置中配置 AI 模型')
  
  const jobRole = detail.job_role || 'backend_dev'
  let jdInfo = ''
  if (detail.jd_id) {
    try {
      const jdPath = `workspaces/${jobRole}/templates/jd-${detail.jd_id}-template.md`
      const jdExists = await exists(jdPath)
      if (jdExists) jdInfo = await readFile(jdPath)
    } catch {
      try {
        const templateFiles = await listFiles(`workspaces/${jobRole}/templates/`)
        const matchingFile = templateFiles.find(f => {
          const fileName = f.replace(/\\/g, '/').split('/').pop() || ''
          return fileName.startsWith('jd-') && fileName.endsWith('-template.md') && fileName.includes(detail.jd_id!)
        })
        if (matchingFile) jdInfo = await readFile(matchingFile)
      } catch { console.warn('无法读取 JD 配置文件') }
    }
  }
  
  const payload = {
    model: defaultModel.model,
    stream: true,
    messages: [
      {
        role: 'system',
        content: `你是一位资深面试官和人才评估专家，擅长从候选人简历中提炼关键特征标签。

输出要求：
严格按照以下JSON格式输出，不要输出任何其他内容：
[{"category":"技术类","tags":["Java","Spring Boot","MySQL"]},{"category":"项目类","tags":["电商系统","微服务架构"]},{"category":"软技能类","tags":["团队协作","跨部门沟通"]},{"category":"职业规划类","tags":["技术管理转型"]},{"category":"岗位挑战类","tags":["高压交付","多线并行"]},{"category":"领导力类","tags":["团队建设","绩效管理"]},{"category":"行业洞察类","tags":["互联网+","数字化转型"]}]

标签分类要求（必须包含以下大类，每个大类至少1个标签）：
1. 技术类：候选人掌握的技术栈、框架、工具、语言
2. 项目类：候选人参与的项目类型、业务领域、架构模式
3. 软技能类：沟通、协作、抗压等非技术能力
4. 职业规划类：候选人的发展方向、转型意向、成长诉求
5. 岗位挑战类：候选人可能面临的岗位挑战、风险点
6. 领导力类：管理经验、团队建设、决策能力、绩效管理
7. 行业洞察类：行业认知、商业模式理解、趋势判断

每个标签必须简短（2-8字），精准概括一个特征维度。
禁止输出任何非JSON内容，包括说明文字、markdown标记等。`,
      },
      {
        role: 'user',
        content: `请根据以下信息生成候选人特征标签：

【候选人简历】
${detail.resume.content}

【岗位要求】
${jdInfo || '无特定岗位要求'}

请严格按照JSON格式输出标签集合。`,
      },
    ],
  }
  
  const response = await fetch(`${defaultModel.baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${defaultModel.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: 'AI API 调用失败' } }))
    throw new Error(errorData.error?.message || `AI API 调用失败 (${response.status})`)
  }
  
  const reader = response.body?.getReader()
  if (!reader) throw new Error('无法获取流式响应')
  
  const decoder = new TextDecoder()
  let fullContent = ''
  let buffer = ''
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5)
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        const chunk = parsed.choices?.[0]?.delta?.content || ''
        if (chunk) { fullContent += chunk; if (onChunk) onChunk(chunk) }
      } catch {}
    }
  }
  
  let tags: CandidateTag[] = []
  try {
    const jsonMatch = fullContent.match(/\[[\s\S]*\]/)
    if (jsonMatch) tags = JSON.parse(jsonMatch[0])
  } catch {}
  
  if (tags.length === 0) {
    try { tags = JSON.parse(fullContent) } catch {}
  }
  
  if (tags.length === 0) throw new Error('标签解析失败，请重试')
  
  const tagsMetadata = {
    interview_id: interviewId,
    candidate_name: detail.candidate_name,
    generated_at: new Date().toISOString(),
  }
  
  const tagsBody = tags.map(t => `### ${t.category}\n${t.tags.map(tag => `- ${tag}`).join('\n')}`).join('\n\n')
  const tagsContent = stringifyMarkdown(tagsMetadata, tagsBody)
  await writeFile(`${interviewDir}/tags.md`, tagsContent)
  
  return tags
}

export async function getCandidateTags(interviewId: string): Promise<CandidateTag[]> {
  const interviewDir = await findInterviewDir(interviewId)
  if (!interviewDir) return []
  
  const tagsPath = `${interviewDir}/tags.md`
  const fileExists = await exists(tagsPath)
  if (!fileExists) return []
  
  try {
    const content = await readFile(tagsPath)
    const { body } = parseMarkdown(content)
    
    const tags: CandidateTag[] = []
    const blocks = body.split(/###\s+/).filter(b => b.trim())
    
    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim())
      const category = lines[0] || ''
      const tagsList = lines.slice(1).filter(l => l.startsWith('-')).map(l => l.replace(/^-\s*/, '').trim())
      if (category && tagsList.length > 0) {
        tags.push({ category, tags: tagsList })
      }
    }
    
    return tags
  } catch {
    return []
  }
}

export async function saveCandidateTags(interviewId: string, tags: CandidateTag[]): Promise<void> {
  const interviewDir = await findInterviewDir(interviewId)
  if (!interviewDir) throw new InterviewNotFoundError(interviewId)
  
  const detail = await getInterviewDetail(interviewId)
  const tagsMetadata = {
    interview_id: interviewId,
    candidate_name: detail.candidate_name,
    generated_at: new Date().toISOString(),
  }
  
  const tagsBody = tags.map(t => `### ${t.category}\n${t.tags.map(tag => `- ${tag}`).join('\n')}`).join('\n\n')
  const tagsContent = stringifyMarkdown(tagsMetadata, tagsBody)
  await writeFile(`${interviewDir}/tags.md`, tagsContent)
}

function assignDifficultyToQuestions(
  questions: QuestionWithAnswer[],
  distributions: Record<string, number>,
  difficultyLevels: string[]
): string[] {
  const assignments: string[] = []
  const total = questions.length

  if (difficultyLevels.length === 0 || total === 0) {
    return questions.map(() => 'L2-中级')
  }

  if (difficultyLevels.length === 1) {
    return questions.map(() => difficultyLevels[0])
  }

  let remaining = total
  for (let i = 0; i < difficultyLevels.length; i++) {
    const level = difficultyLevels[i]
    const pct = distributions[level] || 0
    let count = Math.round(total * pct / 100)
    if (i === difficultyLevels.length - 1) {
      count = remaining
    } else {
      count = Math.min(count, remaining)
      remaining -= count
    }
    for (let j = 0; j < count; j++) {
      assignments.push(level)
    }
  }

  while (assignments.length < total) {
    assignments.push(difficultyLevels[difficultyLevels.length - 1])
  }

  return assignments.slice(0, total)
}

function parseAnswersFromBody(body: string): any[] {
  const answers: any[] = []
  const regex = /### (Q\d+)(?:[: ]([^\n]+))?\n((?:- \*\*[^*]+\*\*:[^\n]*(?:\n|$)*)+)/g
  let match
  
  while ((match = regex.exec(body)) !== null) {
    const questionId = match[1]
    const title = match[2]?.trim() || ''
    const fieldsRaw = match[3] || ''
    
    const getField = (name: string): string | undefined => {
      const fieldRegex = new RegExp(`- \\*\\*${name}\\*\\*:[^\\n]*([\\n]|$)`)
      const fieldMatch = fieldsRaw.match(fieldRegex)
      if (!fieldMatch) return undefined
      const line = fieldMatch[0].replace(/[\n]$/, '')
      const valueMatch = line.match(/- \*\*[^*]+\*\*: (.+)/)
      return valueMatch ? valueMatch[1]?.trim() : undefined
    }

    answers.push({
      question_id: questionId,
      title,
      difficulty: getField('难度') || '',
      evaluation_dimension: getField('考察维度') || '',
      answer_status: getField('回答状态')?.trim() || 'pending',
      answer_content: getField('候选人回答') || getField('回答内容') || '',
      score: getField('评分') ? parseInt(getField('评分')!) : undefined,
      ai_score: getField('AI评分') ? parseInt(getField('AI评分')!) : undefined,
    })
  }
  
  return answers
}

function updateAnswerInBody(body: string, questionId: string, updates: Record<string, any>): string {
  const regex = new RegExp(`(### ${questionId}: .+?\\n)([\\s\\S]*?)(?=\\n### |$)`, 'g')
  
  return body.replace(regex, (match, header, content) => {
    let newContent = content
    
    if (updates.answer_content) {
      newContent = newContent.replace(
        /- \*\*回答内容\*\*: .*\n/,
        `- **回答内容**: ${updates.answer_content}\n`
      )
    }
    
    if (updates.answer_status) {
      newContent = newContent.replace(
        /- \*\*回答状态\*\*: .*\n/,
        `- **回答状态**: ${updates.answer_status}\n`
      )
    }
    
    return header + newContent
  })
}

export interface GenerateQuestionsOptions {
  difficultyLevels: string[]
  distributions: Record<string, number>
  questionCount: number
  selectedCategories?: string[]
  categoryCounts?: Record<string, number>
  onChunk?: (chunk: string) => void
}

export async function generateQuestions(interviewId: string, options: GenerateQuestionsOptions): Promise<string> {
  const { readFile, writeFile, createDirectory, exists } = await import('@/core/filesystem')
  
  const detail = await getInterviewDetail(interviewId)
  if (!detail.resume || !detail.resume.content) {
    throw new Error('请先上传简历')
  }
  
  const interviewDir = await findInterviewDir(interviewId)
  if (!interviewDir) {
    throw new Error('面试不存在')
  }
  
  const config = await getConfig()
  const defaultModel = config.aiModels?.find((m: any) => m.isDefault)
  
  if (!defaultModel) {
    throw new Error('请先在系统设置中配置 AI 模型')
  }
  
  const jobRole = detail.job_role || 'backend_dev'
  let jdInfo = ''
  if (detail.jd_id) {
    try {
      const jdTemplatePath = `${jobRole}/templates/jd-${detail.jd_id}-template.md`
      const jdContent = await readFile(jdTemplatePath)
      jdInfo = jdContent
    } catch {
      try {
        const { listFiles: listJDFiles } = await import('@/core/filesystem')
        const templateFiles = await listJDFiles(`${jobRole}/templates/`)
        const matchingFile = templateFiles.find(f => {
          const normalizedPath = f.replace(/\\/g, '/')
          const fileName = normalizedPath.split('/').pop() || ''
          return fileName.startsWith('jd-') && fileName.endsWith('-template.md') && fileName.includes(detail.jd_id!)
        })
        if (matchingFile) {
          const jdContent = await readFile(matchingFile)
          jdInfo = jdContent
        }
      } catch {
        console.warn('无法读取 JD 配置文件')
      }
    }
  }
  
  const distributionText = Object.entries(options.distributions)
    .map(([key, value]) => `${key}: ${value}%`)
    .join('、')
  
  const questionBankContents: string[] = []
  for (const level of options.difficultyLevels) {
    const bankPath = `workspaces/${jobRole}/question-bank/${level}/questions.md`
    try {
      const fileExists = await exists(bankPath)
      if (!fileExists) {
        console.log(`[interview] 题库 ${level} 文件不存在，跳过`)
        continue
      }
      const content = await readFile(bankPath)
      if (content && content.trim().length > 0) {
        const maxBankLength = 2000
        const truncatedContent = content.length > maxBankLength 
          ? content.substring(0, maxBankLength) + '\n...（题库内容较长，已截取前部分作为参考）'
          : content
        questionBankContents.push(`【${level}题库内容（参考出题）】\n${truncatedContent}`)
      }
    } catch (e) {
      console.warn(`[interview] 读取题库 ${level} 失败:`, e)
    }
  }
  
  const bankSection = questionBankContents.length > 0 
    ? `\n\n【已有题库内容（请参考这些题目风格和知识点出题，但不要直接复制原题，应在此基础上延伸和变化）】\n${questionBankContents.join('\n\n')}`
    : ''

  const existingQuestions = detail.questions?.questions || []
  const existingQuestionsSection = existingQuestions.length > 0
    ? `\n\n【本次面试已出题目（严禁生成与以下题目相同或高度相似的题目，必须确保新题目与这些题目完全不同）】\n${existingQuestions.map((q: any, i: number) => `${i + 1}. ${q.title || q.question}`).join('\n')}`
    : ''
  
  const payload = {
    model: defaultModel.model,
    stream: true,
    messages: [
      {
        role: 'system',
        content: `你是一位资深技术面试官，擅长针对候选人背景精准出题。

输出要求：
1. 格式严格遵守，每道题必须按以下顺序输出三个字段，不得省略或变更顺序：
类型：[问题所属技术领域，必须使用指定的类型名称]
题目：[问题内容]
答案：[参考答案]

每道题之间空一行。不要在任何其他位置输出"类型"或类型名称。

2. 答案要求：
- 答案长度最少50字，最多不超过200字
- 直击核心要点，不展开赘述，避免过渡解释
- 使用专业术语，避免口语化表述
- 答案应包含关键结论或核心机制，而非泛泛描述
- 答案要逐条列举

3. 题目要求：
- 题目控制在50字以内，简洁明确
- 紧扣候选人技术栈与项目经验，考察实际工程能力
- 题目应具有区分度，能甄别不同水平候选人
- 难度严格按指定比例分布
- 禁止输出任何额外说明、编号前缀或markdown格式标记
- 技术类标签（如Java、Spring Boot、MySQL、Redis等具体技术名称）的问题必须聚焦于该技术的具体知识点、核心原理和关键机制，不得出"如何设计"、"如何实现"、"如何搭建"等架构设计类题目。应考察候选人对该技术本身的理解深度，例如原理、机制、配置、特性、差异对比等
- 类型必须与指定的类型名称完全一致，不得自行修改或细化。例如指定"Java"则类型必须写"Java"，不能写"Java基础"或"JVM"
- 如果指定了各类型的题目数量，必须严格按照指定类型和数量出题，类型名称必须与指定的名称完全匹配
- 如果指定了需要覆盖的类型，优先为这些类型出题，类型名称必须与指定的类型名称完全一致

4. 若提供已有题库，应参考其考察方向和知识领域延伸出题，可以直接复制原题`,
      },
      {
        role: 'user',
        content: `请根据以下信息生成面试题：

【候选人简历】
${detail.resume.content}

【岗位要求与考察维度】
${jdInfo || '无特定岗位限制'}

【题库选择与难度分布】
选择题库：${options.difficultyLevels.join('、')}
难度分布：${distributionText}

【题目数量与类型分配】
共 ${options.questionCount} 道题${options.categoryCounts && Object.keys(options.categoryCounts).length > 0 ? `\n各类型题目数量：\n${Object.entries(options.categoryCounts).map(([cat, count]) => `- ${cat}: ${count}道`).join('\n')}` : ''}${options.selectedCategories && options.selectedCategories.length > 0 && !options.categoryCounts ? `\n\n【需要覆盖的问题类型（优先为这些类型出题）】\n${options.selectedCategories.join('、')}` : ''}${bankSection}${existingQuestionsSection}

请严格按照要求的格式输出所有题目。`,
      },
    ],
  }
  
  const response = await fetch(`${defaultModel.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${defaultModel.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: 'AI API 调用失败' } }))
    throw new Error(errorData.error?.message || `AI API 调用失败 (${response.status})`)
  }
  
  // 流式读取
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('无法获取流式响应')
  }
  
  const decoder = new TextDecoder()
  let fullContent = ''
  let buffer = ''
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      
      const data = trimmed.slice(5)
      if (data === '[DONE]') continue
      
      try {
        const parsed = JSON.parse(data)
        const chunk = parsed.choices?.[0]?.delta?.content || ''
        if (chunk) {
          fullContent += chunk
          if (options.onChunk) {
            options.onChunk(chunk)
          }
        }
      } catch {
        // 解析失败，跳过
      }
    }
  }
  
  if (!fullContent.trim()) {
    throw new Error('未生成有效的问题内容')
  }
  
  // 解析并保存
  const newQuestions = parseGeneratedQuestions(fullContent)
  const newDifficultyAssignments = assignDifficultyToQuestions(newQuestions, options.distributions, options.difficultyLevels)
  
  const existingCount = existingQuestions.length
  const totalCount = existingCount + newQuestions.length

  const existingQuestionsBody = existingQuestions.map((q: any, index: number) => {
    const difficulty = q.difficulty || 'L2-中级'
    const dimension = q.evaluation_dimension || '综合能力'
    const question = q.title || q.question || ''
    const answer = q.answer || ''
    const category = q.category || ''
    return `### Q${index + 1}: ${question}\n- **难度**: ${difficulty}\n- **考察维度**: ${dimension}\n- **类型**: ${category}\n\n**参考答案：** ${answer}`
  }).join('\n\n')

  const newQuestionsBody = newQuestions.map((q, index) => {
    const difficulty = newDifficultyAssignments[index] || 'L2-中级'
    const dimension = detail.target_level || '综合能力'
    const category = q.category || ''
    const qIndex = existingCount + index + 1
    return `### Q${qIndex}: ${q.question}\n- **难度**: ${difficulty}\n- **考察维度**: ${dimension}\n- **类型**: ${category}\n\n**参考答案：** ${q.answer}`
  }).join('\n\n')

  const separator = existingQuestionsBody && newQuestionsBody ? '\n\n' : ''
  const questionsBody = existingQuestionsBody + separator + newQuestionsBody

  const totalAiGenerated = (detail.questions?.ai_generated || 0) + newQuestions.length
  const questionsMetadata = {
    interview_id: interviewId,
    candidate_name: detail.candidate_name,
    job_role: detail.job_role,
    target_level: detail.target_level,
    total_questions: totalCount,
    difficulty_distribution: options.distributions,
    from_bank: detail.questions?.from_bank || 0,
    ai_generated: totalAiGenerated,
    generated_at: new Date().toISOString(),
  }

  const questionsContent = stringifyMarkdown(questionsMetadata, questionsBody)
  await writeFile(`${interviewDir}/questions.md`, questionsContent)
  
  return fullContent
}

// 解析 AI 返回的格式化的问题
interface QuestionWithAnswer {
  question: string
  answer: string
  category: string
}

function parseGeneratedQuestions(content: string): QuestionWithAnswer[] {
  const questions: QuestionWithAnswer[] = []
  
  // 先尝试按"类型："分割，每个块包含类型+题目+答案
  const typeBlocks = content.split(/类型[：:]/).filter(block => block.trim())
  
  for (const block of typeBlocks) {
    const titleIndex = block.search(/题目[：:]/)
    if (titleIndex === -1) continue
    
    const category = block.substring(0, titleIndex).trim().replace(/[\n\r]/g, '')
    const afterTitle = block.substring(titleIndex).replace(/^题目[：:]\s*/, '')
    
    const answerIndex = afterTitle.search(/答案[：:]/)
    if (answerIndex === -1) continue
    
    const questionText = afterTitle.substring(0, answerIndex).trim()
    const answerText = afterTitle.substring(answerIndex).replace(/^答案[：:]\s*/, '').trim()
    
    if (questionText && answerText) {
      questions.push({ question: questionText, answer: answerText, category: category || '' })
    }
  }
  
  // fallback：如果按"类型："分割无结果，按"题目："分割
  if (questions.length === 0) {
    const qBlocks = content.split(/题目[：:]/).filter(block => block.trim())
    
    for (const block of qBlocks) {
      const answerIndex = block.search(/答案[：:]/)
      if (answerIndex === -1) continue
      
      const questionText = block.substring(0, answerIndex).trim()
      const answerText = block.substring(answerIndex).replace(/^答案[：:]\s*/, '').trim()
      
      if (questionText && answerText) {
        questions.push({ question: questionText, answer: answerText, category: '' })
      }
    }
  }
  
  return questions
}
