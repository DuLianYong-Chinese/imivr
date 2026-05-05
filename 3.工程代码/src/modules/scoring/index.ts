import type { SubmitScoreInput, DimensionScore, Dimension } from '@/types'
import { readFile, writeFile } from '@/core/filesystem'
import { parseMarkdown, stringifyMarkdown } from '@/core/markdown'
import { findInterviewDir } from '../interview'

export class IncompleteScoringError extends Error {
  constructor(public interviewId: string, public pendingCount: number) {
    super(`Incomplete scoring: ${pendingCount} questions pending`)
    this.name = 'IncompleteScoringError'
  }
}

export async function getScoreList(interviewId: string): Promise<{
  total: number
  scored: number
  pending: number
  answers: any[]
}> {
  const interviewDir = await findInterviewDir(interviewId)
  
  if (!interviewDir) {
    throw new Error(`Interview not found: ${interviewId}`)
  }
  
  const answersPath = `${interviewDir}/answers.md`
  const content = await readFile(answersPath)
  const { body } = parseMarkdown(content)
  
  const answers = parseAnswersFromBody(body)
  const scored = answers.filter(a => a.score !== undefined).length
  
  return {
    total: answers.length,
    scored,
    pending: answers.length - scored,
    answers,
  }
}

export async function submitScore(input: SubmitScoreInput): Promise<void> {
  if (input.score < 0 || input.score > 10 || !Number.isInteger(input.score)) {
    throw new Error('Score must be an integer between 0 and 10')
  }
  
  const interviewDir = await findInterviewDir(input.interviewId)
  
  if (!interviewDir) {
    throw new Error(`Interview not found: ${input.interviewId}`)
  }
  
  const answersPath = `${interviewDir}/answers.md`
  const content = await readFile(answersPath)
  const { metadata, body } = parseMarkdown(content)
  
  const updatedBody = updateScoreInBody(body, input.questionId, {
    score: input.score,
    score_remark: input.scoreRemark || '',
    passed: input.passed,
    scored_at: new Date().toISOString(),
  })
  
  const newContent = stringifyMarkdown(metadata, updatedBody)
  await writeFile(answersPath, newContent)
}

export async function batchScore(
  interviewId: string,
  scores: Array<{
    questionId: string
    score: number
    scoreRemark?: string
    passed: boolean
  }>
): Promise<{ success: number; failed: number; errors: string[] }> {
  const interviewDir = await findInterviewDir(interviewId)
  
  if (!interviewDir) {
    throw new Error(`Interview not found: ${interviewId}`)
  }
  
  const answersPath = `${interviewDir}/answers.md`
  const content = await readFile(answersPath)
  const { metadata, body } = parseMarkdown(content)
  
  let updatedBody = body
  let success = 0
  const errors: string[] = []
  
  for (const s of scores) {
    try {
      if (s.score < 0 || s.score > 10 || !Number.isInteger(s.score)) {
        throw new Error('Invalid score')
      }
      
      updatedBody = updateScoreInBody(updatedBody, s.questionId, {
        score: s.score,
        score_remark: s.scoreRemark || '',
        passed: s.passed,
        scored_at: new Date().toISOString(),
      })
      success++
    } catch (e) {
      errors.push(`Question ${s.questionId}: ${e}`)
    }
  }
  
  const newContent = stringifyMarkdown(metadata, updatedBody)
  await writeFile(answersPath, newContent)
  
  return {
    success,
    failed: scores.length - success,
    errors,
  }
}

export async function getDimensionScores(interviewId: string): Promise<{
  dimensions: DimensionScore[]
  totalScore: number
}> {
  const interviewDir = await findInterviewDir(interviewId)
  
  if (!interviewDir) {
    throw new Error(`Interview not found: ${interviewId}`)
  }
  
  const answersPath = `${interviewDir}/answers.md`
  const answersContent = await readFile(answersPath)
  const { body: answersBody } = parseMarkdown(answersContent)
  const answers = parseAnswersFromBody(answersBody)
  
  const workspacePath = interviewDir.replace(/\/interviews\/.*$/, '')
  const workspacePath2 = `${workspacePath}/workspace.md`
  const workspaceContent = await readFile(workspacePath2)
  const { metadata: workspaceMeta } = parseMarkdown(workspaceContent)
  
  const dimensions = (workspaceMeta.evaluation_dimensions || []) as Dimension[]
  const dimensionMap = new Map(dimensions.map((d: Dimension) => [d.name, d.weight]))
  
  const groupedByDimension = new Map<string, { scores: number[]; weight: number }>()
  
  for (const answer of answers) {
    if (answer.score === undefined) continue
    
    const dimName = answer.evaluation_dimension
    const weight = dimensionMap.get(dimName) || 0.1
    
    if (!groupedByDimension.has(dimName)) {
      groupedByDimension.set(dimName, { scores: [], weight })
    }
    groupedByDimension.get(dimName)!.scores.push(answer.score)
  }
  
  const dimensionResults: DimensionScore[] = []
  let totalWeightedScore = 0
  let totalWeight = 0
  
  for (const [name, data] of groupedByDimension) {
    const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length
    const weightedScore = avgScore * data.weight
    
    dimensionResults.push({
      name,
      weight: data.weight,
      question_count: data.scores.length,
      scored_count: data.scores.length,
      average_score: Math.round(avgScore * 10) / 10,
      weighted_score: Math.round(weightedScore * 100) / 100,
    })
    
    totalWeightedScore += weightedScore
    totalWeight += data.weight
  }
  
  const totalScore = totalWeight > 0 
    ? Math.round((totalWeightedScore / totalWeight) * 10 * 10) / 10 
    : 0
  
  return {
    dimensions: dimensionResults,
    totalScore,
  }
}

export async function getScoreStats(interviewId: string): Promise<{
  totalQuestions: number
  scoredQuestions: number
  pendingQuestions: number
  passedQuestions: number
  failedQuestions: number
  averageScore: number
  maxScore: number
  minScore: number
}> {
  const { total, scored, pending, answers } = await getScoreList(interviewId)
  
  const scores = answers
    .filter(a => a.score !== undefined)
    .map(a => a.score)
  
  const passed = answers.filter(a => a.passed === true).length
  
  return {
    totalQuestions: total,
    scoredQuestions: scored,
    pendingQuestions: pending,
    passedQuestions: passed,
    failedQuestions: scored - passed,
    averageScore: scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 
      : 0,
    maxScore: scores.length > 0 ? Math.max(...scores) : 0,
    minScore: scores.length > 0 ? Math.min(...scores) : 0,
  }
}

function parseAnswersFromBody(body: string): any[] {
  const answers: any[] = []
  const regex = /### (Q\d+): (.+?)\n- \*\*难度\*\*: (.+?)\n- \*\*考察维度\*\*: (.+?)\n- \*\*回答状态\*\*: (.+?)(?:\n- \*\*回答内容\*\*: ([\s\S]*?))?(?:\n- \*\*评分\*\*: (\d+))?(?:\n- \*\*评分备注\*\*: (.*?))?(?:\n- \*\*是否通过\*\*: (true|false))?(?=\n###|\n*$)/g
  let match
  
  while ((match = regex.exec(body)) !== null) {
    answers.push({
      question_id: match[1],
      title: match[2],
      difficulty: match[3],
      evaluation_dimension: match[4],
      answer_status: match[5]?.trim() || 'pending',
      answer_content: match[6]?.trim() || '',
      score: match[7] ? parseInt(match[7]) : undefined,
      score_remark: match[8]?.trim() || '',
      passed: match[9] === 'true',
    })
  }
  
  return answers
}

function updateScoreInBody(
  body: string,
  questionId: string,
  updates: Record<string, any>
): string {
  const regex = new RegExp(`(### ${questionId}: .+?\\n(?:- \\*\\*[^*]+\\*\\*: .*\\n)*)`, 'g')
  
  return body.replace(regex, (match) => {
    let result = match
    
    if (updates.score !== undefined) {
      if (result.includes('**评分**:')) {
        result = result.replace(/- \*\*评分\*\*: .*\n/, `- **评分**: ${updates.score}\n`)
      } else {
        result += `- **评分**: ${updates.score}\n`
      }
    }
    
    if (updates.score_remark !== undefined) {
      if (result.includes('**评分备注**:')) {
        result = result.replace(/- \*\*评分备注\*\*: .*\n/, `- **评分备注**: ${updates.score_remark}\n`)
      } else {
        result += `- **评分备注**: ${updates.score_remark}\n`
      }
    }
    
    if (updates.passed !== undefined) {
      if (result.includes('**是否通过**:')) {
        result = result.replace(/- \*\*是否通过\*\*: .*\n/, `- **是否通过**: ${updates.passed}\n`)
      } else {
        result += `- **是否通过**: ${updates.passed}\n`
      }
    }
    
    return result
  })
}
