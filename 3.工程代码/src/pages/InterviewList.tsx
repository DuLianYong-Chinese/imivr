import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Table, Button, Modal, Form, Input, Select, DatePicker, message, Tag, Checkbox, Tooltip, Spin } from 'antd'
import { PlusOutlined, ArrowLeftOutlined, DeleteOutlined, EditOutlined, RightOutlined, UserOutlined, CalendarOutlined, EyeOutlined, FileTextOutlined } from '@ant-design/icons'
import type { Interview } from '@/types'
import { listInterviews, createInterview, deleteInterview, updateInterview } from '@/modules/interview'
import { formatDate } from '@/utils/date'
import { listFiles, exists, readFile } from '@/core/filesystem'
import { useThemeStore } from '@/stores/themeStore'
import ConfirmModal from '@/components/ConfirmModal'
import dayjs from 'dayjs'

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

const difficultyOptions = [
  { value: 'L1', label: 'L1 - 初级' },
  { value: 'L2', label: 'L2 - 中级' },
  { value: 'L3', label: 'L3 - 高级' },
  { value: 'L4', label: 'L4 - 专家' },
  { value: 'L5', label: 'L5 - 大神' },
]

interface JDOption {
  value: string
  label: string
  fileName: string
}

export default function InterviewList() {
  const { jobRole } = useParams<{ jobRole: string }>()
  const navigate = useNavigate()
  const { colors } = useThemeStore()
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [deletingInterviewId, setDeletingInterviewId] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [jdOptions, setJdOptions] = useState<JDOption[]>([])
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null)
  const [jdContentModalVisible, setJdContentModalVisible] = useState(false)
  const [jdLoading, setJdLoading] = useState(false)
  const [jdFullContent, setJdFullContent] = useState('')
  const [viewingJdId, setViewingJdId] = useState<string | null>(null)

  useEffect(() => {
    loadInterviews()
    loadJDOptions()
  }, [jobRole])

  const loadJDOptions = async () => {
    if (!jobRole) return
    try {
      const templatesDir = `${jobRole}/templates`
      const dirExists = await exists(templatesDir)
      if (!dirExists) {
        setJdOptions([])
        return
      }
      const files = await listFiles(templatesDir)
      const jdFiles = files.filter((f: string) => {
        const normalizedPath = f.replace(/\\/g, '/')
        const fileName = normalizedPath.split('/').pop() || normalizedPath
        return fileName.startsWith('jd-') && fileName.endsWith('-template.md')
      })
      const options: JDOption[] = jdFiles.map((filePath: string) => {
        const normalizedPath = filePath.replace(/\\/g, '/')
        const fileName = normalizedPath.split('/').pop() || normalizedPath
        const match = fileName.match(/^jd-(.+)-template\.md$/)
        const name = match ? match[1] : fileName
        return { value: name, label: name, fileName }
      })
      setJdOptions(options)
    } catch (error) {
      console.error('加载JD列表失败:', error)
      setJdOptions([])
    }
  }

  const loadInterviews = async () => {
    if (!jobRole) return
    setLoading(true)
    try {
      const data = await listInterviews({ jobRole })
      setInterviews(data)
    } catch (error) {
      message.error('加载面试记录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (values: any) => {
    if (!jobRole) return
    try {
      await createInterview({
        jobRole,
        candidateName: values.candidate_name,
        interviewer: values.interviewer,
        interviewDate: values.interview_date.format('YYYY-MM-DD HH:mm:ss'),
        targetLevel: values.target_level,
        jdId: values.jd_id,
        difficultyLevels: values.difficulty_levels || [],
      })
      message.success('创建成功')
      setModalVisible(false)
      form.resetFields()
      loadInterviews()
    } catch (error: any) {
      message.error(error.message || '创建失败')
    }
  }

  const handleDelete = (interviewId: string) => {
    setDeletingInterviewId(interviewId)
    setDeleteModalVisible(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletingInterviewId) return
    try {
      await deleteInterview(deletingInterviewId)
      message.success('删除成功')
      setDeleteModalVisible(false)
      setDeletingInterviewId(null)
      loadInterviews()
    } catch (error: any) {
      message.error(error.message || '删除失败')
    }
  }

  const handleEdit = (record: Interview) => {
    setEditingInterview(record)
    const difficultyLevels = record.difficulty_levels?.map((level: string) => {
      const match = level.match(/^(L[1-5])/)
      return match ? match[1] : level
    }) || []
    editForm.setFieldsValue({
      candidate_name: record.candidate_name,
      interviewer: record.interviewer,
      interview_date: dayjs(record.interview_date, 'YYYY-MM-DD HH:mm:ss'),
      target_level: record.target_level,
      jd_id: record.jd_id,
      difficulty_levels: difficultyLevels,
    })
    setEditModalVisible(true)
  }

  const handleUpdate = async (values: any) => {
    if (!editingInterview) return
    try {
      await updateInterview({
        interviewId: editingInterview.interview_id,
        interviewer: values.interviewer,
        interviewDate: values.interview_date.format('YYYY-MM-DD HH:mm:ss'),
        targetLevel: values.target_level,
        jdId: values.jd_id,
        difficultyLevels: values.difficulty_levels || [],
      })
      message.success('更新成功')
      setEditModalVisible(false)
      editForm.resetFields()
      setEditingInterview(null)
      loadInterviews()
    } catch (error: any) {
      message.error(error.message || '更新失败')
    }
  }

  const handleViewJDContent = async (jdId: string) => {
    if (!jdId || !jobRole) return
    setViewingJdId(jdId)
    setJdLoading(true)
    setJdFullContent('')
    setJdContentModalVisible(true)
    try {
      const expectedFilename = `jd-${jdId}-template.md`
      try {
        const content = await readFile(`${jobRole}/templates/${expectedFilename}`)
        setJdFullContent(content)
      } catch {
        const templateFiles = await listFiles(`${jobRole}/templates/`)
        const matchingFile = templateFiles.find(f =>
          f.replace(/\\/g, '/').includes('/templates/') && f.replace(/\\/g, '/').endsWith(`jd-${jdId}-template.md`)
        )
        if (matchingFile) {
          const content = await readFile(matchingFile.replace(/\\/g, '/'))
          setJdFullContent(content)
        } else {
          throw new Error('未找到该 JD 配置文件')
        }
      }
    } catch (error: any) {
      message.error(error.message || '读取 JD 配置失败')
      setJdContentModalVisible(false)
    } finally {
      setJdLoading(false)
    }
  }

  const statusCounts = interviews.reduce((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const getDiffConf = (level: string) => {
    const normalized = level.replace(/-.*$/, '').replace(/^L(\d)/, 'L$1')
    return difficultyConfig[normalized] || { label: level, color: colors.textTertiary, bgColor: colors.surfaceHover }
  }

  const columns = [
    {
      title: '候选人',
      dataIndex: 'candidate_name',
      key: 'candidate_name',
      width: 180,
      render: (name: string, record: Interview) => (
        <div
          onClick={() => navigate(`/workspaces/${jobRole}/interviews/${record.interview_id}`)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: colors.primaryBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <UserOutlined style={{ fontSize: 14, color: colors.primary }} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: colors.textPrimary, lineHeight: 1.3 }}>{name}</div>
            <div style={{ fontSize: 12, color: colors.textTertiary }}>{record.interviewer}</div>
          </div>
        </div>
      ),
    },
    {
      title: '日期',
      dataIndex: 'interview_date',
      key: 'interview_date',
      width: 160,
      render: (value: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: colors.textSecondary }}>
          <CalendarOutlined style={{ fontSize: 12, color: colors.textTertiary }} />
          {formatDate(value)}
        </div>
      ),
    },
    {
      title: '职级',
      dataIndex: 'target_level',
      key: 'target_level',
      width: 90,
      render: (level: string) => (
        <Tag style={{
          borderRadius: 6, fontSize: 12, padding: '2px 8px', margin: 0,
          background: '#f9f0ff14', color: '#722ed1', border: '1px solid #722ed130', fontWeight: 600,
        }}>
          {level}
        </Tag>
      ),
    },
    {
      title: '职位描述(JD)',
      dataIndex: 'jd_id',
      key: 'jd_id',
      width: 120,
      render: (jdId: string) => jdId ? (
        <a onClick={() => handleViewJDContent(jdId)} style={{ color: colors.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Tag style={{
            borderRadius: 4, fontSize: 12, margin: 0,
            background: colors.primaryBg, color: colors.primary, border: 'none',
          }}>
            {jdId}
          </Tag>
          <EyeOutlined style={{ fontSize: 12 }} />
        </a>
      ) : <span style={{ fontSize: 12, color: colors.textTertiary }}>-</span>,
    },
    {
      title: '题库/难度',
      dataIndex: 'difficulty_levels',
      key: 'difficulty_levels',
      width: 140,
      render: (levels: string[]) => {
        if (!levels || levels.length === 0) return <span style={{ fontSize: 12, color: colors.textTertiary }}>-</span>
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            {levels.map((level: string) => {
              const conf = getDiffConf(level)
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
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const conf = statusConfig[status] || { label: status, color: colors.textTertiary, bgColor: colors.surfaceHover }
        return (
          <Tag style={{
            borderRadius: 6, fontSize: 12, padding: '2px 10px', margin: 0,
            background: conf.bgColor, color: conf.color, border: `1px solid ${conf.color}30`,
            fontWeight: 600,
          }}>
            {conf.label}
          </Tag>
        )
      },
      sorter: (a: Interview, b: Interview) => {
        const order = { in_progress: 0, pending: 1, completed: 2, cancelled: 3 }
        return (order[a.status as keyof typeof order] || 99) - (order[b.status as keyof typeof order] || 99)
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: Interview) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Button
            type={record.status === 'in_progress' ? 'primary' : 'default'}
            size="small"
            onClick={() => navigate(`/workspaces/${jobRole}/interviews/${record.interview_id}`)}
            style={{ borderRadius: 6, height: 30 }}
            icon={<RightOutlined style={{ fontSize: 12 }} />}
          >
            详情
          </Button>
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              style={{ borderRadius: 6, minWidth: 30, height: 30 }}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.interview_id)}
              style={{ borderRadius: 6, minWidth: 30, height: 30 }}
            />
          </Tooltip>
        </div>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flexShrink: 0, padding: '24px 24px 0 24px' }}>
      <div style={{
        background: colors.surface,
        borderRadius: 14,
        border: `1px solid ${colors.border}`,
        marginBottom: 20,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        height: 77,
      }}>
        <div style={{
          height: 4,
          background: `linear-gradient(90deg, ${colors.primary}, ${colors.primary}60, transparent)`,
        }} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 24px',
          height: 73,
        }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/workspaces/${jobRole}`)} style={{ borderRadius: 8 }} size="small">
            返回
          </Button>
          <div style={{ width: 1, height: 28, background: colors.border }} />
          <span style={{ fontSize: 18, fontWeight: 700, color: colors.textPrimary }}>面试记录</span>
          {interviews.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {Object.entries(statusConfig).map(([key, conf]) => {
                const count = statusCounts[key] || 0
                if (count === 0) return null
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: conf.color }}>{count}</span>
                    <span style={{ color: colors.textTertiary }}>{conf.label}</span>
                  </div>
                )
              })}
              <span style={{ fontSize: 13, color: colors.textTertiary }}>· 共 {interviews.length} 条</span>
            </div>
          )}
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)} style={{ borderRadius: 8, height: 36 }}>
          新建面试
        </Button>
        </div>
      </div>
      </div>

      <div style={{ flex: 1, padding: '0 24px 24px 24px', overflow: 'hidden' }}>
      <div className="table-fixed-pagination" style={{
        background: colors.surface,
        borderRadius: 14,
        border: `1px solid ${colors.border}`,
        overflow: 'hidden',
        boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
        height: '100%',
      }}>
        <Table
          dataSource={interviews}
          rowKey="interview_id"
          loading={loading}
          columns={columns}
          scroll={{ y: 1 }}
          pagination={{ pageSize: 10, showSizeChanger: false, style: { marginRight: 16 } }}
        />
      </div>
      </div>

      <Modal
        title="新建面试"
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => setModalVisible(false)}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="candidate_name"
            label="候选人姓名"
            rules={[{ required: true, message: '请输入候选人姓名' }]}
          >
            <Input placeholder="请输入候选人姓名" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item
            name="interviewer"
            label="面试官"
            rules={[{ required: true, message: '请输入面试官' }]}
          >
            <Input placeholder="请输入面试官" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item
            name="interview_date"
            label="面试日期"
            rules={[{ required: true, message: '请选择面试日期' }]}
          >
            <DatePicker style={{ width: '100%', borderRadius: 8 }} showTime format="YYYY-MM-DD HH:mm:ss" />
          </Form.Item>
          <Form.Item
            name="target_level"
            label="目标职级"
            rules={[{ required: true, message: '请选择目标职级' }]}
          >
            <Select
              placeholder="请选择目标职级"
              options={[
                { value: 'P3', label: 'P3 - 初级' },
                { value: 'P4', label: 'P4 - 初级' },
                { value: 'P5', label: 'P5 - 中级' },
                { value: 'P6', label: 'P6 - 高级' },
                { value: 'P7', label: 'P7 - 专家' },
              ]}
            />
          </Form.Item>
          <Form.Item name="jd_id" label="职位描述(JD)（可选）">
            <Select
              placeholder="请选择职位描述(JD)（可选）"
              allowClear
              options={jdOptions}
              notFoundContent={jdOptions.length === 0 ? '暂无职位描述(JD)，请先在工作空间中创建' : '无匹配结果'}
            />
          </Form.Item>
          <Form.Item
            name="difficulty_levels"
            label="题库/难度"
            rules={[{ required: true, message: '请至少选择一个题库/难度' }]}
          >
            <Checkbox.Group options={difficultyOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑面试"
        open={editModalVisible}
        onOk={() => editForm.submit()}
        onCancel={() => {
          setEditModalVisible(false)
          editForm.resetFields()
          setEditingInterview(null)
        }}
        width={600}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
          <Form.Item name="candidate_name" label="候选人姓名">
            <Input disabled style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="interviewer" label="面试官" rules={[{ required: true, message: '请输入面试官' }]}>
            <Input placeholder="请输入面试官" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="interview_date" label="面试日期" rules={[{ required: true, message: '请选择面试日期' }]}>
            <DatePicker style={{ width: '100%', borderRadius: 8 }} showTime format="YYYY-MM-DD HH:mm:ss" />
          </Form.Item>
          <Form.Item name="target_level" label="目标职级" rules={[{ required: true, message: '请选择目标职级' }]}>
            <Select
              placeholder="请选择目标职级"
              options={[
                { value: 'P3', label: 'P3 - 初级' },
                { value: 'P4', label: 'P4 - 初级' },
                { value: 'P5', label: 'P5 - 中级' },
                { value: 'P6', label: 'P6 - 高级' },
                { value: 'P7', label: 'P7 - 专家' },
              ]}
            />
          </Form.Item>
          <Form.Item name="jd_id" label="职位描述(JD)（可选）">
            <Select
              placeholder="请选择职位描述(JD)（可选）"
              allowClear
              options={jdOptions}
              notFoundContent={jdOptions.length === 0 ? '暂无职位描述(JD)，请先在工作空间中创建' : '无匹配结果'}
            />
          </Form.Item>
          <Form.Item name="difficulty_levels" label="题库/难度" rules={[{ required: true, message: '请至少选择一个题库/难度' }]}>
            <Checkbox.Group options={difficultyOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <ConfirmModal
        open={deleteModalVisible}
        title="确认删除"
        message="删除后无法恢复，确定要删除该面试记录吗？相关的简历、问题清单等数据也将一并删除。"
        confirmText="确定删除"
        type="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteModalVisible(false)
          setDeletingInterviewId(null)
        }}
      />

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileTextOutlined style={{ color: colors.primary }} />
            <span>职位描述(JD)详情 - {viewingJdId}</span>
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
    </div>
  )
}