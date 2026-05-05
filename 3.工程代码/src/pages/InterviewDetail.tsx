import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Button, Tag, Steps, message, Tabs, Upload, Modal, Input, Form, Select, Space, Spin, Rate } from 'antd'
import { ArrowLeftOutlined, PlayCircleOutlined, CheckCircleOutlined, UploadOutlined, FileTextOutlined, RobotOutlined, EditOutlined, DeleteOutlined, EyeOutlined, TagOutlined, ReloadOutlined, UserOutlined, CalendarOutlined } from '@ant-design/icons'
import type { InterviewDetail } from '@/types'
import { getInterviewDetail, startInterview, endInterview, saveResume, generateQuestions, findInterviewDir, generateCandidateTags, getCandidateTags, saveCandidateTags, saveAnswer, saveAssessment } from '@/modules/interview'
import type { CandidateTag } from '@/modules/interview'
import { assessWithScores } from '@/modules/assessment'
import { getConfig } from '@/core/filesystem'
import { formatDate, formatDateOnly } from '@/utils/date'
import { useThemeStore } from '@/stores/themeStore'
import { useAppStore } from '@/stores'
import { readFile, listFiles, parseResume } from '@/core/filesystem'
import DifficultyDistribution from '@/components/DifficultyDistribution'
import ConfirmModal from '@/components/ConfirmModal'
import TagSelector from '@/components/TagSelector'

const { TextArea } = Input

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: '待面试', color: '#8c8c8c', bgColor: '#fafafa' },
  in_progress: { label: '面试中', color: '#1677ff', bgColor: '#e6f4ff' },
  completed: { label: '已完成', color: '#52c41a', bgColor: '#f6ffed' },
  cancelled: { label: '已取消', color: '#ff4d4f', bgColor: '#fff1f0' },
}

const difficultyConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  'L1': { label: 'L1', color: '#52c41a', bgColor: '#f6ffed' },
  'L2': { label: 'L2', color: '#1677ff', bgColor: '#e6f4ff' },
  'L3': { label: 'L3', color: '#722ed1', bgColor: '#f9f0ff' },
  'L4': { label: 'L4', color: '#fa8c16', bgColor: '#fff7e6' },
  'L5': { label: 'L5', color: '#cf1322', bgColor: '#fff1f0' },
}

export default function InterviewDetail() {
  const { colors } = useThemeStore()
  const { setCurrentInterview } = useAppStore()
  const { jobRole, interviewId } = useParams<{ jobRole: string; interviewId: string }>()
  const navigate = useNavigate()
  const [interview, setInterview] = useState<InterviewDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [resumeModalVisible, setResumeModalVisible] = useState(false)
  const [questionModalVisible, setQuestionModalVisible] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [submittingQuestions, setSubmittingQuestions] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null)
  const [aiScoring, setAiScoring] = useState<Record<string, boolean>>({})
  const [aiScores, setAiScores] = useState<Record<string, number>>({})
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({})
  const sortedQuestions = (qs: any[]) => [...qs].sort((a, b) => {
    const diffOrder: Record<string, number> = { 'L1-初级': 1, 'L2-中级': 2, 'L3-高级': 3, 'L4-专家': 4, 'L5-大神': 5 }
    const aCat = (a as any).category || ''
    const bCat = (b as any).category || ''
    if (aCat !== bCat) return aCat.localeCompare(bCat)
    const aDiff = diffOrder[a.difficulty] || 99
    const bDiff = diffOrder[b.difficulty] || 99
    return aDiff - bDiff
  }).map(q => ({ question: q.title || q.question || '', answer: q.answer || '', difficulty: q.difficulty || '', evaluation_dimension: q.evaluation_dimension || '', category: (q as any).category || '' }))
  const [editedQuestions, setEditedQuestions] = useState<{ question: string; answer: string; difficulty: string; evaluation_dimension: string; category: string }[]>([])
  const [deleteAllQuestionsVisible, setDeleteAllQuestionsVisible] = useState(false)
  const [candidateTags, setCandidateTags] = useState<CandidateTag[]>([])
  const [generatingTags, setGeneratingTags] = useState(false)
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null)
  const [tagInputKey, setTagInputKey] = useState(0)
  const [categoryInputKey, setCategoryInputKey] = useState(0)
  const streamRef = useRef<HTMLDivElement>(null)
  const [warningModalVisible, setWarningModalVisible] = useState(false)
  const [clearAssessModalVisible, setClearAssessModalVisible] = useState(false)
  const [clearAssessCallback, setClearAssessCallback] = useState<(() => void | Promise<void>) | null>(null)
  const [jdContentModalVisible, setJdContentModalVisible] = useState(false)
  const [jdLoading, setJdLoading] = useState(false)
  const [jdFullContent, setJdFullContent] = useState('')
  const [resumeForm] = Form.useForm()
  const [questionForm] = Form.useForm()

  // 新增状态
  const [selectedDifficultyLevels, setSelectedDifficultyLevels] = useState<string[]>([])
  const [difficultyDistributions, setDifficultyDistributions] = useState<Record<string, number>>({})
  const [selectedTags, setSelectedTags] = useState<Record<string, number>>({})
  const [candidateDetailExpanded, setCandidateDetailExpanded] = useState(false)
  const [interviewerRatings, setInterviewerRatings] = useState({
    communication: 0,
    project: 0,
    potential: 0,
    values: 0,
  })
  const [candidateBonus, setCandidateBonus] = useState(0)
  const [assessing, setAssessing] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('resume')
  const [interviewInfoExpanded, setInterviewInfoExpanded] = useState(false)

  useEffect(() => {
    loadInterview()
  }, [interviewId])

  useEffect(() => {
    if (!interview) return
    const status = interview.status
    if (status === 'pending') {
      if (interview.resume && candidateTags.length > 0) {
        setActiveTab('questions')
      } else {
        setActiveTab('resume')
      }
    } else if (status === 'in_progress') {
      setActiveTab('questions')
    } else if (status === 'completed') {
      setActiveTab('interview_result')
    }
  }, [interview?.status, interview?.resume, candidateTags.length])

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
    if (interview) {
      setCurrentInterview(interview)
      loadDifficultyFromInterview(interview)
      if (interview.assessment) {
        const a = interview.assessment as any
        setInterviewerRatings({
          communication: a.communication_score || 0,
          project: a.project_score || 0,
          potential: a.potential_score || 0,
          values: a.values_score || 0,
        })
        setCandidateBonus(a.candidate_bonus_score || 0)
      }
    }
    return () => {
      setCurrentInterview(null)
    }
  }, [interview])

  const handleAiScoreAll = async () => {
    if (!interview?.questions?.questions) return
    if (interview?.assessment?.hiring_recommendation) {
      setClearAssessCallback(() => doAiScoreAll)
      setClearAssessModalVisible(true)
      return
    }
    doAiScoreAll()
  }

  const doAiScoreAll = async () => {
    if (!interview?.questions?.questions) return
    const config = await getConfig()
    const defaultModel = (config?.aiModels || []).find((m: any) => m.isDefault) || (config?.aiModels || [])[0]
    if (!defaultModel) {
      message.error('请先配置AI模型')
      return
    }
    const questions = interview.questions.questions
    const answersData = interview.answers?.answers || []
    const answered = questions.filter(q => {
      const ans = answersData.find(a => a.question_id === q.id || a.question_id === `Q${questions.indexOf(q) + 1}`)
      return ans && ans.answer_content
    })
    if (answered.length === 0) {
      message.warning('没有已回答的题目可以评分')
      return
    }
    const initialScoring: Record<string, boolean> = {}
    answered.forEach(q => { initialScoring[q.id] = true })
    setAiScoring(initialScoring)
    for (const q of answered) {
      const questionIndex = questions.indexOf(q) + 1
      const questionId = q.id || `Q${questionIndex}`
      const ans = answersData.find(a => a.question_id === questionId)
      const candidateResponse = ans?.answer_content || ''
      if (!candidateResponse) {
        setAiScoring(prev => ({ ...prev, [q.id]: false }))
        continue
      }
      try {
        const payload = {
          model: defaultModel.model,
          messages: [
            { role: 'system', content: '你是一位专业的面试评估专家。请根据候选人回答的质量、完整性、准确性进行1-5分评分。1分：完全错误，2分：部分正确有缺陷，3分：基本正确不完整，4分：正确较完整，5分：完美超越参考答案。只返回一个数字，不要任何其他内容。' },
            { role: 'user', content: `面试问题：${q.question || q.title}\n问题难度：${q.difficulty || '未知'}\n考察维度：${q.evaluation_dimension || '未知'}\n参考答案：${q.answer || '无'}\n候选人回答：${candidateResponse}` }
          ],
          temperature: 0.3,
          max_tokens: 10,
          stream: false,
        }
        const response = await fetch(`${defaultModel.baseURL}/chat/completions`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${defaultModel.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!response.ok) {
          console.error(`AI评分失败(${q.id}): HTTP ${response.status}`)
          continue
        }
        const contentType = response.headers.get('content-type') || ''
        let resultText = ''
        if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
          const rawText = await response.text()
          for (const line of rawText.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data:')) continue
            const data = trimmed.slice(5).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.choices?.[0]?.message?.content) resultText += parsed.choices[0].message.content
              if (parsed.choices?.[0]?.delta?.content) resultText += parsed.choices[0].delta.content
            } catch {}
          }
        } else {
          const data = await response.json()
          resultText = data.choices?.[0]?.message?.content || ''
        }
        const score = parseInt(resultText.trim())
        if (score >= 1 && score <= 5) {
          setAiScores(prev => ({ ...prev, [q.id]: score }))
          await saveAnswer(interviewId!, questionId, { ai_score: score })
        }
      } catch (error: any) {
        console.error(`AI评分失败(${q.id}):`, error)
      }
      setAiScoring(prev => ({ ...prev, [q.id]: false }))
    }
    message.success('AI评分完成')
    loadInterview()
  }

  const DIFFICULTY_CONFIG_LOCAL: Record<string, { label: string; color: string; bgColor: string }> = {
    'L1': { label: '初级', color: '#52c41a', bgColor: '#f6ffed' },
    'L2': { label: '中级', color: '#1677ff', bgColor: '#e6f4ff' },
    'L3': { label: '高级', color: '#722ed1', bgColor: '#f9f0ff' },
    'L4': { label: '专家', color: '#fa8c16', bgColor: '#fff7e6' },
    'L5': { label: '资深', color: '#cf1322', bgColor: '#fff1f0' },
  }

  const getDifficultyConfig = (difficulty: string) => {
    const normalized = difficulty.replace(/-.*$/, '')
    const conf = DIFFICULTY_CONFIG_LOCAL[normalized]
    if (!conf) return { label: difficulty, color: colors.textTertiary, bgColor: colors.surfaceHover }
    return conf
  }

  const loadDifficultyFromInterview = (interviewData: InterviewDetail) => {
    if (interviewData.difficulty_levels && interviewData.difficulty_levels.length > 0) {
      const levels = interviewData.difficulty_levels as string[]
      setSelectedDifficultyLevels(levels)
      
      if (levels.length > 1) {
        const newDist: Record<string, number> = {}
        levels.forEach((level, index) => {
          newDist[level] = index === levels.length - 1 
            ? 100 - Math.floor(100 / levels.length) * (levels.length - 1) 
            : Math.floor(100 / levels.length)
        })
        setDifficultyDistributions(newDist)
      } else {
        setDifficultyDistributions({ [levels[0]]: 100 })
      }
    } else {
      setSelectedDifficultyLevels([])
      setDifficultyDistributions({})
    }
  }

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

  const getCategoryIcon = (category: string) => {
    const iconMap: Record<string, string> = {
      '技术类': '⚡',
      '项目类': '🏗',
      '软技能类': '🤝',
      '职业规划类': '🎯',
      '岗位挑战类': '🔥',
      '领导力类': '👑',
      '行业洞察类': '💡',
    }
    return <span style={{ fontSize: 14 }}>{iconMap[category] || '📌'}</span>
  }

  const loadInterview = async () => {
    if (!interviewId) return
    setLoading(true)
    try {
      const data = await getInterviewDetail(interviewId)
      setInterview(data)
      const tags = await getCandidateTags(interviewId)
      setCandidateTags(tags)
    } catch (error) {
      message.error('加载面试详情失败')
    } finally {
      setLoading(false)
    }
  }

  const handleViewJDContent = async () => {
    if (!interview?.jd_id || !jobRole) return
    setJdLoading(true)
    setJdFullContent('')
    setJdContentModalVisible(true)
    try {
    let jdPath: string | null = null
    
    const expectedFilename = `jd-${interview.jd_id}-template.md`
    
    try {
      const content = await readFile(`${jobRole}/templates/${expectedFilename}`)
      setJdFullContent(content)
    } catch {
      const templateFiles = await listFiles(`${jobRole}/templates/`)
      const matchingFile = templateFiles.find(f => 
        f.includes('/templates/') && f.endsWith(`-template.md`)
      )
      
      if (matchingFile) {
        jdPath = matchingFile
        const content = await readFile(jdPath)
        setJdFullContent(content)
      } else {
        throw new Error('未找到该 JD 配置文件')
      }
    }
    } catch (error: any) {
      if (error?.message?.includes('not found') || error?.code === 'FILE_NOT_FOUND') {
        message.error('未找到该 JD 配置文件')
      } else {
        message.error(error.message || '读取 JD 配置失败')
      }
      setJdContentModalVisible(false)
    } finally {
      setJdLoading(false)
    }
  }

  const handleStart = async () => {
    if (!interviewId) return

    if (!interview?.resume) {
      message.error('请先上传候选人简历')
      return
    }

    if (!interview?.questions || interview.questions.total_questions === 0) {
      setWarningModalVisible(true)
      return
    }

    try {
      await startInterview(interviewId)
      message.success('面试已开始')
      navigate(`/workspaces/${jobRole}/interviews/${interviewId}/in-progress`)
    } catch (error: any) {
      message.error(error.message || '开始失败')
    }
  }

  const handleEnd = async () => {
    if (!interviewId) return
    try {
      await endInterview(interviewId)
      message.success('面试已结束')
      loadInterview()
    } catch (error: any) {
      message.error(error.message || '结束失败')
    }
  }

  const handleUploadResume = async (values: any) => {
    if (!interviewId || !interview || !jobRole) return
    
    const file = values.file?.fileList?.[0]?.originFileObj
    if (!file) {
      message.error('请选择简历文件')
      return
    }
    
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ]
    const validExtensions = ['.pdf', '.docx', '.doc']
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      message.error('只支持 PDF 和 Word 格式的简历')
      return
    }
    
    try {
      message.loading('正在解析简历...', 0)
      
      const fileContent = await file.arrayBuffer()
      const fileBuffer = new Uint8Array(fileContent)
      
      let binaryString = ''
      const chunkSize = 8192
      for (let i = 0; i < fileBuffer.length; i += chunkSize) {
        const chunk = fileBuffer.slice(i, i + chunkSize)
        binaryString += String.fromCharCode.apply(null, chunk as any)
      }
      const base64Content = btoa(binaryString)
      
      const parsed = await parseResume('', file.type || `application/${fileExtension.slice(1)}`, base64Content)
      
      if (!parsed) {
        message.destroy()
        message.error('简历解析失败')
        return
      }
      
      await saveResume(interviewId, {
        candidate_name: interview.candidate_name,
        content: parsed.markdown,
      })
      
      message.destroy()
      message.success('简历上传并解析成功')
      setResumeModalVisible(false)
      resumeForm.resetFields()
      await loadInterview()
      
      // 自动触发标签生成
      if (candidateTags.length === 0) {
        setGeneratingTags(true)
        try {
          const tags = await generateCandidateTags(interviewId!)
          setCandidateTags(tags)
          message.success('候选人标签已自动生成')
        } catch (error: any) {
          console.warn('自动生成标签失败:', error.message)
        } finally {
          setGeneratingTags(false)
        }
      }
    } catch (error: any) {
      message.destroy()
      message.error(error.message || '上传失败')
    }
  }

  const handleGenerateQuestions = async () => {
    if (!interviewId || !jobRole || !interview) return
    
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
    setStreamContent('')
    setQuestionModalVisible(false)
    setSubmittingQuestions(false)
    
    try {
      const result = await generateQuestions(interviewId!, {
        difficultyLevels: selectedDifficultyLevels,
        distributions: difficultyDistributions,
        questionCount: questionCount,
        selectedCategories: Object.keys(selectedTags),
        categoryCounts: categoryCounts,
        onChunk: (chunk) => {
          setStreamContent(prev => prev + chunk)
          if (streamRef.current) {
            streamRef.current.scrollTop = streamRef.current.scrollHeight
          }
        },
      })
      
      message.success('问题清单生成完成！')
      loadInterview()
    } catch (error: any) {
      message.error(error.message || '生成问题清单失败')
    } finally {
      setGenerating(false)
    }
  }

  const handleAiAssess = async () => {
    if (!interviewId || !interview) return
    setAssessing(true)
    try {
      const questions = interview.questions?.questions || []
      const answersData = interview.answers?.answers || []
      let totalScore = 0
      let scoredCount = 0
      questions.forEach((q: any, index: number) => {
        const questionId = q.id || `Q${index + 1}`
        const ans = answersData.find((a: any) => a.question_id === questionId)
        const humanScore = ans?.score ?? 0
        const aiScore = (aiScores[q.id] || ans?.ai_score) ?? 0
        const finalScore = humanScore > 0 && aiScore > 0 ? (humanScore + aiScore) / 2 : (humanScore > 0 ? humanScore : aiScore)
        if (finalScore > 0) {
          totalScore += finalScore
          scoredCount++
        }
      })
      const candidateAvg = scoredCount > 0 ? totalScore / scoredCount : 0

      await assessWithScores(interviewId, candidateAvg, candidateBonus, interviewerRatings)
      message.success('AI智能评价完成')
      loadInterview()
    } catch (error: any) {
      message.error(error.message || 'AI智能评价失败')
    } finally {
      setAssessing(false)
    }
  }

  const checkAssessmentBeforeAction = (callback: () => void) => {
    if (interview?.assessment?.hiring_recommendation) {
      setClearAssessCallback(() => callback)
      setClearAssessModalVisible(true)
    } else {
      callback()
    }
  }

  const handleClearAssessmentAndProceed = async () => {
    if (!interviewId) return
    try {
      await saveAssessment(interviewId, {
        hiring_recommendation: '',
        hiring_reason: '',
        recommended_level: '',
        comprehensive_score: 0,
        level_gap: 0,
      })
      setClearAssessModalVisible(false)
      if (clearAssessCallback) {
        await clearAssessCallback()
        setClearAssessCallback(null)
      }
      loadInterview()
    } catch (error: any) {
      message.error(error.message || '操作失败')
    }
  }

  const handleInterviewerRatingChange = async (field: string, value: number) => {
    checkAssessmentBeforeAction(async () => {
      const newRatings = { ...interviewerRatings, [field]: value }
      setInterviewerRatings(newRatings)
      if (!interviewId) return
      try {
        await saveAssessment(interviewId, {
          communication_score: newRatings.communication,
          project_score: newRatings.project,
          potential_score: newRatings.potential,
          values_score: newRatings.values,
        })
      } catch (error: any) {
        console.error('保存面试官评分失败:', error)
      }
    })
  }

  const handleCandidateBonusChange = async (value: number) => {
    checkAssessmentBeforeAction(async () => {
      setCandidateBonus(value)
      if (!interviewId) return
      try {
        await saveAssessment(interviewId, {
          candidate_bonus_score: value,
        })
      } catch (error: any) {
        console.error('保存手动加分失败:', error)
      }
    })
  }

  const handleClearInterviewerRatings = async () => {
    checkAssessmentBeforeAction(async () => {
      const clearedRatings = { communication: 0, project: 0, potential: 0, values: 0 }
      setInterviewerRatings(clearedRatings)
      if (!interviewId) return
      try {
        await saveAssessment(interviewId, {
          communication_score: 0,
          project_score: 0,
          potential_score: 0,
          values_score: 0,
        })
      } catch (error: any) {
        console.error('清空面试官评分失败:', error)
      }
    })
  }

  const getStatusStep = () => {
    switch (interview?.status) {
      case 'pending': return 0
      case 'in_progress': return 1
      case 'completed': return 2
      default: return 0
    }
  }

  if (!interview) {
    return <div>加载中...</div>
  }

  const generatingBar = generating && (
    <div style={{
      position: 'fixed',
      top: 64,
      left: 27,
      right: 26,
      zIndex: 1000,
      background: colors.primary,
      color: '#fff',
      padding: '6px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      fontSize: 13,
      fontWeight: 500,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      borderRadius: '8px',
    }}>
      <RobotOutlined spin />
      正在生成问题，请勿离开页面...
    </div>
  )

  const isCompleted = interview?.status === 'completed'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {generatingBar}
      <div style={{ flexShrink: 0, padding: '24px 24px 0 24px' }}>
      <div style={{ marginBottom: 20, background: colors.surface, borderRadius: 14, border: `1px solid ${colors.border}`, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        <div style={{
          height: 4,
          background: `linear-gradient(90deg, ${
            interview.status === 'pending' ? statusConfig.pending.color :
            interview.status === 'in_progress' ? statusConfig.in_progress.color :
            interview.status === 'completed' ? statusConfig.completed.color : statusConfig.cancelled.color
          }, ${
            interview.status === 'pending' ? statusConfig.pending.color + '60' :
            interview.status === 'in_progress' ? statusConfig.in_progress.color + '60' :
            interview.status === 'completed' ? statusConfig.completed.color + '60' : statusConfig.cancelled.color + '60'
          }, transparent)`,
        }} />

        <div
          onClick={() => setInterviewInfoExpanded(!interviewInfoExpanded)}
          style={{
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            transition: 'background 0.2s',
            userSelect: 'none',
            height: 73,
          }}
        >
          <Button icon={<ArrowLeftOutlined />} onClick={(e) => { e.stopPropagation(); navigate(`/workspaces/${jobRole}/interviews`) }} disabled={generating} style={{ borderRadius: 8 }} size="small">返回</Button>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {(() => {
              const conf = statusConfig[interview.status] || { label: interview.status, color: colors.textTertiary, bgColor: colors.surfaceHover }
              return (
                <Tag style={{
                  borderRadius: 6, fontSize: 12, padding: '2px 10px', margin: 0,
                  background: conf.bgColor, color: conf.color, border: `1px solid ${conf.color}30`,
                  fontWeight: 600,
                }}>
                  {conf.label}
                </Tag>
              )
            })()}


            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: colors.primaryBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <UserOutlined style={{ fontSize: 14, color: colors.primary }} />
              </div>
              <span style={{ fontWeight: 600, fontSize: 14, color: colors.textPrimary }}>{interview.candidate_name}</span>
            </div>
            <span style={{ fontSize: 13, color: colors.textTertiary }}>·</span>
            <span style={{ fontSize: 13, color: colors.textSecondary, fontWeight: 500 }}>目标职级</span>
            <Tag style={{
              borderRadius: 6, fontSize: 12, padding: '2px 8px', margin: 0,
              background: '#f9f0ff14', color: '#722ed1', border: '1px solid #722ed130', fontWeight: 600,
            }}>
              {interview.target_level}
            </Tag>
            {interview.difficulty_levels && interview.difficulty_levels.length > 0 && (
              <>
                <span style={{ fontSize: 13, color: colors.textTertiary }}>·</span>
                <span style={{ fontSize: 13, color: colors.textSecondary, fontWeight: 500 }}>题库/难度</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {interview.difficulty_levels.map((level: string) => {
                    const normalizedLevel = level.replace(/-.*$/, '').replace(/^L(\d)/, 'L$1')
                    const conf = difficultyConfig[normalizedLevel] || { label: level, color: colors.textTertiary, bgColor: colors.surfaceHover }
                    return (
                      <Tag key={level} style={{
                        borderRadius: 4, fontSize: 11, padding: '0 6px', margin: 0,
                        background: conf.bgColor, color: conf.color, border: 'none',
                      }}>
                        {level}
                      </Tag>
                    )
                  })}
                </div>
              </>
            )}
            {interview.interviewer && (
              <>
                <span style={{ fontSize: 13, color: colors.textTertiary }}>·</span>
                <span style={{ fontSize: 13, color: colors.textSecondary, fontWeight: 500 }}>面试官 {interview.interviewer}</span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {interview.status === 'pending' && (
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={(e) => { e.stopPropagation(); handleStart() }} style={{ borderRadius: 8, height: 36, fontWeight: 700, fontSize: 14 }}>
                开始面试
              </Button>
            )}
            {interview.status === 'in_progress' && (
              <>
                <Button type="primary" icon={<PlayCircleOutlined />} onClick={(e) => { e.stopPropagation(); navigate(`/workspaces/${jobRole}/interviews/${interviewId}/in-progress`) }} style={{ borderRadius: 8, height: 36, fontWeight: 700, fontSize: 14 }}>
                  继续面试
                </Button>
                <Button danger icon={<CheckCircleOutlined />} onClick={(e) => { e.stopPropagation(); handleEnd() }} style={{ borderRadius: 8, height: 36, fontWeight: 700, fontSize: 14 }}>
                  结束面试
                </Button>
              </>
            )}
            <span style={{
              fontSize: 12, color: colors.textTertiary,
              transition: 'transform 0.2s',
              transform: interviewInfoExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              display: 'inline-block',
            }}>
              ▼
            </span>
          </div>
        </div>

        {interviewInfoExpanded && (
          <div style={{
            padding: '10px 24px 20px',
            borderTop: `1px solid ${colors.border}`,
            animation: 'fadeIn 0.2s ease',
          }}>
            <Steps
              current={getStatusStep()}
              items={[
                { title: '待面试', description: '准备阶段' },
                { title: '面试中', description: '进行中' },
                { title: '已完成', description: '已结束' },
              ]}
              style={{ marginBottom: 20 }}
            />

            <Descriptions column={3} bordered style={{ borderColor: colors.border }} labelStyle={{ fontWeight: 600, fontSize: 14, color: colors.textPrimary }}>
              <Descriptions.Item label="候选人">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: colors.primaryBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <UserOutlined style={{ fontSize: 14, color: colors.primary }} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: colors.textPrimary }}>{interview.candidate_name}</div>
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="面试官">
                <span style={{ fontSize: 14, color: colors.textPrimary }}>{interview.interviewer}</span>
              </Descriptions.Item>
              <Descriptions.Item label="面试日期">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: colors.textSecondary }}>
                  <CalendarOutlined style={{ fontSize: 12, color: colors.textTertiary }} />
                  {formatDate(interview.interview_date)}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="目标职级">
                <Tag style={{
                  borderRadius: 6, fontSize: 12, padding: '2px 8px', margin: 0,
                  background: '#f9f0ff14', color: '#722ed1', border: '1px solid #722ed130', fontWeight: 600,
                }}>
                  {interview.target_level}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="职位描述(JD)">
                {interview.jd_id ? (
                  <a onClick={handleViewJDContent} style={{ color: colors.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Tag style={{
                      borderRadius: 4, fontSize: 12, margin: 0,
                      background: colors.primaryBg, color: colors.primary, border: 'none',
                    }}>
                      {interview.jd_id}
                    </Tag>
                    <EyeOutlined style={{ fontSize: 12 }} />
                  </a>
                ) : <span style={{ fontSize: 12, color: colors.textTertiary }}>-</span>}
              </Descriptions.Item>
              <Descriptions.Item label="题库/难度">
                {interview.difficulty_levels && interview.difficulty_levels.length > 0 ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {interview.difficulty_levels.map((level: string) => {
                      const normalizedLevel = level.replace(/-.*$/, '').replace(/^L(\d)/, 'L$1')
                      const conf = difficultyConfig[normalizedLevel] || { label: level, color: colors.textTertiary, bgColor: colors.surfaceHover }
                      return (
                        <Tag key={level} style={{
                          borderRadius: 4, fontSize: 11, padding: '0 6px', margin: 0,
                          background: conf.bgColor, color: conf.color, border: 'none',
                        }}>
                          {level}
                        </Tag>
                      )
                    })}
                  </div>
                ) : <span style={{ fontSize: 12, color: colors.textTertiary }}>-</span>}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {(() => {
                  const conf = statusConfig[interview.status] || { label: interview.status, color: colors.textTertiary, bgColor: colors.surfaceHover }
                  return (
                    <Tag style={{
                      borderRadius: 6, fontSize: 12, padding: '2px 10px', margin: 0,
                      background: conf.bgColor, color: conf.color, border: `1px solid ${conf.color}30`,
                      fontWeight: 600,
                    }}>
                      {conf.label}
                    </Tag>
                  )
                })()}
              </Descriptions.Item>
              {interview.duration_minutes && (
                <Descriptions.Item label="面试时长">{interview.duration_minutes}分钟</Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
      </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', padding: '0 24px 24px 24px' }}>
      <div style={{
        background: colors.surface,
        borderRadius: 14,
        border: `1px solid ${colors.border}`,
        overflow: 'hidden',
        boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <Tabs
          className="tabs-flex-layout"
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
          style={{ padding: '0 20px 20px', height: '100%', display: 'flex', flexDirection: 'column' }}
          items={[
            {
              key: 'resume',
              label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileTextOutlined style={{ fontSize: 14 }} />
                  简历
                </span>
              ),
              children: interview.resume ? (
                <div style={{ display: 'flex', gap: 16, height: '100%' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileTextOutlined style={{ color: colors.primary, fontSize: 16 }} />
                        <span style={{ fontWeight: 600, fontSize: 15, color: colors.textPrimary }}>简历详情</span>
                      </div>
                      <Button icon={<UploadOutlined />} size="small" onClick={() => setResumeModalVisible(true)} style={{ borderRadius: 6 }} disabled={isCompleted}>
  重新上传
</Button>
                    </div>
                    <div style={{
                      background: colors.surfaceHover,
                      padding: 16,
                      borderRadius: 8,
                      flex: 1,
                      overflowY: 'auto',
                      border: `1px solid ${colors.border}`
                    }}>
                      <pre style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        fontFamily: 'inherit',
                        lineHeight: 1.8,
                        color: colors.textPrimary,
                        fontSize: 13
                      }}>
                        {interview.resume.content || '暂无简历内容'}
                      </pre>
                    </div>
                  </div>
                  
                  {/* 右侧特征标签 */}
                  <div style={{ width: 380, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TagOutlined style={{ color: colors.primary, fontSize: 16 }} />
                        <span style={{ fontWeight: 600, fontSize: 15, color: colors.textPrimary }}>特征标签</span>
                        {candidateTags.length > 0 && (
                          <Tag style={{ borderRadius: 12, background: colors.primaryBg, color: colors.primary, border: 'none', margin: 0, fontSize: 11 }}>
                            {candidateTags.reduce((sum, t) => sum + t.tags.length, 0)}
                          </Tag>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {candidateTags.length > 0 && (
                          <Button icon={<EditOutlined />} size="small" onClick={() => setEditingTagIndex(editingTagIndex === null ? -1 : null)} style={{ borderRadius: 6 }} disabled={isCompleted}>
                            {editingTagIndex !== null ? '完成' : '编辑'}
                          </Button>
                        )}
                        <Button icon={generatingTags ? <RobotOutlined spin /> : <RobotOutlined />} disabled={generatingTags || isCompleted} onClick={async () => {
                          if (!interview?.resume) { message.error('请先上传简历'); return }
                          setGeneratingTags(true)
                          try {
                            const tags = await generateCandidateTags(interviewId!)
                            setCandidateTags(tags)
                            setEditingTagIndex(null)
                            message.success('标签生成完成')
                          } catch (error: any) { message.error(error.message || '生成标签失败') }
                          finally { setGeneratingTags(false) }
                        }} style={{ borderRadius: 6 }}
                          size="small">
                          {candidateTags.length > 0 ? '重新生成' : '生成标签'}
                        </Button>
                      </div>
                    </div>
                    
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                      {candidateTags.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {candidateTags.map((tagGroup, gIndex) => (
                            <div key={gIndex} style={{
                              background: colors.surfaceHover,
                              borderRadius: 10,
                              padding: '10px 14px',
                              border: `1px solid ${colors.border}`,
                            }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: colors.textPrimary, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {getCategoryIcon(tagGroup.category)}
                                  <span style={{ color: getCategoryColor(tagGroup.category) }}>{tagGroup.category}</span>
                                </div>
                                {editingTagIndex !== null && (
                                  <Button type="link" danger size="small" icon={<DeleteOutlined />} disabled={isCompleted} onClick={() => {
                                    const newTags = candidateTags.filter((_, i) => i !== gIndex)
                                    setCandidateTags(newTags)
                                    void saveCandidateTags(interviewId!, newTags)
                                  }}>
                                    删除大类
                                  </Button>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {tagGroup.tags.map((tag, tIndex) => (
                                  editingTagIndex !== null ? (
                                    <Tag key={tIndex} closable onClose={() => {
                                      const newTags = [...candidateTags]
                                      newTags[gIndex] = { ...newTags[gIndex], tags: newTags[gIndex].tags.filter((_, i) => i !== tIndex) }
                                      setCandidateTags(newTags)
                                      void saveCandidateTags(interviewId!, newTags)
                                    }} style={{ borderRadius: 6, background: `${getCategoryColor(tagGroup.category)}15`, color: getCategoryColor(tagGroup.category), border: 'none', margin: 0, fontSize: 12 }}>
                                      {tag}
                                    </Tag>
                                  ) : (
                                    <Tag key={tIndex} style={{ borderRadius: 6, background: `${getCategoryColor(tagGroup.category)}15`, color: getCategoryColor(tagGroup.category), border: 'none', margin: 0, fontSize: 12 }}>
                                      {tag}
                                    </Tag>
                                  )
                                ))}
                                {editingTagIndex !== null && (
                                  <Input key={tagInputKey} size="small" placeholder="添加小标签" style={{ width: 90, borderRadius: 6 }} onPressEnter={(e) => {
                                    const input = e.target as HTMLInputElement
                                    const value = input.value.trim()
                                    if (!value) return
                                    const newTags = [...candidateTags]
                                    newTags[gIndex] = { ...newTags[gIndex], tags: [...newTags[gIndex].tags, value] }
                                    setCandidateTags(newTags)
                                    void saveCandidateTags(interviewId!, newTags)
                                    setTagInputKey(prev => prev + 1)
                                  }} />
                                )}
                              </div>
                            </div>
                          ))}
                          {editingTagIndex !== null && (
                            <div style={{
                              background: colors.surfaceHover,
                              borderRadius: 10,
                              padding: '10px 14px',
                              border: `1px dashed ${colors.primary}`,
                            }}>
                              <Input key={categoryInputKey} size="small" placeholder="输入新大类名称，按回车添加" style={{ borderRadius: 6, width: '100%' }} onPressEnter={(e) => {
                                const input = e.target as HTMLInputElement
                                const value = input.value.trim()
                                if (!value) return
                                const newTags = [...candidateTags, { category: value, tags: [] }]
                                setCandidateTags(newTags)
                                void saveCandidateTags(interviewId!, newTags)
                                setCategoryInputKey(prev => prev + 1)
                              }} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: 40, background: colors.surfaceHover, borderRadius: 10, border: `1px dashed ${colors.border}`, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div>
                            <RobotOutlined style={{ fontSize: 32, color: colors.textTertiary, marginBottom: 12, display: 'block' }} />
                            <p style={{ color: colors.textTertiary, fontSize: 13 }}>
                              AI 将基于简历和岗位要求自动生成候选人特征标签
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ color: colors.textTertiary, marginBottom: 16 }}>暂无简历</p>
                  <Button type="primary" icon={<UploadOutlined />} onClick={() => setResumeModalVisible(true)} disabled={isCompleted}>
                    上传简历
                  </Button>
                </div>
              ),
            },
            {
              key: 'questions',
              label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RobotOutlined style={{ fontSize: 14 }} />
                  面试问题
                </span>
              ),
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

                  {interview.questions && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '10px 16px', background: colors.primaryBg, borderRadius: 8, border: `1px solid ${colors.primary}20` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 20, fontWeight: 700, color: colors.primary }}>{interview.questions.total_questions}</span>
                          <span style={{ fontSize: 13, color: colors.textSecondary }}>道题目 · AI生成 {interview.questions.ai_generated || 0} 道</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Button 
                            icon={<RobotOutlined />} 
                            size="small"
                            disabled={isCompleted}
                            onClick={() => {
                              loadDifficultyFromInterview(interview)
                              setSelectedTags({})
                              setQuestionModalVisible(true)
                            }}
                            style={{ borderRadius: 6 }}
                          >
                            继续生成问题
                          </Button>
                          <Button 
                            danger
                            icon={<DeleteOutlined />} 
                            size="small"
                            disabled={isCompleted}
                            onClick={() => setDeleteAllQuestionsVisible(true)}
                            style={{ borderRadius: 6 }}
                          >
                            清空
                          </Button>
                        </div>
                      </div>
                      <div style={{ flex: 1, overflowY: 'auto' }}>
                      {(editedQuestions.length > 0 ? editedQuestions : sortedQuestions(interview.questions.questions || [])).map((q, index) => (
                        <Card key={index} size="small" style={{ marginBottom: 12, background: colors.surface, borderColor: colors.border }} extra={
                          <Space>
                            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => setEditingQuestionIndex(index)} disabled={isCompleted}>编辑</Button>
                            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={isCompleted} onClick={() => {
                              const cur = editedQuestions.length > 0 ? [...editedQuestions] : sortedQuestions(interview.questions?.questions || [])
                              setEditedQuestions(cur.filter((_, i) => i !== index))
                              message.success('题目已删除')
                            }}>删除</Button>
                          </Space>
                        } title={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>Q{index + 1}</span>
                            {q.category && <Tag color="geekblue">{q.category}</Tag>}
                            {q.difficulty && <Tag color={
                              q.difficulty === 'L1-初级' ? 'green' :
                              q.difficulty === 'L2-中级' ? 'blue' :
                              q.difficulty === 'L3-高级' ? 'orange' :
                              q.difficulty === 'L4-专家' ? 'red' :
                              q.difficulty === 'L5-大神' ? 'purple' : 'default'
                            }>{q.difficulty}</Tag>}
                          </div>
                        }>
                          {editingQuestionIndex === index ? (
                            <div>
                              <Input.TextArea value={q.question} onChange={(e) => {
                                const cur = editedQuestions.length > 0 ? [...editedQuestions] : sortedQuestions(interview.questions?.questions || [])
                                cur[index] = { ...cur[index], question: e.target.value }
                                setEditedQuestions(cur)
                              }} rows={3} style={{ marginBottom: 8 }} placeholder="问题内容" />
                              <Input.TextArea value={q.answer} onChange={(e) => {
                                const cur = editedQuestions.length > 0 ? [...editedQuestions] : sortedQuestions(interview.questions?.questions || [])
                                cur[index] = { ...cur[index], answer: e.target.value }
                                setEditedQuestions(cur)
                              }} rows={4} style={{ marginBottom: 8 }} placeholder="参考答案" />
                              <Space>
                                <Button type="primary" size="small" onClick={() => setEditingQuestionIndex(null)}>完成</Button>
                                <Button size="small" onClick={() => setEditingQuestionIndex(null)}>取消</Button>
                              </Space>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontWeight: 500, color: colors.textPrimary, marginBottom: 4 }}>{q.question}</div>
                              {q.answer && <div style={{ color: colors.textSecondary, fontSize: 13 }}>参考答案: {q.answer}</div>}
                            </div>
                          )}
                        </Card>
                      ))}
                      </div>
                    </div>
                  )}

                  {!generating && !interview.questions && (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                      <div style={{ marginBottom: 24, padding: 32, background: colors.surfaceHover, borderRadius: 12, border: `1px dashed ${colors.border}` }}>
                        <RobotOutlined style={{ fontSize: 48, color: colors.primary, marginBottom: 16, display: 'block' }} />
                        <p style={{ color: colors.textPrimary, fontSize: 16, fontWeight: 500, marginBottom: 8 }}>AI 智能出题系统</p>
                        <p style={{ color: colors.textTertiary, fontSize: 13, maxWidth: 400, margin: '0 auto' }}>基于简历分析、岗位需求和难度分布，智能生成高质量面试题</p>
                      </div>
                      <Button type="primary" size="large" icon={<RobotOutlined />} disabled={isCompleted} onClick={() => {
                        loadDifficultyFromInterview(interview)
                        setSelectedTags({})
                        setQuestionModalVisible(true)
                      }}>
                        开始生成问题清单
                      </Button>
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'interview_result',
              label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircleOutlined style={{ fontSize: 14 }} />
                  面试结果
                </span>
              ),
              children: (
                <div style={{ height: '100%', overflowY: 'auto' }}>
                  {interview.questions && (interview.answers?.answers || []).filter((a: any) => a.answer_content || a.score).length > 0 ? (
                    <div>
                      {(() => {
                        const questions = interview.questions?.questions || []
                        const answersData = interview.answers?.answers || []
                        let totalScore = 0
                        let scoredCount = 0
                        let answeredCount = 0
                        questions.forEach((q: any, index: number) => {
                          const questionId = q.id || `Q${index + 1}`
                          const ans = answersData.find((a: any) => a.question_id === questionId)
                          const candidateResponse = ans?.answer_content || ''
                          const humanScore = ans?.score ?? 0
                          const aiScore = (aiScores[q.id] || ans?.ai_score) ?? 0
                          if (!candidateResponse && !humanScore && !aiScore) return
                          answeredCount++
                          const finalScore = humanScore > 0 && aiScore > 0 ? (humanScore + aiScore) / 2 : (humanScore > 0 ? humanScore : aiScore)
                          if (finalScore > 0) {
                            totalScore += finalScore
                            scoredCount++
                          }
                        })
                        const candidateAvg = scoredCount > 0 ? totalScore / scoredCount : 0
                        const ratingScores = [interviewerRatings.communication, interviewerRatings.project, interviewerRatings.potential, interviewerRatings.values].filter(v => v > 0)
                        const ratingAvg = ratingScores.length > 0 ? ratingScores.reduce((a, b) => a + b, 0) / ratingScores.length : 0
                        const comprehensiveScore = candidateAvg + candidateBonus + ratingAvg
                        const hasAnyRating = ratingScores.length > 0
                        const hasCandidateScore = scoredCount > 0

                        return (
                          <div>
                            <div style={{ display: 'flex', gap: 24, alignItems: 'stretch' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  background: colors.surface,
                                  borderRadius: 8,
                                  borderTop: `1px solid ${colors.border}`,
                                  borderRight: `1px solid ${colors.border}`,
                                  borderBottom: `1px solid ${colors.border}`,
                                  borderLeft: `3px solid ${colors.primary}`,
                                  padding: '20px 24px',
                                  height: '100%',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <span style={{ fontWeight: 600, fontSize: 15, color: colors.textPrimary }}>候选人回答情况</span>
                                    <Button icon={Object.values(aiScoring).some(v => v) ? <RobotOutlined spin /> : <RobotOutlined />} size="small" onClick={handleAiScoreAll} disabled={Object.values(aiScoring).some(v => v)} style={{ borderRadius: 6 }}>
                                      AI智能评分
                                    </Button>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                      <span style={{ fontSize: 32, fontWeight: 700, color: colors.primary, lineHeight: 1 }}>
                                        {hasCandidateScore ? (Number.isInteger(candidateAvg + candidateBonus) ? (candidateAvg + candidateBonus) : (candidateAvg + candidateBonus).toFixed(1)) : '-'}
                                      </span>
                                      <span style={{ fontSize: 14, color: colors.textTertiary }}>/ 5</span>
                                    </div>
                                    {hasCandidateScore && candidateBonus > 0 && (
                                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                                        <span style={{ fontSize: 12, color: colors.textTertiary }}>系统得分 {candidateAvg.toFixed(1)}</span>
                                        <span style={{ fontSize: 16, fontWeight: 600, color: '#faad14' }}>+{candidateBonus.toFixed(1)}</span>
                                      </div>
                                    )}
                                  </div>

                                  <div style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 8 }}>
                                    已回答 {answeredCount} / {questions.length} 题{scoredCount > 0 ? ` · 已评分 ${scoredCount} 题` : ''}
                                  </div>

                                  {hasCandidateScore && (
                                    <div style={{ marginBottom: 12 }}>
                                      <div
                                        style={{
                                          height: 16,
                                          borderRadius: 8,
                                          background: colors.surfaceHover,
                                          position: 'relative',
                                          overflow: 'hidden',
                                          cursor: interview?.status === 'pending' ? 'default' : 'pointer',
                                        }}
                                        onMouseDown={(e) => {
                                          if (interview?.status === 'pending') return
                                          if (interview?.assessment?.hiring_recommendation) {
                                            e.preventDefault()
                                            setClearAssessCallback(() => () => {})
                                            setClearAssessModalVisible(true)
                                            return
                                          }
                                          const bar = e.currentTarget
                                          const calcBonusFromPosition = (clientX: number) => {
                                            const rect = bar.getBoundingClientRect()
                                            const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
                                            const totalScore = ratio * 5
                                            const bonus = Math.round((totalScore - candidateAvg) * 10) / 10
                                            return Math.max(0, Math.min(Math.round((5 - candidateAvg) * 10) / 10, bonus))
                                          }
                                          const bonus = calcBonusFromPosition(e.clientX)
                                          setCandidateBonus(bonus)
                                          const handleMouseMove = (e: MouseEvent) => {
                                            const bonus = calcBonusFromPosition(e.clientX)
                                            setCandidateBonus(bonus)
                                          }
                                          const handleMouseUp = (e: MouseEvent) => {
                                            document.removeEventListener('mousemove', handleMouseMove)
                                            document.removeEventListener('mouseup', handleMouseUp)
                                            const finalBonus = calcBonusFromPosition(e.clientX)
                                            handleCandidateBonusChange(finalBonus)
                                          }
                                          document.addEventListener('mousemove', handleMouseMove)
                                          document.addEventListener('mouseup', handleMouseUp)
                                        }}
                                      >
                                        <div style={{
                                          position: 'absolute',
                                          left: 0,
                                          top: 0,
                                          height: '100%',
                                          background: colors.primary,
                                          borderRadius: '8px 0 0 8px',
                                          width: `${Math.ceil((candidateAvg / 5) * 100)}%`,
                                          transition: 'width 0.5s ease',
                                        }} />
                                        <div style={{
                                          position: 'absolute',
                                          left: `${Math.ceil((candidateAvg / 5) * 100)}%`,
                                          top: 0,
                                          height: '100%',
                                          background: '#faad14',
                                          borderRadius: '0 8px 8px 0',
                                          width: `${(candidateBonus / 5) * 100}%`,
                                          // width: `calc(100% - ${(candidateAvg / 5) * 100}%)`,
                                          transition: 'width 0.5s ease',
                                        }} />
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                          <div style={{ width: 8, height: 8, borderRadius: 2, background: colors.primary }} />
                                          <span style={{ fontSize: 12, color: colors.textTertiary }}>系统得分</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                          <div style={{ width: 8, height: 8, borderRadius: 2, background: '#faad14' }} />
                                          <span style={{ fontSize: 12, color: colors.textTertiary }}>手动加分</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  <Button
                                    type="link"
                                    size="small"
                                    onClick={() => setCandidateDetailExpanded(!candidateDetailExpanded)}
                                    style={{ padding: 0, height: 'auto', color: colors.primary }}
                                  >
                                    {candidateDetailExpanded ? '收起详情' : '查看详情'}
                                  </Button>

                                  {candidateDetailExpanded && (
                                    <div style={{ marginTop: 12, borderTop: `1px solid ${colors.border}`, paddingTop: 12, maxHeight: 520, overflowY: 'auto' }}>
                                      {questions.map((q: any, index: number) => {
                                        const questionId = q.id || `Q${index + 1}`
                                        const ans = answersData.find((a: any) => a.question_id === questionId)
                                        const candidateResponse = ans?.answer_content || ''
                                        const humanScore = ans?.score ?? 0
                                        const aiScore = (aiScores[q.id] || ans?.ai_score) ?? 0
                                        const isScoring = aiScoring[q.id] || false
                                        if (!candidateResponse && !humanScore && !aiScore) return null
                                        const diffConf = getDifficultyConfig(q.difficulty || '')
                                        const isExpanded = expandedResults[q.id] || false
                                        const finalScore = humanScore > 0 && aiScore > 0 ? (humanScore + aiScore) / 2 : (humanScore > 0 ? humanScore : aiScore)
                                        const displayScore = finalScore > 0 ? (Number.isInteger(finalScore) ? finalScore : finalScore.toFixed(1)) : '-'
                                        return (
                                          <div key={index} style={{ marginBottom: 8, padding: '10px 12px', background: colors.surfaceHover, borderRadius: 6 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                                              <span style={{ fontWeight: 500, fontSize: 13, color: colors.textPrimary, flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.question || q.title}</span>
                                              <Tag style={{ borderRadius: 4, fontSize: 11, background: diffConf.bgColor, color: diffConf.color, border: 'none', margin: 0, lineHeight: '18px' }}>{q.difficulty}</Tag>
                                              {(q as any).category && <Tag style={{ borderRadius: 4, fontSize: 11, background: colors.primaryBg, color: colors.primary, border: 'none', margin: 0, lineHeight: '18px' }}>{(q as any).category}</Tag>}
                                              {finalScore > 0 && <Tag style={{ borderRadius: 4, fontSize: 11, background: '#f6ffed', color: '#52c41a', border: 'none', margin: 0, fontWeight: 600, lineHeight: '18px' }}>{displayScore}分</Tag>}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isExpanded ? 8 : 0, flexWrap: 'wrap' }}>
                                              <span style={{ fontSize: 12, color: colors.textTertiary }}>{q.evaluation_dimension || '未知'}</span>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <span style={{ fontSize: 12, color: colors.textTertiary }}>人工</span>
                                                <Rate value={humanScore} disabled style={{ fontSize: 12 }} />
                                              </div>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <span style={{ fontSize: 12, color: colors.textTertiary }}>AI</span>
                                                {isScoring ? <Spin size="small" /> : <Rate value={aiScore} disabled style={{ fontSize: 12 }} />}
                                              </div>
                                            </div>
                                            {isExpanded && (
                                              <>
                                                {q.answer && (
                                                  <div style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 6, padding: '6px 10px', background: colors.surface, borderRadius: 4 }}>
                                                    参考答案：{q.answer}
                                                  </div>
                                                )}
                                                {candidateResponse && (
                                                  <div style={{ padding: '6px 10px', background: colors.surface, borderRadius: 4, marginBottom: 6 }}>
                                                    <div style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 2 }}>候选人回答：</div>
                                                    <div style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 1.6 }}>{candidateResponse}</div>
                                                  </div>
                                                )}
                                              </>
                                            )}
                                            <div style={{ textAlign: 'center', marginTop: 2 }}>
                                              <Button type="link" size="small" onClick={() => setExpandedResults(prev => ({ ...prev, [q.id]: !isExpanded }))} style={{ fontSize: 12 }}>
                                                {isExpanded ? '收起' : '更多'}
                                              </Button>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, flexShrink: 0 }}>
                                <span style={{ fontSize: 20, fontWeight: 300, color: colors.textTertiary }}>+</span>
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  background: colors.surface,
                                  borderRadius: 8,
                                  borderTop: `1px solid ${colors.border}`,
                                  borderRight: `1px solid ${colors.border}`,
                                  borderBottom: `1px solid ${colors.border}`,
                                  borderLeft: '3px solid #722ed1',
                                  padding: '20px 24px',
                                  height: '100%',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                  <span style={{ fontWeight: 600, fontSize: 15, color: colors.textPrimary }}>面试官打分</span>
                                  {hasAnyRating && interview.status !== 'pending' && (
                                    <Button size="small" onClick={handleClearInterviewerRatings} style={{ borderRadius: 6 }}>
                                      清空评分
                                    </Button>
                                  )}
                                </div>

                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 12 }}>
                                    <span style={{ fontSize: 32, fontWeight: 700, color: '#722ed1', lineHeight: 1 }}>
                                      {hasAnyRating ? (Number.isInteger(ratingAvg) ? ratingAvg : ratingAvg.toFixed(1)) : '0'}
                                    </span>
                                    <span style={{ fontSize: 14, color: colors.textTertiary }}>/ 5</span>
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {[
                                      { key: 'communication', label: '沟通能力' },
                                      { key: 'project', label: '项目能力' },
                                      { key: 'potential', label: '潜力' },
                                      { key: 'values', label: '价值观' },
                                    ].map(item => (
                                      <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 13, color: colors.textSecondary, width: 56, flexShrink: 0 }}>{item.label}</span>
                                        <Rate
                                          value={(interviewerRatings as any)[item.key]}
                                          onChange={(value) => handleInterviewerRatingChange(item.key, value)}
                                          style={{ fontSize: 16 }}
                                          disabled={interview.status === 'pending'}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                              <span style={{ fontSize: 20, fontWeight: 300, color: colors.textTertiary }}>=</span>
                            </div>

                            <div style={{
                              background: colors.surface,
                              borderRadius: 8,
                              borderTop: `1px solid ${colors.border}`,
                              borderRight: `1px solid ${colors.border}`,
                              borderBottom: `1px solid ${colors.border}`,
                              borderLeft: '3px solid #52c41a',
                              padding: '20px 24px',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <span style={{ fontWeight: 600, fontSize: 15, color: colors.textPrimary }}>面试综合评价</span>
                                {interview.assessment?.hiring_recommendation && (
                                  <Button size="small" icon={assessing ? <RobotOutlined spin /> : <RobotOutlined />} onClick={handleAiAssess} disabled={assessing} style={{ borderRadius: 6 }}>
                                    重新生成
                                  </Button>
                                )}
                              </div>

                              {hasCandidateScore && hasAnyRating ? (
                                interview.assessment?.hiring_recommendation ? (
                                  <div>
                                  <div style={{ display: 'flex', alignItems: 'stretch', gap: 16 }}>
                                  <div>
                                    <div style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 2 }}>综合得分</div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                                      <span style={{ fontSize: 36, fontWeight: 700, color: '#52c41a', lineHeight: 1 }}>
                                        {interview.assessment?.comprehensive_score ?? (Number.isInteger(comprehensiveScore) ? comprehensiveScore : comprehensiveScore.toFixed(1))}
                                      </span>
                                      <span style={{ fontSize: 14, color: colors.textTertiary }}>/ 10</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                      {interview.assessment?.recommended_level && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                          <span style={{ fontSize: 12, color: colors.textTertiary }}>推荐职级</span>
                                          <Tag style={{ borderRadius: 4, background: colors.primaryBg, color: colors.primary, border: 'none', fontWeight: 600 }}>{interview.assessment.recommended_level}</Tag>
                                        </div>
                                      )}
                                      {interview.assessment?.hiring_recommendation && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                          <span style={{ fontSize: 12, color: colors.textTertiary }}>录用建议</span>
                                          <Tag style={{
                                            borderRadius: 4,
                                            background: interview.assessment.hiring_recommendation === '通过' ? '#f6ffed' :
                                              interview.assessment.hiring_recommendation === '待定' ? '#fffbe6' : '#fff1f0',
                                            color: interview.assessment.hiring_recommendation === '通过' ? '#52c41a' :
                                              interview.assessment.hiring_recommendation === '待定' ? '#faad14' : '#ff4d4f',
                                            border: 'none',
                                            fontWeight: 600,
                                          }}>
                                            {interview.assessment.hiring_recommendation}
                                          </Tag>
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 6 }}>
                                      <span style={{ fontWeight: 600, color: colors.primary }}>{hasCandidateScore ? (Number.isInteger(candidateAvg) ? candidateAvg : candidateAvg.toFixed(1)) : '-'}</span> 回答
                                      {candidateBonus > 0 && (
                                        <>
                                          <span style={{ margin: '0 4px' }}>+</span>
                                          <span style={{ fontWeight: 600, color: '#faad14' }}>{candidateBonus.toFixed(1)}</span> 加分
                                        </>
                                      )}
                                      <span style={{ margin: '0 4px' }}>+</span>
                                      <span style={{ fontWeight: 600, color: '#722ed1' }}>{hasAnyRating ? (Number.isInteger(ratingAvg) ? ratingAvg : ratingAvg.toFixed(1)) : '-'}</span> 打分
                                    </div>
                                  </div>
                                  {interview.assessment?.hiring_reason && (
                                    <div style={{ flex: 1, padding: '10px 12px', background: colors.surfaceHover, borderRadius: 6 }}>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: colors.textTertiary, marginBottom: 4 }}>综合评价</div>
                                      <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.6 }}>
                                        {(interview.assessment.hiring_reason as string)
                                          .replace(/(?<=\S) (?=\S+：)/g, '\n')
                                          .split(/\n/)
                                          .filter(Boolean)
                                          .map((line: string, i: number) => (
                                            <div key={i}>{line}</div>
                                          ))
                                        }
                                      </div>
                                    </div>
                                  )}
                                </div>
                                  </div>
                                ) : (
                                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                    <Button
                                      type="primary"
                                      icon={assessing ? <RobotOutlined spin /> : <RobotOutlined />}
                                      size="large"
                                      disabled={assessing}
                                      style={{ borderRadius: 8, height: 40, fontSize: 16, paddingInline: 20 }}
                                      onClick={handleAiAssess}
                                    >
                                      AI智能评价
                                    </Button>
                                    <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 8 }}>
                                      {assessing ? 'AI正在分析评价中，请稍候...' : '基于回答评分和面试官打分，AI将自动生成综合评价'}
                                    </div>
                                  </div>
                                )
                              ) : (
                                <div style={{ textAlign: 'center', padding: 12 }}>
                                  <span style={{ fontSize: 13, color: colors.textTertiary }}>
                                    完成回答评分和面试官打分后将自动计算评价结果
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                      <p style={{ color: colors.textTertiary }}>暂无面试回答数据</p>
                    </div>
                  )}
                </div>
              ),
            },
          ].filter(item => {
            const status = interview?.status
            if (status === 'pending' || status === 'in_progress') {
              return item.key === 'resume' || item.key === 'questions'
            }
            return true
          })}
        />
      </div>
      </div>

      {/* 上传简历弹窗 */}
      <Modal
        title="上传简历"
        open={resumeModalVisible}
        onOk={() => resumeForm.submit()}
        onCancel={() => setResumeModalVisible(false)}
        width={600}
      >
        <Form form={resumeForm} layout="vertical" onFinish={handleUploadResume}>
          <Form.Item 
            name="file" 
            label="简历文件" 
            rules={[{ required: true, message: '请选择简历文件' }]}
          >
            <Upload 
              beforeUpload={() => false} 
              maxCount={1}
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
          </Form.Item>
          <p style={{ color: colors.textTertiary, fontSize: 12, marginTop: 8 }}>
            支持格式：PDF、Word（.doc、.docx）
          </p>
          <p style={{ color: colors.textSecondary, fontSize: 12 }}>
            候选人姓名：{interview?.candidate_name}
          </p>
        </Form>
      </Modal>

      {/* AI 生成问题清单弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RobotOutlined style={{ color: colors.primary }} />
            <span>AI 生成问题清单</span>
          </div>
        }
        open={questionModalVisible}
        onCancel={() => {
          setQuestionModalVisible(false)
          setSelectedTags({})
          loadDifficultyFromInterview(interview)
        }}
        onOk={handleGenerateQuestions}
        okText="确认生成"
        cancelText="取消"
        confirmLoading={submittingQuestions}
        width={900}
        centered
      >
        <div style={{ display: 'flex', gap: 0 }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: colors.textPrimary, marginBottom: 8 }}>
              选择标签（必选）
            </div>
            <TagSelector
              candidateTags={candidateTags}
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
                if (value.length === 0) {
                  setDifficultyDistributions({})
                } else if (value.length === 1) {
                  setDifficultyDistributions({ [value[0]]: 100 })
                } else {
                  setDifficultyDistributions({})
                }
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
      </Modal>

      {/* 警告弹窗 */}
      <ConfirmModal
        open={warningModalVisible}
        title="面试警告"
        message="未生成面试题问题清单，是否继续面试？建议先生成问题清单再开始面试。"
        confirmText="继续面试"
        cancelText="取消"
        type="warning"
        onConfirm={async () => {
          try {
            await startInterview(interviewId!)
            message.success('面试已开始')
            setWarningModalVisible(false)
            navigate(`/workspaces/${jobRole}/interviews/${interviewId}/in-progress`)
          } catch (error: any) {
            message.error(error.message || '开始失败')
          }
        }}
        onCancel={() => setWarningModalVisible(false)}
      />

      {/* 全部删除问题清单确认弹窗 */}
      <ConfirmModal
        open={deleteAllQuestionsVisible}
        title="全部删除问题清单"
        message="确定要删除所有问题吗？删除后无法恢复，需要重新生成。"
        confirmText="确认删除"
        type="danger"
        onConfirm={async () => {
          setDeleteAllQuestionsVisible(false)
          setEditedQuestions([])
          // 删除 questions.md 文件
          try {
            const interviewDir = await findInterviewDir(interviewId!)
            if (interviewDir) {
              const { deleteFile } = await import('@/core/filesystem')
              await deleteFile(`${interviewDir}/questions.md`)
            }
          } catch (e) {
            console.warn('删除 questions.md 失败:', e)
          }
          message.success('问题清单已全部删除')
          loadInterview()
        }}
        onCancel={() => setDeleteAllQuestionsVisible(false)}
      />

      {/* 修改评分清空评价确认弹窗 */}
      <ConfirmModal
        open={clearAssessModalVisible}
        title="修改评分确认"
        message="修改评分后，当前面试综合评价将被清空，需要重新生成AI智能评价。是否继续修改？"
        confirmText="继续修改"
        type="warning"
        onConfirm={handleClearAssessmentAndProceed}
        onCancel={() => {
          setClearAssessModalVisible(false)
          setClearAssessCallback(null)
        }}
      />

      {/* 职位描述(JD)内容查看弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileTextOutlined style={{ color: colors.primary }} />
            <span>职位描述(JD)详情</span>
          </div>
        }
        open={jdContentModalVisible}
        onCancel={() => setJdContentModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setJdContentModalVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        {jdLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : (
          <div style={{
            maxHeight: 600,
            overflow: 'auto',
            padding: 16,
            background: colors.surfaceHover,
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            lineHeight: 1.8,
            fontSize: 14,
            color: colors.textPrimary
          }}>
            {jdFullContent || '暂无职位描述(JD)内容'}
          </div>
        )}
      </Modal>

      {/* 流式生成悬浮窗 */}
      {generating && streamContent && (
        <div 
          ref={streamRef}
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            width: 420,
            maxHeight: 350,
            background: colors.surface,
            border: `1px solid ${colors.primary}40`,
            borderRadius: 12,
            padding: 16,
            zIndex: 100,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            overflow: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: colors.primary, fontWeight: 600 }}>
            <RobotOutlined spin />
            正在生成问题...
          </div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontFamily: 'inherit', lineHeight: 1.8, color: colors.textPrimary, fontSize: 13 }}>
            {streamContent}
          </pre>
        </div>
      )}

      {generating && !streamContent && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          background: colors.surface,
          border: `1px solid ${colors.primary}40`,
          borderRadius: 12,
          padding: 20,
          zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          textAlign: 'center',
        }}>
          <RobotOutlined style={{ fontSize: 24, color: colors.primary, marginBottom: 8 }} spin />
          <p style={{ fontSize: 14, fontWeight: 500, color: colors.primary }}>AI 正在思考中...</p>
        </div>
      )}
    </div>
  )
}
