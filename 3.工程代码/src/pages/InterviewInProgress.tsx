import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, App, Rate, Input, Tooltip, Spin, Tag, Select } from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  AudioOutlined,
  AudioMutedOutlined,
  SaveOutlined,
  ClockCircleOutlined,
  UserOutlined,
  FileTextOutlined,
  SoundOutlined,
  RobotOutlined,
  MinusOutlined,
  ExpandOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import type { InterviewDetail, QuestionItem } from '@/types'
import { getInterviewDetail, endInterview, saveAnswer, updateInterview, generateQuestions, getCandidateTags } from '@/modules/interview'
import type { CandidateTag } from '@/modules/interview'
import { AudioRecorder, transcribeAudio } from '@/core/ai/speech'
import { getConfig } from '@/core/filesystem'
import { useThemeStore } from '@/stores/themeStore'
import DifficultyDistribution from '@/components/DifficultyDistribution'
import TagSelector from '@/components/TagSelector'

interface AnswerRecord {
  questionId: string
  question: string
  answer: string
  candidateResponse: string
  score: number
  timestamp: string
}

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  'L1': { label: '初级', color: '#52c41a', bgColor: '#f6ffed' },
  'L2': { label: '中级', color: '#1677ff', bgColor: '#e6f4ff' },
  'L3': { label: '高级', color: '#722ed1', bgColor: '#f9f0ff' },
  'L4': { label: '专家', color: '#fa8c16', bgColor: '#fff7e6' },
  'L5': { label: '资深', color: '#cf1322', bgColor: '#fff1f0' },
}

const JOB_ROLE_MAP: Record<string, string> = {
  'frontend_dev': '前端工程师',
  'backend_dev': '后端工程师',
  'algorithm_engineer': '算法工程师',
  'test_engineer': '测试工程师',
  'data_dev': '数据开发工程师',
  'product_manager': '产品经理',
  'ui_designer': 'UI 设计师',
}

function getJobRoleName(jobRole: string): string {
  return JOB_ROLE_MAP[jobRole] || jobRole
}

export default function InterviewInProgress() {
  const { message } = App.useApp()
  const { colors, config } = useThemeStore()
  const isDark = config.mode === 'dark'
  const { jobRole, interviewId } = useParams<{ jobRole: string; interviewId: string }>()
  const navigate = useNavigate()
  const [interview, setInterview] = useState<InterviewDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [elapsedTime, setElapsedTime] = useState(0)
  const elapsedTimeRef = useRef(0)
  const [resumeWidth, setResumeWidth] = useState(450)
  const [isDragging, setIsDragging] = useState(false)
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({})
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | number | undefined>(undefined)
  const [recordingQuestionId, setRecordingQuestionId] = useState<string | null>(null)
  const [transcripts, setTranscripts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [generateModalVisible, setGenerateModalVisible] = useState(false)
  const [modalMinimized, setModalMinimized] = useState(false)
  const [streamMinimized, setStreamMinimized] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [submittingQuestions, setSubmittingQuestions] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [selectedDifficultyLevels, setSelectedDifficultyLevels] = useState<string[]>([])
  const [difficultyDistributions, setDifficultyDistributions] = useState<Record<string, number>>({})
  const [selectedTags, setSelectedTags] = useState<Record<string, number>>({})
  const [candidateTagsData, setCandidateTagsData] = useState<CandidateTag[]>([])
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null)
  const streamRef = useRef<HTMLDivElement>(null)

  const audioRecorderRef = useRef<AudioRecorder | null>(null)
  const transcriptRef = useRef<string>('')
  const autoSaveTimerRef = useRef<Record<string, number>>({})

  const questions = useMemo(() => {
    const raw = interview?.questions?.questions || []
    const diffOrder: Record<string, number> = { 'L1-初级': 1, 'L2-中级': 2, 'L3-高级': 3, 'L4-专家': 4, 'L5-大神': 5 }
    return [...raw].sort((a, b) => {
      const aCat = a.category || ''
      const bCat = b.category || ''
      if (aCat !== bCat) return aCat.localeCompare(bCat)
      const aDiff = diffOrder[a.difficulty] || 99
      const bDiff = diffOrder[b.difficulty] || 99
      return aDiff - bDiff
    })
  }, [interview])

  const getCategoryColor = (category: string): string => {
    const colorMap: Record<string, string> = {
      '技术类': '#1677ff',
      '项目类': '#52c41a',
      '软技能类': '#fa8c16',
      '职业规划类': '#722ed1',
      '岗位挑战类': '#ff4d4f',
      '领导力类': '#13c2c2',
      '行业洞察类': '#eb2f96',
    }
    return colorMap[category] || colors.primary
  }

  const getCategoryIcon = (category: string, isActive: boolean = false) => {
    const iconMap: Record<string, string> = {
      '技术类': '⚡',
      '项目类': '🏗',
      '软技能类': '🤝',
      '职业规划类': '🎯',
      '岗位挑战类': '🔥',
      '领导力类': '👑',
      '行业洞察类': '💡',
    }
    const catColor = getCategoryColor(category)
    if (iconMap[category]) {
      return <span style={{ fontSize: 14 }}>{iconMap[category]}</span>
    }
    return (
      <span style={{
        fontSize: 12,
        fontWeight: 700,
        color: catColor,
        lineHeight: 1,
      }}>{category.charAt(0)}</span>
    )
  }

  const filteredQuestions = useMemo(() => {
    if (!selectedCategoryFilter) return questions
    return questions.filter(q => (q.category || '未分类') === selectedCategoryFilter)
  }, [questions, selectedCategoryFilter])

  const handleSaveElapsedTime = async () => {
    if (interviewId && elapsedTimeRef.current > 0) {
      try {
        await updateInterview({ interviewId, elapsed_seconds: elapsedTimeRef.current })
      } catch (error) {
        console.error('保存面试计时失败:', error)
      }
    }
  }

  useEffect(() => {
    loadInterview()
  }, [interviewId])

  useEffect(() => {
    if (!generating) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '问题正在生成中，离开页面将中断生成，确定要离开吗？'
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [generating])

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime((prev) => {
        const next = prev + 1
        elapsedTimeRef.current = next
        return next
      })
    }, 1000)

    const saveTimer = setInterval(() => {
      handleSaveElapsedTime()
    }, 30000)

    return () => {
      clearInterval(timer)
      clearInterval(saveTimer)
      handleSaveElapsedTime()
    }
  }, [interviewId])

  useEffect(() => {
    const handleBeforeUnload = () => {
      handleSaveElapsedTime()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [interviewId])

  const getVoiceModelConfig = async () => {
    const config = await getConfig()
    const voiceModels = config?.aiVoiceModels || []
    const defaultModel = ((voiceModels as any[]) as any[]).find((m: any) => m.isDefault) || voiceModels[0]
    if (!defaultModel) {
      message.error('请先在设置中配置AI语音模型')
      return null
    }
    return {
      apiKey: defaultModel.apiKey,
      baseURL: defaultModel.baseURL || 'https://www.finna.com.cn/v1',
      model: defaultModel.model,
    }
  }

  const handleStartRecording = async () => {
    if (!expandedQuestionId) {
      message.warning('请先展开一道题目再开始录音')
      return
    }
    try {
      const recorder = new AudioRecorder()
      await recorder.start()
      audioRecorderRef.current = recorder
      transcriptRef.current = ''
      setTranscripts(prev => ({ ...prev, [String(expandedQuestionId)]: '' }))
      setRecordingQuestionId(String(expandedQuestionId))
      message.info('开始录音')
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        message.error('请允许浏览器使用麦克风权限')
      } else {
        message.error('启动录音失败: ' + e.message)
      }
    }
  }

  const handleStopRecording = async () => {
    const recorder = audioRecorderRef.current
    if (!recorder) return
    
    const questionId = recordingQuestionId
    const audioBlob = recorder.stop()
    audioRecorderRef.current = null
    setRecordingQuestionId(null)
    message.info('录音已停止，正在转文字...')
    setTranscribing(true)

    try {
      const voiceConfig = await getVoiceModelConfig()
      if (!voiceConfig) {
        setTranscribing(false)
        return
      }
      const text = await transcribeAudio(audioBlob, voiceConfig)
      if (text) {
        transcriptRef.current = text
        setTranscripts(prev => ({ ...prev, [questionId || '']: text }))
        message.success('语音转文字完成')
        if (questionId) {
          updateAnswer(questionId, { candidateResponse: text })
          handleSaveAnswer(questionId, true, { candidate_response: text })
        }
      } else {
        message.warning('未识别到语音内容，请重试')
      }
    } catch (error: any) {
      message.error(error.message || '语音转文字失败')
    } finally {
      setTranscribing(false)
    }
  }

  const loadInterview = async () => {
    if (!interviewId) return
    setLoading(true)
    try {
      const data = await getInterviewDetail(interviewId)
      setInterview(data)
      const initialElapsed = data.elapsed_seconds || 0
      setElapsedTime(initialElapsed)
      elapsedTimeRef.current = initialElapsed
      if (data.answers?.answers) {
        const restored: Record<string, AnswerRecord> = {}
        data.answers.answers.forEach(item => {
          restored[item.question_id] = {
            questionId: item.question_id,
            question: item.title || '',
            answer: '',
            candidateResponse: item.answer_content || '',
            score: item.score ?? 0,
            timestamp: new Date().toISOString(),
          }
        })
        setAnswers(restored)
      }
      try {
        const tags = await getCandidateTags(interviewId)
        setCandidateTagsData(tags || [])
      } catch { setCandidateTagsData([]) }
    } catch (error) {
      message.error('加载面试详情失败')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleEndInterview = async () => {
    setSaving(true)
    try {
      await endInterview(interviewId!)
      message.success('面试已结束')
      navigate(`/workspaces/${jobRole}/interviews/${interviewId}`)
    } catch (error: any) {
      message.error(error.message || '结束面试失败')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAnswer = async (questionId: string, silent = false, overrideData?: { score?: number; candidate_response?: string }) => {
    const answer = answers[questionId]
    const data: { score?: number; candidate_response?: string } = {}
    if (overrideData) {
      if (overrideData.score) data.score = overrideData.score
      if (overrideData.candidate_response) data.candidate_response = overrideData.candidate_response
    } else {
      if (!answer) return
      if (answer.score > 0) data.score = answer.score
      if (answer.candidateResponse) data.candidate_response = answer.candidateResponse
    }
    if (!data.score && !data.candidate_response) return
    try {
      await saveAnswer(interviewId!, questionId, data)
      if (!silent) message.success('答案已保存')
    } catch (error: any) {
      message.error(error.message || '保存失败')
    }
  }

  const autoSaveAnswer = (questionId: string) => {
    if (autoSaveTimerRef.current[questionId]) {
      clearTimeout(autoSaveTimerRef.current[questionId])
    }
    autoSaveTimerRef.current[questionId] = window.setTimeout(() => {
      handleSaveAnswer(questionId, true)
      delete autoSaveTimerRef.current[questionId]
    }, 1000)
  }

  const updateAnswer = (questionId: string, updates: Partial<AnswerRecord>) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        questionId,
        question: updates.question || prev[questionId]?.question || '',
        answer: updates.answer || prev[questionId]?.answer || '',
        candidateResponse: updates.candidateResponse ?? prev[questionId]?.candidateResponse ?? '',
        score: updates.score ?? prev[questionId]?.score ?? 0,
        timestamp: new Date().toISOString(),
        ...updates,
      },
    }))
  }

  const handleQuestionExpand = async (question: QuestionItem) => {
    if (recordingQuestionId && String(question.id) !== recordingQuestionId) {
      await handleStopRecording()
    }
    setExpandedQuestionId(question.id)
    if (!answers[question.id]) {
      updateAnswer(question.id, {
        question: question.question,
        answer: question.answer || '',
      })
    }
    setTranscripts(prev => ({ ...prev, [question.id]: answers[question.id]?.candidateResponse || transcripts[question.id] || '' }))
    transcriptRef.current = answers[question.id]?.candidateResponse || transcripts[question.id] || ''
  }

  const getDifficultyConfig = (difficulty: string) => {
    const normalized = difficulty.replace(/-.*$/, '')
    const conf = DIFFICULTY_CONFIG[normalized]
    if (!conf) return { label: difficulty, color: colors.textTertiary, bgColor: isDark ? colors.surfaceHover : '#f5f5f5' }
    if (isDark) {
      const r = parseInt(conf.color.slice(1, 3), 16)
      const g = parseInt(conf.color.slice(3, 5), 16)
      const b = parseInt(conf.color.slice(5, 7), 16)
      return { label: conf.label, color: conf.color, bgColor: `rgba(${r}, ${g}, ${b}, 0.15)` }
    }
    return conf
  }

  const answeredCount = Object.values(answers).filter(a => a.score > 0 || a.candidateResponse).length

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.background,
        flexDirection: 'column',
        gap: 16
      }}>
        <Spin size="large" />
        <span style={{ color: colors.textSecondary }}>加载面试信息...</span>
      </div>
    )
  }

  if (!interview) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.background,
        color: colors.textPrimary
      }}>
        面试信息不存在
      </div>
    )
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: colors.background,
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    }}>
      {generating && (
        <div style={{
          background: colors.primary,
          color: '#fff',
          padding: '6px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontSize: 13,
          fontWeight: 500,
        }}>
          <RobotOutlined spin />
          正在生成问题，请勿离开页面...
        </div>
      )}
      {/* ===== 顶部栏 ===== */}
      <div style={{
        height: 56,
        background: isDark
          ? 'linear-gradient(180deg, rgba(30,30,30,0.95) 0%, rgba(20,20,20,0.98) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(245,245,245,0.98) 100%)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        flexShrink: 0,
        boxShadow: isDark ? '0 1px 8px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.04)',
        zIndex: 10,
      }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => {
            handleSaveElapsedTime()
            navigate(`/workspaces/${jobRole}/interviews/${interviewId}`)
          }}
          style={{
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            background: 'transparent',
            color: colors.textSecondary,
            fontWeight: 500,
          }}
        >
          返回详情
        </Button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            borderRadius: 20,
            padding: '4px 16px',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            <ClockCircleOutlined style={{ color: colors.primary, fontSize: 14 }} />
            <span style={{
              fontSize: 18,
              fontWeight: 700,
              color: colors.primary,
              letterSpacing: 2,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {formatTime(elapsedTime)}
            </span>
          </div>
          <div style={{
            fontSize: 12,
            color: colors.textTertiary,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span>已答 {answeredCount}/{questions.length}</span>
          </div>
        </div>

        <Button
          type="primary"
          danger
          icon={<CheckCircleOutlined />}
          onClick={handleEndInterview}
          loading={saving}
          style={{
            borderRadius: 8,
            fontWeight: 600,
            height: 36,
          }}
        >
          结束面试
        </Button>
      </div>

      {/* ===== 主内容区 ===== */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
      }}>
        {/* ===== 左侧简历区 ===== */}
        <div style={{
          width: resumeWidth,
          background: isDark
            ? 'linear-gradient(135deg, rgba(25,25,25,1) 0%, rgba(20,20,20,1) 100%)'
            : 'linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(248,248,248,1) 100%)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          userSelect: isDragging ? 'none' : 'auto',
        }}>
          {/* 简历头部 */}
          <div style={{
            padding: '14px 20px',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: colors.primaryBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            }}>
              <UserOutlined style={{ color: colors.primary, fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: colors.textPrimary, fontSize: 15, lineHeight: '22px' }}>
                {interview.candidate_name}
              </div>
              <div style={{ fontSize: 12, color: colors.textTertiary, lineHeight: '16px' }}>
                {interview.target_level} · {getJobRoleName(interview.job_role)}
              </div>
            </div>
          </div>

          {/* 简历内容 */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: 16,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 12,
              color: colors.textSecondary,
              fontSize: 13,
              fontWeight: 500,
            }}>
              <FileTextOutlined style={{ fontSize: 14 }} />
              <span>候选人简历</span>
            </div>
            <div style={{
              background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              borderRadius: 10,
              padding: 16,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              lineHeight: 1.9,
              fontSize: 13,
              color: colors.textPrimary,
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
            }}>
              {interview.resume?.content || '暂无简历'}
            </div>
          </div>
        </div>

        {/* ===== 拖拽分割条 ===== */}
        <div
          onMouseDown={(e) => {
            e.preventDefault()
            setIsDragging(true)
            const startX = e.clientX
            const startWidth = resumeWidth
            const handleMouseMove = (moveEvent: MouseEvent) => {
              const delta = moveEvent.clientX - startX
              const newWidth = Math.max(200, Math.min(600, startWidth + delta))
              setResumeWidth(newWidth)
            }
            const handleMouseUp = () => {
              setIsDragging(false)
              document.removeEventListener('mousemove', handleMouseMove)
              document.removeEventListener('mouseup', handleMouseUp)
            }
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
          }}
          style={{
            width: 6,
            cursor: 'col-resize',
            background: isDragging ? colors.primary : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
            transition: isDragging ? 'none' : 'background 0.2s',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 2,
            height: 32,
            borderRadius: 1,
            background: isDragging ? colors.primary : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'),
            transition: isDragging ? 'none' : 'background 0.2s',
          }} />
        </div>

        {/* ===== 右侧题目区 ===== */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* 题目区头部 */}
          <div style={{
            padding: '10px 24px',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '67px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, color: colors.textPrimary, fontSize: 15 }}>
                面试题目
              </span>
              <Tag style={{
                borderRadius: 12,
                background: colors.primaryBg,
                color: colors.primary,
                border: 'none',
                fontSize: 12,
                margin: 0,
              }}>
                {questions.length} 道
              </Tag>
            </div>
            {answeredCount > 0 && (
              <div style={{ fontSize: 12, color: colors.textTertiary }}>
                进度 {answeredCount}/{questions.length}
              </div>
            )}
            <Button
              icon={<RobotOutlined />}
              size="small"
              onClick={() => {
                setSelectedDifficultyLevels(interview?.difficulty_levels as string[] || [])
                setSelectedTags({})
                setGenerateModalVisible(true)
                setModalMinimized(false)
              }}
              style={{ borderRadius: 8, height: 31 }}
            >
              继续生成问题
            </Button>
          </div>

          {/* 分类标签筛选栏 */}
          {questions.length > 0 && (() => {
            const categoryCount: Record<string, number> = {}
            questions.forEach(q => {
              const cat = q.category || '未分类'
              categoryCount[cat] = (categoryCount[cat] || 0) + 1
            })
            const categories = Object.entries(categoryCount).sort(([a], [b]) => a.localeCompare(b))
            const activeKey = selectedCategoryFilter || 'all'
            return (
              <div style={{
                flexShrink: 0,
                padding: '6px 24px',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
              }}>
                <div
                  onClick={() => setSelectedCategoryFilter(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    background: activeKey === 'all'
                      ? isDark ? 'rgba(255,255,255,0.08)' : colors.primaryBg
                      : isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f5',
                    color: activeKey === 'all' ? colors.primary : colors.textSecondary,
                    fontWeight: activeKey === 'all' ? 600 : 500,
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontSize: 12 }}>📋</span>
                  <span>全部</span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: activeKey === 'all' ? colors.primary : colors.textTertiary,
                    background: activeKey === 'all'
                      ? isDark ? 'rgba(255,255,255,0.06)' : `${colors.primary}15`
                      : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    padding: '0 5px',
                    borderRadius: 6,
                    lineHeight: '16px',
                  }}>{questions.length}</span>
                </div>
                {categories.map(([cat, count]) => {
                  const catColor = getCategoryColor(cat)
                  const isActive = activeKey === cat
                  return (
                    <div
                      key={cat}
                      onClick={() => setSelectedCategoryFilter(isActive ? null : cat)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        background: isActive
                          ? isDark ? `${catColor}18` : `${catColor}12`
                          : isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f5',
                        color: isActive ? catColor : colors.textSecondary,
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                        <span style={{ width: 16, display: 'inline-flex', justifyContent: 'center', flexShrink: 0 }}>
                          {isActive ? <span style={{ fontSize: 12 }}>🎯</span> : getCategoryIcon(cat, isActive)}
                        </span>
                      <span>{cat}</span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: isActive ? catColor : colors.textTertiary,
                        background: isActive
                          ? isDark ? `${catColor}20` : `${catColor}12`
                          : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                        padding: '0 5px',
                        borderRadius: 6,
                        lineHeight: '16px',
                      }}>{count}</span>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* 题目列表 */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: 20,
          }}>
            {filteredQuestions.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: 60,
                color: colors.textTertiary,
              }}>
                <FileTextOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }} />
                <p>暂无面试题目</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredQuestions.map((question: QuestionItem, index: number) => {
                  const diffConf = getDifficultyConfig(question.difficulty)
                  const isExpanded = expandedQuestionId === question.id
                  const isThisRecording = recordingQuestionId === question.id
                  const hasAnswer = answers[question.id]?.score > 0 || answers[question.id]?.candidateResponse

                  return (
                    <div key={question.id} style={{
                      borderRadius: 12,
                      border: `1px solid ${isExpanded
                        ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)')
                        : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)')}`,
                      background: isExpanded
                        ? (isDark ? colors.surface : '#ffffff')
                        : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.7)'),
                      overflow: 'hidden',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: isExpanded
                        ? (isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.08)')
                        : 'none',
                    }}>
                      {/* 题目头部 - 点击展开 */}
                      <div
                        onClick={() => {
                          if (isExpanded) {
                            if (recordingQuestionId === String(question.id)) {
                              handleStopRecording()
                            }
                            setExpandedQuestionId(undefined)
                          } else {
                            handleQuestionExpand(question)
                          }
                        }}
                        style={{
                          padding: '14px 20px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          transition: 'background 0.2s',
                        }}
                      >
                        {/* 序号圆 */}
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: hasAnswer ? colors.success : (isExpanded ? colors.primary : colors.primaryBg),
                          color: hasAnswer ? '#fff' : (isExpanded ? '#fff' : colors.primary),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          fontWeight: 700,
                          transition: 'all 0.3s',
                          flexShrink: 0,
                        }}>
                          {hasAnswer ? '✓' : index + 1}
                        </div>

                        {/* 类型标签 */}
                        {question.category && (
                          <Tag style={{
                            borderRadius: 8,
                            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                            color: colors.textSecondary,
                            border: 'none',
                            fontSize: 11,
                            margin: 0,
                            flexShrink: 0,
                          }}>
                            {question.category}
                          </Tag>
                        )}

                        {/* 难度标签 */}
                        <Tag style={{
                          borderRadius: 8,
                          background: diffConf.bgColor,
                          color: diffConf.color,
                          border: 'none',
                          fontSize: 11,
                          margin: 0,
                          flexShrink: 0,
                        }}>
                          {diffConf.label}
                        </Tag>

                        {/* 题目标题 */}
                        <div style={{
                          flex: 1,
                          color: colors.textPrimary,
                          fontSize: 14,
                          fontWeight: isExpanded ? 600 : 400,
                          lineHeight: '22px',
                          overflow: 'hidden',
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                        }}>
                          {question.question}
                        </div>

                        {/* 已评分 */}
                        {answers[question.id]?.score > 0 && (
                          <Rate
                            disabled
                            value={answers[question.id].score}
                            style={{ fontSize: 11, flexShrink: 0 }}
                            count={5}
                          />
                        )}
                      </div>

                      {/* 展开内容 */}
                      {isExpanded && (
                        <div style={{
                          padding: '0 20px 20px',
                          animation: 'fadeIn 0.3s ease-out',
                        }}>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 16,
                          }}>
                            {/* 参考答案 */}
                            <div style={{
                              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                              borderRadius: 10,
                              padding: 16,
                              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                            }}>
                              <div style={{
                                fontWeight: 600,
                                marginBottom: 10,
                                color: colors.textPrimary,
                                fontSize: 13,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}>
                                <FileTextOutlined style={{ fontSize: 14, color: colors.primary }} />
                                参考答案
                              </div>
                              <div style={{
                                color: colors.textSecondary,
                                lineHeight: 1.8,
                                whiteSpace: 'pre-wrap',
                                fontSize: 13,
                              }}>
                                {question.answer || '暂无参考答案'}
                              </div>
                            </div>

                            {/* 候选人回答 */}
                            <div style={{
                              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                              borderRadius: 10,
                              padding: 16,
                              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                            }}>
                              <div style={{
                                fontWeight: 600,
                                marginBottom: 10,
                                color: colors.textPrimary,
                                fontSize: 13,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <SoundOutlined style={{ fontSize: 14, color: colors.primary }} />
                                  候选人回答
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <Tooltip title={isThisRecording ? '停止录音' : '开始录音'}>
                                    <Button
                                      type={isThisRecording ? 'primary' : 'default'}
                                      danger={isThisRecording}
                                      icon={isThisRecording ? <AudioMutedOutlined /> : <AudioOutlined />}
                                      onClick={() => {
                                        if (isThisRecording) {
                                          handleStopRecording()
                                        } else {
                                          handleStartRecording()
                                        }
                                      }}
                                      size="small"
                                      disabled={transcribing && !isThisRecording}
                                      style={{
                                        borderRadius: 8,
                                        ...(isThisRecording ? {} : {
                                          background: 'transparent',
                                          border: `1px solid ${colors.border}`,
                                        }),
                                      }}
                                    />
                                  </Tooltip>
                                </div>
                              </div>

                              {/* 录音状态指示器 */}
                              {isThisRecording && (
                                <div style={{
                                  marginBottom: 10,
                                  padding: '6px 12px',
                                  background: isDark ? 'rgba(255,77,79,0.12)' : 'rgba(255,77,79,0.06)',
                                  borderRadius: 8,
                                  fontSize: 12,
                                  color: colors.error,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                }}>
                                  <span style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: colors.error,
                                    animation: 'pulse 1.5s ease-in-out infinite',
                                  }} />
                                  正在录音中...
                                </div>
                              )}

                              {transcribing && !isThisRecording && (
                                <div style={{
                                  marginBottom: 10,
                                  padding: '6px 12px',
                                  background: isDark ? `${colors.primary}18` : `${colors.primary}10`,
                                  borderRadius: 8,
                                  fontSize: 12,
                                  color: colors.primary,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                }}>
                                  <Spin size="small" />
                                  正在转文字...
                                </div>
                              )}

                              <Input.TextArea
                                value={transcripts[question.id] || answers[question.id]?.candidateResponse || ''}
                                onChange={(e) => {
                                  setTranscripts(prev => ({ ...prev, [question.id]: e.target.value }))
                                  transcriptRef.current = e.target.value
                                  updateAnswer(question.id, { candidateResponse: e.target.value })
                                  autoSaveAnswer(question.id)
                                }}
                                placeholder="点击录音按钮开始录制，或手动输入候选人回答..."
                                autoSize={{ minRows: 4, maxRows: 8 }}
                                style={{
                                  marginBottom: 12,
                                  background: isDark ? colors.surface : '#fff',
                                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                  borderRadius: 8,
                                  color: colors.textPrimary,
                                }}
                              />

                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ color: colors.textTertiary, fontSize: 12 }}>评分</span>
                                  <Rate
                                    value={answers[question.id]?.score || 0}
                                    onChange={(value) => {
                                    updateAnswer(question.id, { score: value })
                                    handleSaveAnswer(question.id, true, { score: value })
                                  }}
                                    style={{ fontSize: 16 }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== 全局 CSS 动画 ===== */}

      {/* 继续生成问题弹窗（Portal 到 body 避免被 overflow:hidden 裁剪） */}
      {generateModalVisible && createPortal(
        <>
          {!modalMinimized && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: 900,
            maxHeight: '80vh',
            background: colors.surface,
            borderRadius: 12,
            boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* 弹窗头部 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 24px',
              borderBottom: `1px solid ${colors.border}`,
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <RobotOutlined style={{ color: colors.primary }} />
                <span style={{ fontWeight: 600, fontSize: 16, color: colors.textPrimary }}>继续生成问题</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tooltip title="收起弹窗">
                  <Button
                    type="text"
                    icon={<MinusOutlined />}
                    size="small"
                    onClick={() => setModalMinimized(true)}
                    style={{ borderRadius: 6 }}
                  />
                </Tooltip>
                <Button
                  type="text"
                  icon={<CloseOutlined />}
                  size="small"
                  onClick={() => {
                    setGenerateModalVisible(false)
                    setModalMinimized(false)
                    setSelectedTags({})
                  }}
                  style={{ borderRadius: 6 }}
                />
              </div>
            </div>

            {/* 弹窗内容 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              <div style={{ display: 'flex', gap: 0 }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: colors.textPrimary, marginBottom: 8 }}>
                    选择标签（必选）
                  </div>
                  <TagSelector
                    candidateTags={candidateTagsData}
                    selectedTags={selectedTags}
                    onSelect={setSelectedTags}
                  />
                </div>

                <div style={{ width: 1, background: colors.border, margin: '4px 0', flexShrink: 0 }} />

                <div style={{ width: 300, flexShrink: 0, paddingLeft: 20, maxHeight: 480, overflowY: 'auto' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: colors.textPrimary, marginBottom: 6 }}>
                    选择题库
                  </div>
                  <Select
                    mode="multiple"
                    value={selectedDifficultyLevels}
                    onChange={(value) => {
                      setSelectedDifficultyLevels(value)
                      if (value.length === 0) setDifficultyDistributions({})
                      else if (value.length === 1) setDifficultyDistributions({ [value[0]]: 100 })
                      else setDifficultyDistributions({})
                    }}
                    options={[
                      { value: 'L1-初级', label: 'L1-初级' },
                      { value: 'L2-中级', label: 'L2-中级' },
                      { value: 'L3-高级', label: 'L3-高级' },
                      { value: 'L4-专家', label: 'L4-专家' },
                      { value: 'L5-大神', label: 'L5-大神' },
                    ]}
                    placeholder="请选择题库难度等级"
                    style={{ width: '100%' }}
                  />
                  <p style={{ marginTop: 6, marginBottom: 16, color: colors.textTertiary, fontSize: 11 }}>
                    选择多个题库后，可调整各难度题目占比
                  </p>

                  <div style={{ fontWeight: 600, fontSize: 14, color: colors.textPrimary, marginBottom: 6 }}>
                    难度分布比例
                  </div>
                  <DifficultyDistribution
                    selectedLevels={selectedDifficultyLevels}
                    onChange={setDifficultyDistributions}
                  />
                  <p style={{ marginTop: 4, marginBottom: 0, color: colors.textTertiary, fontSize: 11 }}>
                    拖动圆点调整分布，总计必须为 100%
                  </p>
                </div>
              </div>
            </div>

            {/* 弹窗底部按钮 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '12px 24px',
              borderTop: `1px solid ${colors.border}`,
              flexShrink: 0,
            }}>
              <Button
                onClick={() => {
                  setGenerateModalVisible(false)
                  setModalMinimized(false)
                  setSelectedTags({})
                }}
                style={{ borderRadius: 8 }}
              >
                取消
              </Button>
              <Button
                type="primary"
                loading={submittingQuestions}
                onClick={async () => {
                  if (!interviewId) return
                  if (selectedDifficultyLevels.length === 0) {
                    message.error('请至少选择一个题库')
                    return
                  }
                  const tagEntries = Object.entries(selectedTags)
                  if (tagEntries.length === 0) {
                    message.error('请至少选择一个标签')
                    return
                  }
                  const questionCount = tagEntries.reduce((sum, [, count]) => sum + count, 0)
                  const categoryCounts: Record<string, number> = {}
                  tagEntries.forEach(([tag, count]) => { categoryCounts[tag] = count })
                  setSubmittingQuestions(true)
                  setGenerating(true)
                  setStreamMinimized(false)
                  setStreamContent('')
                  setGenerateModalVisible(false)
                  setModalMinimized(false)
                  setSubmittingQuestions(false)
                  try {
                    await generateQuestions(interviewId!, {
                      difficultyLevels: selectedDifficultyLevels,
                      distributions: difficultyDistributions,
                      questionCount: questionCount,
                      selectedCategories: Object.keys(selectedTags),
                      categoryCounts: categoryCounts,
                      onChunk: (chunk) => {
                        setStreamContent(prev => prev + chunk)
                      },
                    })
                    message.success('问题生成完成！')
                    loadInterview()
                  } catch (error: any) {
                    message.error(error.message || '生成问题失败')
                  } finally {
                    setGenerating(false)
                  }
                }}
                style={{ borderRadius: 8 }}
              >
                确认生成
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 收起状态 - 右下角小浮窗 */}
      {modalMinimized && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            gap: 0,
          }}
        >
          <div
            onClick={() => setModalMinimized(false)}
            style={{
              background: colors.surface,
              border: `1px solid ${colors.primary}40`,
              borderRadius: '10px 0 0 10px',
              padding: '10px 16px',
              cursor: 'pointer',
              boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceHover
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.surface
            }}
          >
            <RobotOutlined style={{ color: colors.primary, fontSize: 16 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>生成问题</span>
            <ExpandOutlined style={{ color: colors.textTertiary, fontSize: 14 }} />
          </div>
          <div
            onClick={(e) => {
              e.stopPropagation()
              setGenerateModalVisible(false)
              setModalMinimized(false)
              setSelectedTags({})
            }}
            style={{
              background: colors.surface,
              border: `1px solid ${colors.primary}40`,
              borderLeft: 'none',
              borderRadius: '0 10px 10px 0',
              padding: '10px 12px',
              cursor: 'pointer',
              boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.12)',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark ? 'rgba(255,77,79,0.15)' : '#fff1f0'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.surface
            }}
          >
            <CloseOutlined style={{ color: colors.textTertiary, fontSize: 14 }} />
          </div>
        </div>
      )}
        </>,
        document.body
      )}

      {/* 流式生成内容展示（Portal 到 body） */}
      {generating && streamContent && createPortal(
        <>
          {!streamMinimized && (
            <div style={{
              position: 'fixed',
              bottom: 20,
              right: 20,
              width: 400,
              maxHeight: 300,
              background: colors.surface,
              border: `1px solid ${colors.primary}40`,
              borderRadius: 12,
              overflow: 'hidden',
              zIndex: 1000,
              boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderBottom: `1px solid ${colors.border}`,
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.primary, fontWeight: 600, fontSize: 13 }}>
                  <RobotOutlined spin />
                  正在生成问题...
                </div>
                <Tooltip title="收起">
                  <Button
                    type="text"
                    icon={<MinusOutlined />}
                    size="small"
                    onClick={() => setStreamMinimized(true)}
                    style={{ borderRadius: 6 }}
                  />
                </Tooltip>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontSize: 13, color: colors.textPrimary }}>
                  {streamContent}
                </pre>
              </div>
            </div>
          )}

          {streamMinimized && (
            <div
              onClick={() => setStreamMinimized(false)}
              style={{
                position: 'fixed',
                bottom: 20,
                right: 20,
                zIndex: 1001,
                background: colors.surface,
                border: `1px solid ${colors.primary}40`,
                borderRadius: 10,
                padding: '10px 16px',
                cursor: 'pointer',
                boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.12)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.surface
              }}
            >
              <RobotOutlined spin style={{ color: colors.primary, fontSize: 16 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>生成中...</span>
              <ExpandOutlined style={{ color: colors.textTertiary, fontSize: 14 }} />
            </div>
          )}
        </>,
        document.body
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}