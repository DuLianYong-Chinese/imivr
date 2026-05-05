import type { PluginMetadata, Dimension } from '@/types'

export interface PluginPrompts {
  resumeAnalysis: string
  questionGeneration: string
  assessment: string
}

export interface Plugin {
  metadata: PluginMetadata
  prompts: PluginPrompts
  hcTemplate?: string
  reportTemplate?: string
}

const defaultPrompts: Record<string, PluginPrompts> = {
  default: {
    resumeAnalysis: `请分析以下简历内容，提取以下信息：
1. 基本信息（姓名、联系方式、邮箱）
2. 教育背景（学校、专业、学历、时间）
3. 工作经历（公司、职位、时间、主要职责）
4. 技术技能（编程语言、框架、工具）
5. 项目经验（项目名称、技术栈、个人贡献）

简历内容：
{resumeText}

请以 JSON 格式返回结构化数据。`,

    questionGeneration: `基于以下候选人简历和岗位需求，生成一份面试问题清单：

【工种类型】
{job_role}

【候选人信息】
{candidate_info}

【岗位需求】
{hc_requirement}

【考察维度及权重】
{evaluation_dimensions}

要求：
1. 生成{question_count}道面试问题
2. 按难度分为5个等级（L1基础-L5专家）
3. 每个等级至少2道题
4. 问题需覆盖该工种的核心考察维度
5. 每道题附带期望答案要点和评分参考

请以 JSON 格式返回，格式为：
{
  "questions": [
    {
      "title": "问题标题",
      "difficulty": "L1",
      "evaluation_dimension": "考察维度",
      "description": "问题描述",
      "expected_answer": ["答案要点1", "答案要点2"],
      "score_criteria": {"0-2": "标准", "3-4": "标准", ...}
    }
  ]
}`,

    assessment: `基于以下面试评分数据，请评定候选人的职级：

【候选人信息】
{candidate_info}

【面试评分】
{scores}

【维度得分】
{dimension_scores}

【职级评定标准】
P3: 0-4.5 基础能力，需要培养
P4: 4.5-5.5 具备基础工作能力
P5: 5.5-7.0 独立工作能力
P6: 7.0-8.5 技术骨干，能解决复杂问题
P7: 8.5-10 领域专家，能引领技术方向

请提供：
1. 推荐职级
2. 综合得分
3. 优势分析（至少3点）
4. 不足分析（至少3点）
5. 录用建议
6. 培养建议

请以 JSON 格式返回。`,
  },
}

export function getDefaultPrompts(): PluginPrompts {
  return defaultPrompts.default
}

export function getPromptsForJobRole(jobRole: string): PluginPrompts {
  return defaultPrompts[jobRole] || defaultPrompts.default
}
