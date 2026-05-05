import type { ReportData } from '@/types'
import { readFile, writeFile, exists } from '@/core/filesystem'
import { parseMarkdown, stringifyMarkdown } from '@/core/markdown'
import { findInterviewDir, getInterviewDetail } from '../interview'
import { getAssessment } from '../assessment'

export class ReportNotFoundError extends Error {
  constructor(public interviewId: string) {
    super(`Report not found: ${interviewId}`)
    this.name = 'ReportNotFoundError'
  }
}

export class ReportGenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReportGenerationError'
  }
}

export async function generateReport(
  interviewId: string,
  options?: { template?: 'default' | 'detailed' | 'summary' }
): Promise<ReportData> {
  const interviewDir = await findInterviewDir(interviewId)
  
  if (!interviewDir) {
    throw new ReportGenerationError(`Interview not found: ${interviewId}`)
  }
  
  const detail = await getInterviewDetail(interviewId)
  
  if (detail.status !== 'completed') {
    throw new ReportGenerationError('Interview not completed')
  }
  
  if (!detail.assessment) {
    throw new ReportGenerationError('Assessment not completed')
  }
  
  const assessment = await getAssessment(interviewId)
  
  const report: ReportData = {
    interview_id: interviewId,
    candidate_name: detail.candidate_name,
    job_role: detail.job_role,
    target_level: detail.target_level,
    recommended_level: assessment.recommended_level,
    comprehensive_score: assessment.comprehensive_score,
    hiring_recommendation: assessment.hiring_recommendation,
    generated_at: new Date().toISOString(),
    content: '',
  }
  
  const body = buildReportBody(detail, assessment, options?.template || 'default')
  report.content = body
  
  const content = stringifyMarkdown(report, body)
  await writeFile(`${interviewDir}/report.md`, content)
  
  return report
}

export async function getReport(interviewId: string): Promise<ReportData> {
  const interviewDir = await findInterviewDir(interviewId)
  
  if (!interviewDir) {
    throw new Error(`Interview not found: ${interviewId}`)
  }
  
  const reportPath = `${interviewDir}/report.md`
  
  if (!(await exists(reportPath))) {
    throw new ReportNotFoundError(interviewId)
  }
  
  const content = await readFile(reportPath)
  const { metadata, body } = parseMarkdown<ReportData>(content)
  
  return {
    ...metadata,
    content: body,
  }
}

export async function regenerateReport(interviewId: string): Promise<ReportData> {
  const interviewDir = await findInterviewDir(interviewId)
  
  if (!interviewDir) {
    throw new Error(`Interview not found: ${interviewId}`)
  }
  
  const reportPath = `${interviewDir}/report.md`
  
  if (await exists(reportPath)) {
    const content = await readFile(reportPath)
    await writeFile(`${reportPath}.bak`, content)
  }
  
  return generateReport(interviewId)
}

function buildReportBody(
  detail: any,
  assessment: any,
  template: string
): string {
  let body = `# 面试报告 - ${detail.candidate_name}\n\n`
  
  body += `## 一、基本信息\n`
  body += `| 项目 | 内容 |\n`
  body += `|------|------|\n`
  body += `| 候选人姓名 | ${detail.candidate_name} |\n`
  body += `| 面试工种 | ${detail.job_role} |\n`
  body += `| 面试官 | ${detail.interviewer} |\n`
  body += `| 面试日期 | ${detail.interview_date} |\n`
  body += `| 面试时长 | ${detail.duration_minutes || '-'}分钟 |\n`
  body += `| 目标职级 | ${detail.target_level} |\n\n`
  
  if (detail.resume) {
    body += `## 二、简历摘要\n`
    
    if (detail.resume.education && detail.resume.education.length > 0) {
      body += `### 教育背景\n`
      body += `| 时间 | 学校 | 专业 | 学历 |\n`
      body += `|------|------|------|------|\n`
      for (const edu of detail.resume.education) {
        body += `| ${edu.start_date} ~ ${edu.end_date} | ${edu.school} | ${edu.major} | ${edu.degree} |\n`
      }
      body += '\n'
    }
    
    if (detail.resume.work_experience && detail.resume.work_experience.length > 0) {
      body += `### 工作经历\n`
      for (const work of detail.resume.work_experience) {
        body += `**${work.company}** - ${work.position}（${work.start_date} ~ ${work.end_date}）\n`
      }
      body += '\n'
    }
    
    if (detail.resume.skills && detail.resume.skills.length > 0) {
      body += `### 技能栈\n`
      body += detail.resume.skills.join('、') + '\n\n'
    }
  }
  
  if (detail.questions && detail.questions.questions) {
    body += `## 三、面试问题清单\n`
    body += `共 ${detail.questions.total_questions} 道题目\n\n`
    
    const byDifficulty: Record<string, any[]> = {}
    for (const q of detail.questions.questions) {
      if (!byDifficulty[q.difficulty]) {
        byDifficulty[q.difficulty] = []
      }
      byDifficulty[q.difficulty].push(q)
    }
    
    for (const [diff, questions] of Object.entries(byDifficulty)) {
      body += `### ${diff}\n`
      for (const q of questions) {
        body += `- ${q.title}\n`
      }
      body += '\n'
    }
  }
  
  if (detail.answers && detail.answers.answers) {
    body += `## 四、答题详情\n`
    
    for (const answer of detail.answers.answers) {
      body += `### ${answer.question_id}: ${answer.title}\n`
      body += `- 难度: ${answer.difficulty}\n`
      body += `- 考察维度: ${answer.evaluation_dimension}\n`
      body += `- 回答状态: ${answer.answer_status}\n`
      if (answer.score !== undefined) {
        body += `- 评分: ${answer.score}/10\n`
        body += `- 是否通过: ${answer.passed ? '是' : '否'}\n`
      }
      body += '\n'
    }
  }
  
  body += `## 五、评分分析\n`
  body += `| 项目 | 内容 |\n`
  body += `|------|------|\n`
  body += `| 综合得分 | ${assessment.comprehensive_score}/10 |\n`
  body += `| 推荐职级 | ${assessment.recommended_level} |\n`
  body += `| 目标职级 | ${detail.target_level} |\n`
  body += `| 职级差距 | ${assessment.level_gap >= 0 ? '+' : ''}${assessment.level_gap} |\n\n`
  
  body += `## 六、等级评定\n`
  body += `### 优势分析\n`
  for (const s of assessment.strengths || []) {
    body += `- ${s}\n`
  }
  body += '\n'
  
  body += `### 不足分析\n`
  for (const w of assessment.weaknesses || []) {
    body += `- ${w}\n`
  }
  body += '\n'
  
  body += `## 七、录用建议\n`
  body += `**${assessment.hiring_recommendation}**\n\n`
  body += `${assessment.hiring_reason || ''}\n`
  
  if (assessment.training_suggestions && assessment.training_suggestions.length > 0) {
    body += `\n### 培养建议\n`
    for (const s of assessment.training_suggestions) {
      body += `- ${s}\n`
    }
  }
  
  body += `\n---\n\n`
  body += `*报告生成时间：${new Date().toLocaleString('zh-CN')}*\n`
  
  return body
}
