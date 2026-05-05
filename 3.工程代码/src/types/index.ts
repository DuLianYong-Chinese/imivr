export interface Dimension {
  name: string
  weight: number
  description?: string
}

export interface WorkspaceInfo {
  job_role: string
  workspace_name: string
  category: '技术研发' | '产品设计'
  target_levels: string[]
  created_at: string
  updated_at?: string
  question_count?: number
  interview_count?: number
}

export interface WorkspaceDetail extends WorkspaceInfo {
  evaluation_dimensions: Dimension[]
  content?: string
  question_stats?: QuestionStats
}

export interface WorkspaceMetadata extends WorkspaceInfo {
  evaluation_dimensions: Dimension[]
}

export interface CreateWorkspaceInput {
  job_role: string
  workspace_name: string
  category: '技术研发' | '产品设计'
  target_levels: string[]
  evaluation_dimensions: Dimension[]
}

export interface QuestionStats {
  total: number
  by_difficulty: Record<string, number>
  by_category: Record<string, number>
  by_dimension: Record<string, number>
  jd_count: number
}

export interface Question {
  question_id: string
  difficulty: 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
  category: string
  evaluation_dimension: string
  job_role: string
  applicable_levels: string[]
  tags: string[]
  title: string
  description: string
  expected_answer: string[]
  score_criteria: Record<string, string>
  follow_up_questions: string[]
  created_at: string
  updated_at?: string
}

export interface QuestionListItem {
  question_id: string
  title: string
  difficulty: string
  category: string
  evaluation_dimension: string
  tags: string[]
}

export interface CreateQuestionInput {
  jobRole: string
  difficulty: 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
  category: string
  evaluation_dimension: string
  applicable_levels: string[]
  tags: string[]
  title: string
  description: string
  expected_answer: string[]
  score_criteria: Record<string, string>
  follow_up_questions: string[]
}

export interface ResumeData {
  candidate_name: string
  contact?: string
  email?: string
  work_years?: number
  education?: EducationItem[]
  work_experience?: WorkExperienceItem[]
  skills?: string[]
  projects?: ProjectItem[]
  parsed_at?: string
  parse_status?: 'success' | 'failed' | 'pending'
  content?: string
}

export interface EducationItem {
  school: string
  major: string
  degree: string
  start_date: string
  end_date: string
}

export interface WorkExperienceItem {
  company: string
  position: string
  start_date: string
  end_date: string
  responsibilities?: string[]
}

export interface ProjectItem {
  name: string
  tech_stack?: string[]
  contribution?: string
}

export interface JDConfig {
  jd_id: string
  job_role: string
  position_name: string
  target_level: string
  level_range: string[]
  required_skills: string[]
  preferred_skills?: string[]
  min_experience?: number
  education_requirement?: string
  evaluation_dimensions: Dimension[]
  description?: string
  other_requirements?: string
  created_at: string
  updated_at?: string
}

export interface JDConfig {
  jd_id: string
  job_role: string
  position_name: string
  target_level: string
  level_range: string[]
  required_skills: string[]
  evaluation_dimensions: Dimension[]
  preferred_skills?: string[]
  min_experience?: number
  education_requirement?: string
  description?: string
  other_requirements?: string
  created_at: string
  updated_at?: string
}

export interface CreateJDInput {
  job_role: string
  position_name: string
  target_level: string
  level_range: string[]
  required_skills: string[]
  evaluation_dimensions: Dimension[]
}

export interface ValidationResult {
  valid: boolean
  issues: string[]
}

export interface CreateJDInput {
  job_role: string
  position_name: string
  target_level: string
  level_range: string[]
  required_skills: string[]
  preferred_skills?: string[]
  min_experience?: number
  education_requirement?: string
  evaluation_dimensions: Dimension[]
  description?: string
  other_requirements?: string
}

export interface Interview {
  interview_id: string
  candidate_name: string
  interviewer: string
  interview_date: string
  job_role: string
  target_level: string
  jd_id?: string
  difficulty_levels?: string[]
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  started_at?: string
  completed_at?: string
  duration_minutes?: number
  elapsed_seconds?: number
  created_at: string
  updated_at?: string
}

export interface InterviewDetail extends Interview {
  resume?: ResumeData
  questions?: QuestionListData
  answers?: AnswersData
  assessment?: AssessmentData
  content?: string
}

export interface CreateInterviewInput {
  jobRole: string
  candidateName: string
  interviewer: string
  interviewDate: string
  targetLevel: string
  jdId?: string
  difficultyLevels?: string[]
}

export interface UpdateInterviewInput {
  interviewId: string
  interviewer?: string
  interviewDate?: string
  targetLevel?: string
  jdId?: string
  difficultyLevels?: string[]
  elapsed_seconds?: number
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
}

export interface QuestionListData {
  interview_id: string
  candidate_name: string
  job_role: string
  target_level: string
  total_questions: number
  difficulty_distribution: Record<string, number>
  from_bank: number
  ai_generated: number
  generated_at: string
  questions: QuestionItem[]
}

export interface QuestionItem {
  id: string
  question_id: string
  title: string
  question: string
  answer?: string
  difficulty: string
  evaluation_dimension: string
  category?: string
  source: 'bank' | 'ai'
}

export interface AnswersData {
  interview_id: string
  candidate_name: string
  status: string
  answers: AnswerItem[]
}

export interface AnswerItem {
  question_id: string
  title: string
  difficulty: string
  evaluation_dimension: string
  answer_content: string
  answer_status: 'pending' | 'answered' | 'skipped' | 'partial'
  score?: number
  ai_score?: number
  score_remark?: string
  passed?: boolean
  scored_at?: string
}

export interface SubmitScoreInput {
  interviewId: string
  questionId: string
  score: number
  scoreRemark?: string
  passed: boolean
}

export interface DimensionScore {
  name: string
  weight: number
  question_count: number
  scored_count: number
  average_score: number
  weighted_score: number
}

export interface AssessmentData {
  interview_id: string
  candidate_name: string
  job_role: string
  target_level: string
  recommended_level: string
  level_gap: number
  comprehensive_score: number
  strengths: string[]
  weaknesses: string[]
  hiring_recommendation: '通过' | '待定' | '不通过'
  hiring_reason: string
  training_suggestions?: string[]
  assessed_at: string
  assessment_method: 'auto' | 'manual'
  communication_score?: number
  project_score?: number
  potential_score?: number
  values_score?: number
  candidate_bonus_score?: number
}

export interface ReportData {
  interview_id: string
  candidate_name: string
  job_role: string
  target_level: string
  recommended_level: string
  comprehensive_score: number
  hiring_recommendation: string
  generated_at: string
  content: string
}

export interface PluginMetadata {
  plugin_id: string
  name: string
  category: '技术研发' | '产品设计'
  version: string
  description: string
  evaluation_dimensions: Dimension[]
  difficulty_mapping: Record<string, string[]>
}

export interface Plugin {
  metadata: PluginMetadata
  prompts: Record<string, string>
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ValidationResult {
  valid: boolean
  issues: string[]
}

// 主题相关类型
export type ThemeColor = 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'custom'
export type ThemeMode = 'light' | 'dark'

export interface ThemeConfig {
  color: ThemeColor
  mode: ThemeMode
  customPrimaryColor?: string
  // 存储 HSB 颜色信息用于 ColorPicker 反显（支持 hex/rgb/hsb 模式切换）
  customColorMeta?: {
    h: number
    s: number
    b: number
    a: number
  }
}

export interface ThemeColors {
  primary: string
  primaryHover: string
  primaryActive: string
  primaryBg: string
  success: string
  warning: string
  error: string
  info: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  border: string
  background: string
  surface: string
  surfaceHover: string
}

// 预设主题颜色配置
export const THEME_COLOR_MAP: Record<ThemeColor, { light: ThemeColors; dark: ThemeColors }> = {
  red: {
    light: {
      primary: '#cf1322',
      primaryHover: '#f5222d',
      primaryActive: '#a8071a',
      primaryBg: '#fff1f0',
      success: '#52c41a',
      warning: '#faad14',
      error: '#ff4d4f',
      info: '#cf1322',
      textPrimary: '#1f1f1f',
      textSecondary: '#595959',
      textTertiary: '#8c8c8c',
      border: '#d9d9d9',
      background: '#f5f5f5',
      surface: '#ffffff',
      surfaceHover: '#fafafa',
    },
    dark: {
      primary: '#a61d24',
      primaryHover: '#cf1322',
      primaryActive: '#800f19',
      primaryBg: '#2a1215',
      success: '#73d13d',
      warning: '#ffc53d',
      error: '#ff7875',
      info: '#a61d24',
      textPrimary: '#ffffff',
      textSecondary: '#a6a6a6',
      textTertiary: '#666666',
      border: '#424242',
      background: '#141414',
      surface: '#1f1f1f',
      surfaceHover: '#2a2a2a',
    },
  },
  orange: {
    light: {
      primary: '#fa8c16',
      primaryHover: '#ffa940',
      primaryActive: '#d46b08',
      primaryBg: '#fff7e6',
      success: '#52c41a',
      warning: '#faad14',
      error: '#ff4d4f',
      info: '#fa8c16',
      textPrimary: '#1f1f1f',
      textSecondary: '#595959',
      textTertiary: '#8c8c8c',
      border: '#d9d9d9',
      background: '#f5f5f5',
      surface: '#ffffff',
      surfaceHover: '#fafafa',
    },
    dark: {
      primary: '#d46b08',
      primaryHover: '#fa8c16',
      primaryActive: '#ad4e00',
      primaryBg: '#2b2111',
      success: '#73d13d',
      warning: '#ffc53d',
      error: '#ff7875',
      info: '#d46b08',
      textPrimary: '#ffffff',
      textSecondary: '#a6a6a6',
      textTertiary: '#666666',
      border: '#424242',
      background: '#141414',
      surface: '#1f1f1f',
      surfaceHover: '#2a2a2a',
    },
  },
  yellow: {
    light: {
      primary: '#fadb14',
      primaryHover: '#ffec3d',
      primaryActive: '#d4b106',
      primaryBg: '#feffe6',
      success: '#52c41a',
      warning: '#faad14',
      error: '#ff4d4f',
      info: '#fadb14',
      textPrimary: '#1f1f1f',
      textSecondary: '#595959',
      textTertiary: '#8c8c8c',
      border: '#d9d9d9',
      background: '#f5f5f5',
      surface: '#ffffff',
      surfaceHover: '#fafafa',
    },
    dark: {
      primary: '#d4b106',
      primaryHover: '#fadb14',
      primaryActive: '#ad8b00',
      primaryBg: '#2b2611',
      success: '#73d13d',
      warning: '#ffc53d',
      error: '#ff7875',
      info: '#d4b106',
      textPrimary: '#ffffff',
      textSecondary: '#a6a6a6',
      textTertiary: '#666666',
      border: '#424242',
      background: '#141414',
      surface: '#1f1f1f',
      surfaceHover: '#2a2a2a',
    },
  },
  green: {
    light: {
      primary: '#52c41a',
      primaryHover: '#73d13d',
      primaryActive: '#389e0d',
      primaryBg: '#f6ffed',
      success: '#52c41a',
      warning: '#faad14',
      error: '#ff4d4f',
      info: '#52c41a',
      textPrimary: '#1f1f1f',
      textSecondary: '#595959',
      textTertiary: '#8c8c8c',
      border: '#d9d9d9',
      background: '#f5f5f5',
      surface: '#ffffff',
      surfaceHover: '#fafafa',
    },
    dark: {
      primary: '#389e0d',
      primaryHover: '#52c41a',
      primaryActive: '#237804',
      primaryBg: '#162312',
      success: '#73d13d',
      warning: '#ffc53d',
      error: '#ff7875',
      info: '#389e0d',
      textPrimary: '#ffffff',
      textSecondary: '#a6a6a6',
      textTertiary: '#666666',
      border: '#424242',
      background: '#141414',
      surface: '#1f1f1f',
      surfaceHover: '#2a2a2a',
    },
  },
  cyan: {
    light: {
      primary: '#13c2c2',
      primaryHover: '#36cfc9',
      primaryActive: '#08979c',
      primaryBg: '#e6fffb',
      success: '#52c41a',
      warning: '#faad14',
      error: '#ff4d4f',
      info: '#13c2c2',
      textPrimary: '#1f1f1f',
      textSecondary: '#595959',
      textTertiary: '#8c8c8c',
      border: '#d9d9d9',
      background: '#f5f5f5',
      surface: '#ffffff',
      surfaceHover: '#fafafa',
    },
    dark: {
      primary: '#08979c',
      primaryHover: '#13c2c2',
      primaryActive: '#006d75',
      primaryBg: '#112123',
      success: '#73d13d',
      warning: '#ffc53d',
      error: '#ff7875',
      info: '#08979c',
      textPrimary: '#ffffff',
      textSecondary: '#a6a6a6',
      textTertiary: '#666666',
      border: '#424242',
      background: '#141414',
      surface: '#1f1f1f',
      surfaceHover: '#2a2a2a',
    },
  },
  blue: {
    light: {
      primary: '#1677ff',
      primaryHover: '#4096ff',
      primaryActive: '#0958d9',
      primaryBg: '#e6f4ff',
      success: '#52c41a',
      warning: '#faad14',
      error: '#ff4d4f',
      info: '#1677ff',
      textPrimary: '#1f1f1f',
      textSecondary: '#595959',
      textTertiary: '#8c8c8c',
      border: '#d9d9d9',
      background: '#f5f5f5',
      surface: '#ffffff',
      surfaceHover: '#fafafa',
    },
    dark: {
      primary: '#177ddc',
      primaryHover: '#3c9ae8',
      primaryActive: '#0e6ebd',
      primaryBg: '#111b26',
      success: '#73d13d',
      warning: '#ffc53d',
      error: '#ff7875',
      info: '#177ddc',
      textPrimary: '#ffffff',
      textSecondary: '#a6a6a6',
      textTertiary: '#666666',
      border: '#424242',
      background: '#141414',
      surface: '#1f1f1f',
      surfaceHover: '#2a2a2a',
    },
  },
  purple: {
    light: {
      primary: '#722ed1',
      primaryHover: '#9254de',
      primaryActive: '#531dab',
      primaryBg: '#f9f0ff',
      success: '#52c41a',
      warning: '#faad14',
      error: '#ff4d4f',
      info: '#722ed1',
      textPrimary: '#1f1f1f',
      textSecondary: '#595959',
      textTertiary: '#8c8c8c',
      border: '#d9d9d9',
      background: '#f5f5f5',
      surface: '#ffffff',
      surfaceHover: '#fafafa',
    },
    dark: {
      primary: '#531dab',
      primaryHover: '#722ed1',
      primaryActive: '#391085',
      primaryBg: '#1a1325',
      success: '#73d13d',
      warning: '#ffc53d',
      error: '#ff7875',
      info: '#531dab',
      textPrimary: '#ffffff',
      textSecondary: '#a6a6a6',
      textTertiary: '#666666',
      border: '#424242',
      background: '#141414',
      surface: '#1f1f1f',
      surfaceHover: '#2a2a2a',
    },
  },
  // custom 使用蓝色作为默认回退，实际颜色由用户自定义
  custom: {
    light: {
      primary: '#1677ff',
      primaryHover: '#4096ff',
      primaryActive: '#0958d9',
      primaryBg: '#e6f4ff',
      success: '#52c41a',
      warning: '#faad14',
      error: '#ff4d4f',
      info: '#1677ff',
      textPrimary: '#1f1f1f',
      textSecondary: '#595959',
      textTertiary: '#8c8c8c',
      border: '#d9d9d9',
      background: '#f5f5f5',
      surface: '#ffffff',
      surfaceHover: '#fafafa',
    },
    dark: {
      primary: '#177ddc',
      primaryHover: '#3c9ae8',
      primaryActive: '#0e6ebd',
      primaryBg: '#111b26',
      success: '#73d13d',
      warning: '#ffc53d',
      error: '#ff7875',
      info: '#177ddc',
      textPrimary: '#ffffff',
      textSecondary: '#a6a6a6',
      textTertiary: '#666666',
      border: '#424242',
      background: '#141414',
      surface: '#1f1f1f',
      surfaceHover: '#2a2a2a',
    },
  },
}
