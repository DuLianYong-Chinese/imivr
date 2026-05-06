import { useState, useEffect, useRef } from 'react'
import { Button, Space, Tag, Modal, Form, Input, Select, AutoComplete, App, Spin } from 'antd'
import { PlusOutlined, DeleteOutlined, RightOutlined, CodeOutlined, FormatPainterOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { WorkspaceInfo, CreateWorkspaceInput, Dimension } from '@/types'
import { listWorkspaces, createWorkspace, deleteWorkspace } from '@/modules/workspace'
import { formatDate } from '@/utils/date'
import { useThemeStore } from '@/stores/themeStore'
import { getConfig, saveConfig } from '@/core/filesystem'
import ConfirmModal from '@/components/ConfirmModal'

const presetWorkspaces = [
  { value: 'frontend_dev', label: 'frontend_dev - 前端开发工程师', name: '前端开发工程师', category: '技术研发', icon: '💻' },
  { value: 'backend_dev', label: 'backend_dev - 后端开发工程师', name: '后端开发工程师', category: '技术研发', icon: '🔧' },
  { value: 'algorithm_eng', label: 'algorithm_eng - 算法工程师', name: '算法工程师', category: '技术研发', icon: '🧠' },
  { value: 'test_eng', label: 'test_eng - 测试工程师', name: '测试工程师', category: '技术研发', icon: '🔍' },
  { value: 'data_dev', label: 'data_dev - 数据开发工程师', name: '数据开发工程师', category: '技术研发', icon: '📊' },
  { value: 'product_mgr', label: 'product_mgr - 产品经理', name: '产品经理', category: '产品设计', icon: '📱' },
  { value: 'ui_designer', label: 'ui_designer - UI设计师', name: 'UI设计师', category: '产品设计', icon: '🎨' },
]

const defaultDimensions: Dimension[] = [
  { name: '基础知识', weight: 0.2, description: '基础理论和概念' },
  { name: '实践能力', weight: 0.25, description: '实际操作和解决问题' },
  { name: '系统设计', weight: 0.2, description: '架构和系统设计能力' },
  { name: '项目经验', weight: 0.2, description: '项目经历和贡献' },
  { name: '沟通协作', weight: 0.15, description: '团队协作和沟通能力' },
]

export default function WorkspaceList() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { colors } = useThemeStore()
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const deletingJobRoleRef = useRef<string | null>(null)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    initializeAndLoad()
  }, [])

  const initializeAndLoad = async () => {
    setLoading(true)
    try {
      const config = await getConfig()
      if (!config.workspace_initialized) {
        const existing = await listWorkspaces()
        const existingRoles = existing.map(w => w.job_role)
        const toCreate = presetWorkspaces.filter(p => !existingRoles.includes(p.value))
        if (toCreate.length > 0) {
          setInitializing(true)
          for (const preset of toCreate) {
            try {
              await createWorkspace({
                job_role: preset.value,
                workspace_name: preset.name,
                category: preset.category as '技术研发' | '产品设计',
                target_levels: [],
                evaluation_dimensions: defaultDimensions,
              })
            } catch (error: any) {
              if (!error?.message?.includes('already exists')) {
                console.warn(`初始化工作空间 ${preset.value} 失败:`, error?.message)
              }
            }
          }
          setInitializing(false)
        }
        await saveConfig({ ...config, workspace_initialized: true })
      }
      const data = await listWorkspaces()
      setWorkspaces(data)
    } catch (error) {
      console.error('加载工作空间失败:', error)
      message.error('加载工作空间失败')
    } finally {
      setLoading(false)
    }
  }

  const loadWorkspaces = async () => {
    setLoading(true)
    try {
      const data = await listWorkspaces()
      setWorkspaces(data)
    } catch (error) {
      console.error('加载工作空间失败:', error)
      message.error('加载工作空间失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (values: any) => {
    try {
      await createWorkspace({
        job_role: values.job_role,
        workspace_name: values.workspace_name,
        category: values.category,
        target_levels: [],
        evaluation_dimensions: defaultDimensions,
      })
      message.success('创建成功')
      setModalVisible(false)
      form.resetFields()
      loadWorkspaces()
    } catch (error: any) {
      if (error?.message?.includes('already exists')) {
        message.error('工作空间已存在')
      } else {
        message.error(error.message || '创建失败')
      }
    }
  }

  const handleDelete = (jobRole: string) => {
    console.log('[WorkspaceList] handleDelete 被调用, jobRole:', jobRole)
    deletingJobRoleRef.current = jobRole
    setDeleteModalVisible(true)
  }

  const handleConfirmDelete = async () => {
    const jobRole = deletingJobRoleRef.current
    console.log('[WorkspaceList] handleConfirmDelete 被调用, jobRole:', jobRole)
    if (!jobRole) {
      console.warn('[WorkspaceList] jobRole 为空, 跳过删除')
      return
    }
    setDeleteLoading(true)
    try {
      console.log('[WorkspaceList] 开始调用 deleteWorkspace, jobRole:', jobRole, 'force: true')
      await deleteWorkspace(jobRole, true)
      console.log('[WorkspaceList] deleteWorkspace 调用成功, jobRole:', jobRole)
      message.success('删除成功')
      setDeleteModalVisible(false)
      deletingJobRoleRef.current = null
      console.log('[WorkspaceList] 开始刷新工作空间列表')
      loadWorkspaces()
    } catch (error: any) {
      console.error('[WorkspaceList] deleteWorkspace 调用失败:', error)
      message.error(error.message || '删除失败')
      setDeleteModalVisible(false)
      deletingJobRoleRef.current = null
    } finally {
      setDeleteLoading(false)
    }
  }

  const getPresetInfo = (jobRole: string) => presetWorkspaces.find(p => p.value === jobRole)

  const techWorkspaces = workspaces.filter(w => w.category === '技术研发')
  const designWorkspaces = workspaces.filter(w => w.category === '产品设计')
  const otherWorkspaces = workspaces.filter(w => w.category !== '技术研发' && w.category !== '产品设计')

  const renderCard = (ws: WorkspaceInfo) => {
    const preset = getPresetInfo(ws.job_role)
    const isHovered = hoveredCard === ws.job_role
    const isTech = ws.category === '技术研发'

    return (
      <div
        key={ws.job_role}
        onMouseEnter={() => setHoveredCard(ws.job_role)}
        onMouseLeave={() => setHoveredCard(null)}
        onClick={() => navigate(`/workspaces/${ws.job_role}`)}
        style={{
          background: colors.surface,
          borderRadius: 12,
          border: `1px solid ${isHovered ? colors.primary : colors.border}`,
          padding: 20,
          cursor: 'pointer',
          transition: 'all 0.25s ease',
          transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
          boxShadow: isHovered ? `0 4px 16px ${colors.primary}20` : '0 1px 4px rgba(0,0,0,0.04)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: isTech ? colors.primaryBg : '#f6ffed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, lineHeight: 1,
            }}>
              {preset ? preset.icon : (isTech ? <CodeOutlined style={{ fontSize: 20, color: colors.primary }} /> : <FormatPainterOutlined style={{ fontSize: 20, color: '#52c41a' }} />)}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: colors.textPrimary, lineHeight: 1.4 }}>{ws.workspace_name}</div>
              <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{ws.job_role}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tag style={{ borderRadius: 4, margin: 0, fontSize: 11, padding: '0 6px', background: isTech ? colors.primaryBg : '#f6ffed', color: isTech ? colors.primary : '#52c41a', border: 'none' }}>
              {ws.category}
            </Tag>
            {isHovered && (
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => { e.stopPropagation(); handleDelete(ws.job_role) }}
                style={{ borderRadius: 6, minWidth: 28, height: 28 }}
              />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: colors.surfaceHover, borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 12, color: colors.textTertiary }}>
              面试 <span style={{ fontWeight: 600, color: colors.textPrimary }}>{ws.interview_count || 0}</span> 次
            </div>
            <div style={{ fontSize: 12, color: colors.textTertiary }}>
              题库 <span style={{ fontWeight: 600, color: colors.textPrimary }}>{ws.question_count || 0}</span> 题
            </div>
          </div>
          <RightOutlined style={{ fontSize: 12, color: isHovered ? colors.primary : colors.textTertiary, transition: 'color 0.2s' }} />
        </div>
      </div>
    )
  }

  const renderSection = (title: string, items: WorkspaceInfo[]) => {
    if (items.length === 0) return null
    return (
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: colors.textSecondary, marginBottom: 12, paddingLeft: 2 }}>
          {title}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {items.map(renderCard)}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flexShrink: 0, padding: '24px 24px 0 24px' }}>
      {initializing && (
        <div style={{ marginBottom: 16, padding: '14px 20px', background: colors.primaryBg, borderRadius: 10, border: `1px solid ${colors.primary}20`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Spin size="small" />
          <span style={{ fontSize: 13, color: colors.textSecondary }}>正在初始化预设工作空间...</span>
        </div>
      )}

      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary, marginBottom: 4 }}>工作空间</div>
          <div style={{ fontSize: 13, color: colors.textTertiary }}>选择一个岗位工作空间，开始面试管理</div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setModalVisible(true); form.resetFields() }} style={{ borderRadius: 8, height: 36 }}>
          新建工作空间
        </Button>
      </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px 24px' }}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          {renderSection('技术研发', techWorkspaces)}
          {renderSection('产品设计', designWorkspaces)}
          {otherWorkspaces.length > 0 && renderSection('其他', otherWorkspaces)}
        </>
      )}
      </div>

      <Modal
        title="新建工作空间"
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => { setModalVisible(false); form.resetFields() }}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="job_role"
            label="工种代码"
            rules={[
              { required: true, message: '请输入或选择工种代码' },
              { pattern: /^[a-z_]+$/, message: '工种代码只能包含小写字母和下划线' },
              { min: 2, message: '工种代码至少2个字符' },
              { max: 30, message: '工种代码最多30个字符' },
            ]}
          >
            <AutoComplete
              placeholder="选择预设或手动输入，例如: devops_eng"
              options={presetWorkspaces.map(opt => ({
                value: opt.value,
                label: workspaces.some(w => w.job_role === opt.value) ? `${opt.label}（已创建）` : opt.label,
                disabled: workspaces.some(w => w.job_role === opt.value),
              }))}
              filterOption={(inputValue, option) =>
                option!.value.toLowerCase().includes(inputValue.toLowerCase()) ||
                option!.label.toString().toLowerCase().includes(inputValue.toLowerCase())
              }
              onSelect={(value) => {
                const selected = presetWorkspaces.find(opt => opt.value === value)
                if (selected) {
                  form.setFieldsValue({
                    workspace_name: selected.name,
                    category: selected.category,
                  })
                }
              }}
            />
          </Form.Item>

          <Form.Item
            name="workspace_name"
            label="工作空间名称"
            rules={[{ required: true, message: '请输入工作空间名称' }]}
          >
            <Input placeholder="选择预设后自动填充，或手动输入" />
          </Form.Item>
          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择或输入分类' }]}
          >
            <AutoComplete
              placeholder="选择预设分类或手动输入"
              options={[
                { value: '技术研发', label: '技术研发' },
                { value: '产品设计', label: '产品设计' },
              ]}
              filterOption={(inputValue, option) =>
                option!.value.toLowerCase().includes(inputValue.toLowerCase())
              }
            />
          </Form.Item>
        </Form>
      </Modal>

      <ConfirmModal
        open={deleteModalVisible}
        title="确认删除"
        message="删除工作空间将同时删除所有相关数据（面试记录、题库、职位描述(JD)等），此操作无法恢复，确定要删除吗？"
        confirmText="确定删除"
        type="danger"
        confirmLoading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteModalVisible(false)
          deletingJobRoleRef.current = null
        }}
      />
    </div>
  )
}