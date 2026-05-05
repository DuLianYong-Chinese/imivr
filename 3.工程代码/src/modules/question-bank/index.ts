import type { 
  Question, 
  QuestionListItem, 
  CreateQuestionInput,
  PaginatedResult 
} from '@/types'
import { exists, readFile, writeFile, deleteFile, listFiles, createDirectory } from '@/core/filesystem'
import { parseMarkdown, stringifyMarkdown } from '@/core/markdown'
import { callAIWithJSON } from '@/core/ai'
import { getPromptsForJobRole } from '@/core/plugin'

export class QuestionNotFoundError extends Error {
  constructor(public questionId: string) {
    super(`Question not found: ${questionId}`)
    this.name = 'QuestionNotFoundError'
  }
}

const DIFFICULTY_FOLDERS: Record<string, string> = {
  L1: 'L1-基础',
  L2: 'L2-理解',
  L3: 'L3-分析',
  L4: 'L4-设计',
  L5: 'L5-专家',
}

export async function listQuestions(
  jobRole: string,
  options?: {
    difficulty?: string
    category?: string
    evaluationDimension?: string
    page?: number
    pageSize?: number
  }
): Promise<PaginatedResult<QuestionListItem>> {
  const qbPath = `${jobRole}/question-bank`
  const difficulties = options?.difficulty
    ? [DIFFICULTY_FOLDERS[options.difficulty] || options.difficulty]
    : Object.values(DIFFICULTY_FOLDERS)

  const questions: QuestionListItem[] = []
  
  for (const diffFolder of difficulties) {
    const diffPath = `${qbPath}/${diffFolder}`
    const files = await listFiles(diffPath)
    const mdFiles = files.filter(f => f.endsWith('.md'))
    
    for (const file of mdFiles) {
      try {
        const content = await readFile(file)
        const { metadata } = parseMarkdown<Question>(content)
        
        if (options?.category && metadata.category !== options.category) continue
        if (options?.evaluationDimension && metadata.evaluation_dimension !== options.evaluationDimension) continue
        
        questions.push({
          question_id: metadata.question_id,
          title: metadata.title,
          difficulty: metadata.difficulty,
          category: metadata.category,
          evaluation_dimension: metadata.evaluation_dimension,
          tags: metadata.tags,
        })
      } catch {
        // Skip invalid files
      }
    }
  }

  const page = options?.page || 1
  const pageSize = options?.pageSize || 20
  const start = (page - 1) * pageSize
  const end = start + pageSize

  return {
    data: questions.slice(start, end),
    total: questions.length,
    page,
    pageSize,
    totalPages: Math.ceil(questions.length / pageSize),
  }
}

export async function getQuestion(jobRole: string, questionId: string): Promise<Question> {
  const questionPath = await findQuestionFile(jobRole, questionId)
  
  if (!questionPath || !(await exists(questionPath))) {
    throw new QuestionNotFoundError(questionId)
  }
  
  const content = await readFile(questionPath)
  const { metadata, body } = parseMarkdown<Question>(content)
  
  return {
    ...metadata,
    description: body,
  }
}

export async function createQuestion(input: CreateQuestionInput): Promise<Question> {
  const questionId = await generateQuestionId(input.jobRole, input.difficulty)
  const diffFolder = DIFFICULTY_FOLDERS[input.difficulty]
  const qbPath = `${input.jobRole}/question-bank/${diffFolder}`
  
  await createDirectory(qbPath)
  
  const fileName = sanitizeFileName(input.title)
  const filePath = `${qbPath}/${fileName}.md`
  
  const now = new Date().toISOString().split('T')[0]
  const question: Question = {
    ...input,
    question_id: questionId,
    job_role: input.jobRole,
    created_at: now,
    updated_at: now,
  }
  
  const body = buildQuestionBody(question)
  const content = stringifyMarkdown(question, body)
  
  await writeFile(filePath, content)
  
  return question
}

export async function updateQuestion(
  jobRole: string,
  questionId: string,
  updates: Partial<CreateQuestionInput>
): Promise<void> {
  const questionPath = await findQuestionFile(jobRole, questionId)
  
  if (!questionPath || !(await exists(questionPath))) {
    throw new QuestionNotFoundError(questionId)
  }
  
  const content = await readFile(questionPath)
  const { metadata, body } = parseMarkdown<Question>(content)
  
  const updatedMetadata: Question = {
    ...metadata,
    ...updates,
    updated_at: new Date().toISOString().split('T')[0],
  }
  
  const newBody = updates.description || body
  const newContent = stringifyMarkdown(updatedMetadata, newBody)
  
  await writeFile(questionPath, newContent)
}

export async function deleteQuestion(jobRole: string, questionId: string): Promise<void> {
  const questionPath = await findQuestionFile(jobRole, questionId)
  
  if (!questionPath || !(await exists(questionPath))) {
    throw new QuestionNotFoundError(questionId)
  }
  
  await deleteFile(questionPath)
}

export async function generateQuestionsByAI(
  jobRole: string,
  options: {
    difficulty: string
    category: string
    evaluationDimension: string
    count: number
    topic: string
  }
): Promise<Question[]> {
  const prompts = getPromptsForJobRole(jobRole)
  
  const result = await callAIWithJSON<{ questions: Partial<Question>[] }>(
    prompts.questionGeneration,
    {
      job_role: jobRole,
      difficulty: options.difficulty,
      category: options.category,
      evaluation_dimension: options.evaluationDimension,
      question_count: options.count,
      topic: options.topic,
    }
  )
  
  const createdQuestions: Question[] = []
  
  for (const q of result.questions) {
    const question = await createQuestion({
      jobRole,
      difficulty: options.difficulty as 'L1' | 'L2' | 'L3' | 'L4' | 'L5',
      category: options.category,
      evaluation_dimension: options.evaluationDimension,
      applicable_levels: q.applicable_levels || ['P3', 'P4', 'P5'],
      tags: q.tags || [],
      title: q.title || '',
      description: q.description || '',
      expected_answer: q.expected_answer || [],
      score_criteria: q.score_criteria || {},
      follow_up_questions: q.follow_up_questions || [],
    })
    createdQuestions.push(question)
  }
  
  return createdQuestions
}

async function findQuestionFile(jobRole: string, questionId: string): Promise<string | null> {
  const qbPath = `${jobRole}/question-bank`

  // 遍历所有难度文件夹查找题目
  for (const diffFolder of Object.values(DIFFICULTY_FOLDERS)) {
    const diffPath = `${qbPath}/${diffFolder}`
    const files = await listFiles(diffPath)
    const questionFiles = files.filter(f => f.includes(questionId))

    if (questionFiles.length > 0) {
      return questionFiles[0]
    }
  }

  return null
}

async function generateQuestionId(jobRole: string, difficulty: string): Promise<string> {
  const timestamp = Date.now().toString(36)
  return `q-${jobRole}-${difficulty.toLowerCase()}-${timestamp}`
}

function sanitizeFileName(title: string): string {
  return title
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50)
}

function buildQuestionBody(q: Question): string {
  let body = `# ${q.title}\n\n`
  
  body += `## 问题描述\n\n${q.description}\n\n`
  
  body += `## 期望答案要点\n\n`
  for (let i = 0; i < q.expected_answer.length; i++) {
    body += `${i + 1}. ${q.expected_answer[i]}\n`
  }
  
  body += `\n## 评分标准\n\n`
  body += `| 分数 | 标准 |\n`
  body += `|------|------|\n`
  for (const [range, criteria] of Object.entries(q.score_criteria)) {
    body += `| ${range} | ${criteria} |\n`
  }
  
  if (q.follow_up_questions && q.follow_up_questions.length > 0) {
    body += `\n## 追问建议\n\n`
    for (const question of q.follow_up_questions) {
      body += `- ${question}\n`
    }
  }
  
  return body
}
