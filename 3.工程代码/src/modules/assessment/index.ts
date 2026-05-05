import type { AssessmentData, InterviewDetail } from '@/types'
import { readFile, writeFile, getConfig } from '@/core/filesystem'
import { parseMarkdown, stringifyMarkdown } from '@/core/markdown'
import { callAIWithJSON } from '@/core/ai'
import { getPromptsForJobRole } from '@/core/plugin'
import { getDimensionScores } from '../scoring'
import { findInterviewDir, getInterviewDetail } from '../interview'

export class AssessmentNotFoundError extends Error {
  constructor(public interviewId: string) {
    super(`Assessment not found: ${interviewId}`)
    this.name = 'AssessmentNotFoundError'
  }
}

export class AssessmentNotCompletedError extends Error {
  constructor(public interviewId: string) {
    super(`Assessment not completed: ${interviewId}`)
    this.name = 'AssessmentNotCompletedError'
  }
}

const LEVEL_ORDER = ['P3', 'P4', 'P5', 'P6', 'P7']

function determineRecommendedLevel(comprehensiveScore: number, targetLevel: string): string {
  const targetIndex = LEVEL_ORDER.indexOf(targetLevel)
  if (targetIndex === -1) return targetLevel

  if (comprehensiveScore >= 8.5) {
    return LEVEL_ORDER[Math.min(targetIndex + 1, LEVEL_ORDER.length - 1)]
  } else if (comprehensiveScore >= 4) {
    return targetLevel
  } else {
    return LEVEL_ORDER[Math.max(targetIndex - 1, 0)]
  }
}

function calculateLevelGap(targetLevel: string, recommendedLevel: string): number {
  const targetIndex = LEVEL_ORDER.indexOf(targetLevel)
  const recommendedIndex = LEVEL_ORDER.indexOf(recommendedLevel)
  return recommendedIndex - targetIndex
}

function determineHiringRecommendation(comprehensiveScore: number): '通过' | '待定' | '不通过' {
  if (comprehensiveScore >= 7) return '通过'
  if (comprehensiveScore >= 4) return '待定'
  return '不通过'
}

function getRatingDescription(score: number): string {
  if (score >= 4) return '表现突出'
  if (score >= 3) return '表现尚可'
  return '有待提升'
}

export async function assess(
  interviewId: string,
  options?: { useAI?: boolean }
): Promise<AssessmentData> {
  const interviewDir = await findInterviewDir(interviewId)
  if (!interviewDir) throw new Error(`Interview not found: ${interviewId}`)
  const interview = await getInterviewDetail(interviewId)
  if (interview.status !== 'completed') throw new AssessmentNotCompletedError(interviewId)

  const { dimensions, totalScore } = await getDimensionScores(interviewId)
  const recommendedLevel = determineRecommendedLevel(totalScore, interview.target_level)
  const levelGap = calculateLevelGap(interview.target_level, recommendedLevel)
  const hiringRecommendation = determineHiringRecommendation(totalScore)

  let assessment: AssessmentData

  if (options?.useAI !== false) {
    try {
      const prompts = getPromptsForJobRole(interview.job_role)
      const aiResult = await callAIWithJSON<{
        recommended_level: string
        strengths: string[]
        weaknesses: string[]
        hiring_recommendation: string
        hiring_reason: string
        training_suggestions: string[]
      }>(
        prompts.assessment,
        {
          candidate_info: interview.candidate_name,
          scores: JSON.stringify(dimensions),
          dimension_scores: totalScore,
        }
      )
      assessment = {
        interview_id: interviewId,
        candidate_name: interview.candidate_name,
        job_role: interview.job_role,
        target_level: interview.target_level,
        recommended_level: aiResult.recommended_level || recommendedLevel,
        level_gap: levelGap,
        comprehensive_score: totalScore,
        strengths: aiResult.strengths || [],
        weaknesses: aiResult.weaknesses || [],
        hiring_recommendation: aiResult.hiring_recommendation as any || hiringRecommendation,
        hiring_reason: aiResult.hiring_reason || '',
        training_suggestions: aiResult.training_suggestions || [],
        assessed_at: new Date().toISOString(),
        assessment_method: 'auto',
      }
    } catch {
      assessment = await calculateAssessment(interviewId, interview, dimensions, totalScore, recommendedLevel, levelGap, hiringRecommendation)
    }
  } else {
    assessment = await calculateAssessment(interviewId, interview, dimensions, totalScore, recommendedLevel, levelGap, hiringRecommendation)
  }

  const body = buildAssessmentBody(assessment, dimensions)
  const content = stringifyMarkdown(assessment, body)
  await writeFile(`${interviewDir}/assessment.md`, content)
  return assessment
}

export async function assessWithScores(
  interviewId: string,
  candidateAvg: number,
  candidateBonus: number,
  interviewerRatings: { communication: number; project: number; potential: number; values: number }
): Promise<AssessmentData> {
  const interviewDir = await findInterviewDir(interviewId)
  if (!interviewDir) throw new Error(`Interview not found: ${interviewId}`)
  const interview = await getInterviewDetail(interviewId)

  const comprehensiveScore = candidateAvg + candidateBonus + Object.values(interviewerRatings).reduce((a, b) => a + b, 0) / Object.values(interviewerRatings).filter(v => v > 0).length
  const recommendedLevel = determineRecommendedLevel(comprehensiveScore, interview.target_level)
  const levelGap = calculateLevelGap(interview.target_level, recommendedLevel)
  const hiringRecommendation = determineHiringRecommendation(comprehensiveScore)

  const ratingDescriptions: string[] = []
  if (interviewerRatings.communication > 0) {
    ratingDescriptions.push(`沟通能力：${getRatingDescription(interviewerRatings.communication)}`)
  }
  if (interviewerRatings.project > 0) {
    ratingDescriptions.push(`项目能力：${getRatingDescription(interviewerRatings.project)}`)
  }
  if (interviewerRatings.potential > 0) {
    ratingDescriptions.push(`潜力：${getRatingDescription(interviewerRatings.potential)}`)
  }
  if (interviewerRatings.values > 0) {
    ratingDescriptions.push(`价值观：${getRatingDescription(interviewerRatings.values)}`)
  }

  const questions = interview.questions?.questions || []
  const answersData = interview.answers?.answers || []
  const qAndA = questions.map((q: any, i: number) => {
    const ans = answersData.find((a: any) => a.question_id === (q.id || `Q${i + 1}`))
    return { question: q.question || q.title, answer: ans?.answer_content || '', reference: q.answer || '', dimension: q.evaluation_dimension || '', score: ans?.score || ans?.ai_score || 0 }
  }).filter(item => item.answer || item.score > 0)

  let hiringReason = ''
  try {
    const config = await getConfig()
    const defaultModel = (config?.aiModels || []).find((m: any) => m.isDefault) || (config?.aiModels || [])[0]
    if (defaultModel) {
      const prompt = `你是一位专业面试评价专家。请根据以下信息，给出简洁明了的录用理由（200字以内），按照以下格式输出，每项单独一行，格式为"维度名：评价"：

技术能力：用30-50字的描述性评价概括候选人的技术能力水平，不要只写分数，要具体说明强弱项
${ratingDescriptions.length > 0 ? ratingDescriptions.map(d => `${d}`).join('\n') : ''}
综合评价：基于以上各项能力评价，用30字左右综合总结候选人整体表现

面试信息：
- 目标职级：${interview.target_level}
- 推荐职级：${recommendedLevel}
- 综合得分：${comprehensiveScore.toFixed(1)}/10
- 录用建议：${hiringRecommendation}

候选人回答情况：
${qAndA.map(item => `【${item.dimension}】${item.question} → 得分${item.score}分`).join('\n')}

请直接输出录用理由文本，不要包含其他内容。`

      const response = await fetch(`${defaultModel.baseURL}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${defaultModel.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: defaultModel.model, messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 500 }),
      })
      if (response.ok) {
        const data = await response.json()
        hiringReason = data.choices?.[0]?.message?.content || ''
      }
    }
  } catch {}

  if (!hiringReason) {
    const dimensionMap: Record<string, { total: number; count: number }> = {}
    qAndA.forEach(item => {
      if (item.dimension && item.score > 0) {
        if (!dimensionMap[item.dimension]) dimensionMap[item.dimension] = { total: 0, count: 0 }
        dimensionMap[item.dimension].total += item.score
        dimensionMap[item.dimension].count++
      }
    })
    const dimensionScores = Object.entries(dimensionMap).map(([name, { total, count }]) => ({
      name, avg: total / count
    })).sort((a, b) => b.avg - a.avg)
    const overallAvg = candidateAvg + candidateBonus
    const levelLabel = overallAvg >= 4 ? '强' : overallAvg >= 2.5 ? '中等' : '偏弱'
    const strengths = dimensionScores.filter(d => d.avg >= 3).map(d => d.name)
    const weaknesses = dimensionScores.filter(d => d.avg < 2).map(d => d.name)
    let techDesc = `技术能力：${levelLabel}`
    if (strengths.length > 0) techDesc += `，${strengths.join('、')}表现较好`
    if (weaknesses.length > 0) techDesc += `，${weaknesses.join('、')}有待加强`
    if (strengths.length === 0 && weaknesses.length === 0 && dimensionScores.length > 0) techDesc += `，各维度表现均衡`
    const reasonParts: string[] = [techDesc]
    ratingDescriptions.forEach(d => reasonParts.push(d))
    const overallDesc = overallAvg >= 4 ? '整体表现优秀，具备较强综合能力' : overallAvg >= 2.5 ? '整体表现中等，部分领域仍需提升' : '整体表现偏弱，需重点加强基础能力'
    reasonParts.push(`综合评价：${overallDesc}`)
    hiringReason = reasonParts.join('\n')
  }

  const assessment: AssessmentData = {
    interview_id: interviewId,
    candidate_name: interview.candidate_name,
    job_role: interview.job_role,
    target_level: interview.target_level,
    recommended_level: recommendedLevel,
    level_gap: levelGap,
    comprehensive_score: Math.round(comprehensiveScore * 10) / 10,
    strengths: [],
    weaknesses: [],
    hiring_recommendation: hiringRecommendation,
    hiring_reason: hiringReason,
    training_suggestions: [],
    assessed_at: new Date().toISOString(),
    assessment_method: 'auto',
    communication_score: interviewerRatings.communication,
    project_score: interviewerRatings.project,
    potential_score: interviewerRatings.potential,
    values_score: interviewerRatings.values,
    candidate_bonus_score: candidateBonus,
  }

  const body = buildAssessmentBody(assessment)
  const content = stringifyMarkdown(assessment, body)
  await writeFile(`${interviewDir}/assessment.md`, content)
  return assessment
}

export async function getAssessment(interviewId: string): Promise<AssessmentData> {
  const interviewDir = await findInterviewDir(interviewId)
  if (!interviewDir) throw new Error(`Interview not found: ${interviewId}`)
  const assessmentPath = `${interviewDir}/assessment.md`
  const content = await readFile(assessmentPath)
  const { metadata } = parseMarkdown<AssessmentData>(content)
  return metadata
}

export async function updateAssessment(
  interviewId: string,
  updates: Partial<AssessmentData>
): Promise<void> {
  const interviewDir = await findInterviewDir(interviewId)
  if (!interviewDir) throw new Error(`Interview not found: ${interviewId}`)
  const assessmentPath = `${interviewDir}/assessment.md`
  const content = await readFile(assessmentPath)
  const { metadata, body } = parseMarkdown<AssessmentData>(content)
  const updatedMetadata: AssessmentData = { ...metadata, ...updates, assessment_method: 'manual' }
  const newContent = stringifyMarkdown(updatedMetadata, body)
  await writeFile(assessmentPath, newContent)
}

async function calculateAssessment(
  interviewId: string,
  interview: any,
  dimensions: any[],
  totalScore: number,
  recommendedLevel: string,
  levelGap: number,
  hiringRecommendation: '通过' | '待定' | '不通过'
): Promise<AssessmentData> {
  const strongDimensions = dimensions.filter(d => d.average_score >= 7).map(d => d.name)
  const weakDimensions = dimensions.filter(d => d.average_score < 5).map(d => d.name)
  const overallLabel = totalScore >= 7 ? '强' : totalScore >= 4 ? '中等' : '偏弱'
  let techDesc = `技术能力：${overallLabel}`
  if (strongDimensions.length > 0) techDesc += `，${strongDimensions.join('、')}表现优秀`
  if (weakDimensions.length > 0) techDesc += `，${weakDimensions.join('、')}需要加强`
  if (strongDimensions.length === 0 && weakDimensions.length === 0 && dimensions.length > 0) techDesc += `，各维度表现均衡`

  const strengths = strongDimensions.length > 0 ? strongDimensions.map(d => `${d}表现优秀`) : ['整体表现稳定']
  const weaknesses = weakDimensions.length > 0 ? weakDimensions.map(d => `${d}需要加强`) : ['无明显短板']

  const reasonLines: string[] = [techDesc]
  dimensions.forEach(d => {
    if (d.average_score >= 7) reasonLines.push(`${d.name}：表现优秀`)
    else if (d.average_score >= 5) reasonLines.push(`${d.name}：表现尚可`)
    else if (d.average_score < 5) reasonLines.push(`${d.name}：有待提升`)
  })
  const overallDesc = totalScore >= 7 ? '整体表现优秀，具备较强综合能力' : totalScore >= 4 ? '整体表现中等，部分领域仍需提升' : '整体表现偏弱，需重点加强基础能力'
  reasonLines.push(`综合评价：${overallDesc}`)

  return {
    interview_id: interviewId,
    candidate_name: interview.candidate_name,
    job_role: interview.job_role,
    target_level: interview.target_level,
    recommended_level: recommendedLevel,
    level_gap: levelGap,
    comprehensive_score: totalScore,
    strengths,
    weaknesses,
    hiring_recommendation: hiringRecommendation,
    hiring_reason: reasonLines.join('\n'),
    training_suggestions: weakDimensions.length > 0 ? weakDimensions.map(d => `加强${d}方面的学习和实践`) : ['持续巩固现有优势'],
    assessed_at: new Date().toISOString(),
    assessment_method: 'auto',
  }
}

function buildAssessmentBody(assessment: AssessmentData, dimensions?: any[]): string {
  let body = `# 面试综合评价 - ${assessment.candidate_name}\n\n`
  body += `## 评价信息\n`
  body += `| 项目 | 内容 |\n`
  body += `|------|------|\n`
  body += `| 候选人 | ${assessment.candidate_name} |\n`
  body += `| 面试岗位 | ${assessment.job_role} |\n`
  body += `| 目标职级 | ${assessment.target_level} |\n`
  body += `| 推荐职级 | ${assessment.recommended_level} |\n`
  body += `| 职级差距 | ${assessment.level_gap >= 0 ? '+' : ''}${assessment.level_gap} |\n`
  body += `| 综合得分 | ${assessment.comprehensive_score}/10 |\n`
  body += `| 录用建议 | ${assessment.hiring_recommendation} |\n`
  if (assessment.communication_score) body += `| 沟通能力 | ${assessment.communication_score} |\n`
  if (assessment.project_score) body += `| 项目能力 | ${assessment.project_score} |\n`
  if (assessment.potential_score) body += `| 潜力 | ${assessment.potential_score} |\n`
  if (assessment.values_score) body += `| 价值观 | ${assessment.values_score} |\n`
  if (assessment.candidate_bonus_score) body += `| 手动加分 | ${assessment.candidate_bonus_score} |\n`

  if (dimensions && dimensions.length > 0) {
    body += `\n## 维度得分分析\n`
    body += `| 维度 | 权重 | 得分 | 加权得分 |\n`
    body += `|------|------|------|----------|\n`
    for (const dim of dimensions) {
      body += `| ${dim.name} | ${(dim.weight * 100).toFixed(0)}% | ${dim.average_score} | ${dim.weighted_score} |\n`
    }
  }

  if (assessment.hiring_reason) {
    body += `\n## 录用理由\n${assessment.hiring_reason}\n`
  }

  return body
}