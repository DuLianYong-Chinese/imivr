import { useState, useEffect } from 'react'
import { Form, Input, Select, Button, App, Modal, Space, Tag, Checkbox, Tooltip } from 'antd'
import type { FormInstance } from 'antd'
import { FolderOpenOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined, EditOutlined, SwapOutlined, InfoCircleOutlined, SettingOutlined, RobotOutlined, AudioOutlined, DatabaseOutlined, CloudServerOutlined, StarFilled, KeyOutlined, GlobalOutlined } from '@ant-design/icons'
import { getConfig, saveConfig, getConfigPath, resetConfig, selectWorkspace, getWorkspaceRoot, selectFolderDialog, migrateWorkspace } from '@/core/filesystem'
import { configureAI, getAIConfig } from '@/core/ai'
import { useThemeStore } from '@/stores/themeStore'
import { listWorkspaces, createWorkspace } from '@/modules/workspace'
import ConfirmModal from '@/components/ConfirmModal'

interface AIModelConfig {
  id: string
  name: string
  provider: string
  apiKey: string
  baseURL: string
  model: string
  isDefault?: boolean
}

const providerMap: Record<string, { label: string; color: string }> = {
  finna: { label: 'Finna', color: '#1677ff' },
  deepseek: { label: 'DeepSeek', color: '#4d6bfe' },
  qwen: { label: '通义千问', color: '#6236ff' },
  custom: { label: '自定义', color: '#8c8c8c' },
}

const presetWorkspaces = [
  { value: 'frontend_dev', label: '前端开发工程师', name: '前端开发工程师', category: '技术研发' },
  { value: 'backend_dev', label: '后端开发工程师', name: '后端开发工程师', category: '技术研发' },
  { value: 'algorithm_eng', label: '算法工程师', name: '算法工程师', category: '技术研发' },
  { value: 'test_eng', label: '测试工程师', name: '测试工程师', category: '技术研发' },
  { value: 'data_dev', label: '数据开发工程师', name: '数据开发工程师', category: '技术研发' },
  { value: 'product_mgr', label: '产品经理', name: '产品经理', category: '产品设计' },
  { value: 'ui_designer', label: 'UI设计师', name: 'UI设计师', category: '产品设计' },
]

function SectionBlock({ title, description, icon, accentColor, extra, children }: {
  title: string
  description?: string
  icon: React.ReactNode
  accentColor: string
  extra?: React.ReactNode
  children: React.ReactNode
}) {
  const { colors } = useThemeStore()
  return (
    <div style={{
      background: colors.surface,
      borderRadius: 16,
      border: `1px solid ${colors.border}`,
      overflow: 'hidden',
      boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
      transition: 'box-shadow 0.3s ease, transform 0.25s ease',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}60, transparent)` }} />
      <div style={{ padding: '20px 28px 24px', flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: description ? 6 : 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `${accentColor}12`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: accentColor,
            }}>
              {icon}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: colors.textPrimary }}>{title}</div>
          </div>
          {extra && <div>{extra}</div>}
        </div>
        {description && (
          <div style={{ fontSize: 13, color: colors.textTertiary, marginBottom: 18, paddingLeft: 48 }}>{description}</div>
        )}
        {children}
      </div>
    </div>
  )
}

function ModelCard({ model, onEdit, onDelete, onSetDefault, isDefault, accentColor }: {
  model: AIModelConfig
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
  isDefault: boolean
  accentColor: string
}) {
  const { colors } = useThemeStore()
  const [hovered, setHovered] = useState(false)
  const providerInfo = providerMap[model.provider] || { label: model.provider, color: '#8c8c8c' }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isDefault ? `${accentColor}08` : colors.surfaceHover,
        borderRadius: 12,
        border: `1px solid ${isDefault ? accentColor : hovered ? colors.primary : colors.border}`,
        padding: 16,
        transition: 'all 0.25s ease',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        boxShadow: isDefault ? `0 0 0 1px ${accentColor}30` : hovered ? `0 4px 12px rgba(0,0,0,0.08)` : 'none',
        position: 'relative',
      }}
    >
      {isDefault && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          padding: '2px 10px',
          background: accentColor,
          color: '#fff',
          fontSize: 11, fontWeight: 600,
          borderRadius: '0 0 0 8px',
          lineHeight: '20px',
        }}>
          默认
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 9,
              background: `${providerInfo.color}14`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <RobotOutlined style={{ fontSize: 18, color: providerInfo.color }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: colors.textPrimary, lineHeight: 1.3 }}>{model.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <Tag style={{
                  borderRadius: 4, margin: 0, fontSize: 11, padding: '0 6px',
                  background: `${providerInfo.color}14`, color: providerInfo.color,
                  border: `1px solid ${providerInfo.color}30`,
                }}>
                  {providerInfo.label}
                </Tag>
                <span style={{ fontSize: 12, color: colors.textTertiary }}>{model.model}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: colors.textTertiary }}>
            {model.baseURL && (
              <Tooltip title={model.baseURL}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <GlobalOutlined style={{ fontSize: 12 }} />
                  <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model.baseURL}</span>
                </span>
              </Tooltip>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <KeyOutlined style={{ fontSize: 12 }} />
              {model.apiKey ? `${model.apiKey.slice(0, 8)}...` : '未设置'}
            </span>
          </div>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          opacity: hovered ? 1 : 0.4,
          transition: 'opacity 0.2s ease',
        }}>
          {!isDefault && (
            <Tooltip title="设为默认">
              <Button type="text" size="small" icon={<StarFilled />} onClick={onSetDefault} style={{ borderRadius: 6, minWidth: 32, height: 32, color: colors.textTertiary }} />
            </Tooltip>
          )}
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={onEdit} style={{ borderRadius: 6, minWidth: 32, height: 32 }} />
          </Tooltip>
          <Tooltip title="删除">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={onDelete} style={{ borderRadius: 6, minWidth: 32, height: 32 }} />
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

function VoiceModelCard({ model, onEdit, onDelete, onSetDefault, isDefault }: {
  model: AIModelConfig
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
  isDefault: boolean
}) {
  const { colors } = useThemeStore()
  const [hovered, setHovered] = useState(false)
  const providerInfo = providerMap[model.provider] || { label: model.provider, color: '#8c8c8c' }
  const accentColor = '#13c2c2'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isDefault ? `${accentColor}08` : colors.surfaceHover,
        borderRadius: 12,
        border: `1px solid ${isDefault ? accentColor : hovered ? colors.primary : colors.border}`,
        padding: 16,
        transition: 'all 0.25s ease',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        boxShadow: isDefault ? `0 0 0 1px ${accentColor}30` : hovered ? `0 4px 12px rgba(0,0,0,0.08)` : 'none',
        position: 'relative',
      }}
    >
      {isDefault && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          padding: '2px 10px',
          background: accentColor,
          color: '#fff',
          fontSize: 11, fontWeight: 600,
          borderRadius: '0 0 0 8px',
          lineHeight: '20px',
        }}>
          默认
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 9,
              background: `${accentColor}14`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AudioOutlined style={{ fontSize: 18, color: accentColor }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: colors.textPrimary, lineHeight: 1.3 }}>{model.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <Tag style={{
                  borderRadius: 4, margin: 0, fontSize: 11, padding: '0 6px',
                  background: `${providerInfo.color}14`, color: providerInfo.color,
                  border: `1px solid ${providerInfo.color}30`,
                }}>
                  {providerInfo.label}
                </Tag>
                <span style={{ fontSize: 12, color: colors.textTertiary }}>{model.model}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: colors.textTertiary }}>
            {model.baseURL && (
              <Tooltip title={model.baseURL}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <GlobalOutlined style={{ fontSize: 12 }} />
                  <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model.baseURL}</span>
                </span>
              </Tooltip>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <KeyOutlined style={{ fontSize: 12 }} />
              {model.apiKey ? `${model.apiKey.slice(0, 8)}...` : '未设置'}
            </span>
          </div>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          opacity: hovered ? 1 : 0.4,
          transition: 'opacity 0.2s ease',
        }}>
          {!isDefault && (
            <Tooltip title="设为默认">
              <Button type="text" size="small" icon={<StarFilled />} onClick={onSetDefault} style={{ borderRadius: 6, minWidth: 32, height: 32, color: colors.textTertiary }} />
            </Tooltip>
          )}
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={onEdit} style={{ borderRadius: 6, minWidth: 32, height: 32 }} />
          </Tooltip>
          <Tooltip title="删除">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={onDelete} style={{ borderRadius: 6, minWidth: 32, height: 32 }} />
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ icon, text, onAdd, accentColor }: { icon: React.ReactNode; text: string; onAdd: () => void; accentColor: string }) {
  const { colors } = useThemeStore()
  return (
    <div style={{
      padding: '32px 20px',
      textAlign: 'center',
      background: colors.surfaceHover,
      borderRadius: 12,
      border: `1px dashed ${colors.border}`,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: `${accentColor}10`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
        fontSize: 28, color: accentColor,
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 14, color: colors.textTertiary, marginBottom: 16 }}>{text}</div>
      <Button type="primary" icon={<PlusOutlined />} onClick={onAdd} style={{ borderRadius: 8 }}>
        添加配置
      </Button>
    </div>
  )
}

export default function Settings() {
  const { colors } = useThemeStore()
  const { message } = App.useApp()

  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<any>({})
  const [configPath, setConfigPath] = useState<string>('')
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)
  const [migrating, setMigrating] = useState(false)
  const [workspaceInitialized, setWorkspaceInitialized] = useState(false)
  const [reinitializing, setReinitializing] = useState(false)
  
  const [migrateModalVisible, setMigrateModalVisible] = useState(false)
  const [migrateTargetPath, setMigrateTargetPath] = useState<string>('')
  const [migrateMessage, setMigrateMessage] = useState<string>('')
  const [resetModalVisible, setResetModalVisible] = useState(false)
  const [switchWorkspaceModalVisible, setSwitchWorkspaceModalVisible] = useState(false)
  const [switchWorkspacePath, setSwitchWorkspacePath] = useState<string>('')
  
  const [aiModels, setAiModels] = useState<AIModelConfig[]>([])
  const [editingModel, setEditingModel] = useState<AIModelConfig | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modelForm] = Form.useForm()

  const [aiVoiceModels, setAiVoiceModels] = useState<AIModelConfig[]>([])
  const [editingVoiceModel, setEditingVoiceModel] = useState<AIModelConfig | null>(null)
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false)
  const [voiceModelForm] = Form.useForm()

  const [deleteModelId, setDeleteModelId] = useState<string | null>(null)
  const [deleteModelVisible, setDeleteModelVisible] = useState(false)
  const [deleteVoiceModelId, setDeleteVoiceModelId] = useState<string | null>(null)
  const [deleteVoiceModelVisible, setDeleteVoiceModelVisible] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const [savedConfig, pathInfo, root] = await Promise.all([
        getConfig(),
        getConfigPath(),
        getWorkspaceRoot()
      ])
      setConfig(savedConfig)
      setConfigPath(pathInfo.path)
      setWorkspaceRoot(root)
      setWorkspaceInitialized(savedConfig.workspace_initialized || false)
      
      const models = savedConfig.aiModels || []
      setAiModels(models)
      
      const voiceModels = savedConfig.aiVoiceModels || []
      setAiVoiceModels(voiceModels)
    } catch (error) {
      console.error('加载设置失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectWorkspace = async () => {
    try {
      const selectedPath = await selectFolderDialog()
      if (!selectedPath) return
      setSwitchWorkspacePath(selectedPath)
      setSwitchWorkspaceModalVisible(true)
    } catch (error) {
      message.error('打开文件夹选择对话框失败')
      console.error(error)
    }
  }

  const handleConfirmSwitchWorkspace = async () => {
    try {
      const success = await selectWorkspace(switchWorkspacePath)
      setSwitchWorkspaceModalVisible(false)
      setSwitchWorkspacePath('')
      if (success) {
        message.success('工作目录设置成功')
        await loadSettings()
      } else {
        message.error('设置工作目录失败')
      }
    } catch (error) {
      setSwitchWorkspaceModalVisible(false)
      message.error('设置工作目录失败')
    }
  }

  const handleMigrateWorkspace = async () => {
    try {
      const targetPath = await selectFolderDialog()
      if (!targetPath) return
      const targetWsPath = targetPath + '/workspaces'
      if (targetWsPath === workspaceRoot || targetPath === workspaceRoot) {
        message.warning('选择的目录与当前工作目录相同，无需迁移')
        return
      }
      setMigrating(true)
      const result = await migrateWorkspace(targetPath, false)
      if (result.needsConfirmation) {
        setMigrating(false)
        setMigrateTargetPath(targetPath)
        setMigrateMessage(result.message || '目标目录下的 workspaces 中已有内容，迁移后该内容将被删除并替换为原工作空间内容，是否继续？')
        setMigrateModalVisible(true)
      } else if (result.success) {
        setMigrating(false)
        message.success('工作目录迁移成功')
        await loadSettings()
      } else {
        setMigrating(false)
        message.error(result.message || '迁移失败')
      }
    } catch (error) {
      setMigrating(false)
      message.error('迁移工作目录失败')
      console.error(error)
    }
  }

  const handleConfirmMigrate = async () => {
    try {
      setMigrating(true)
      const result = await migrateWorkspace(migrateTargetPath, true)
      setMigrateModalVisible(false)
      setMigrateTargetPath('')
      setMigrateMessage('')
      setMigrating(false)
      if (result.success) {
        message.success('工作目录迁移成功')
        await loadSettings()
      } else {
        message.error(result.message || '迁移失败')
      }
    } catch (error) {
      setMigrating(false)
      message.error('迁移失败')
    }
  }

  const handleSaveAIModels = async () => {
    try {
      const newConfig = { ...config, aiModels: aiModels }
      const defaultModel = aiModels.find(m => m.isDefault) || aiModels[0]
      if (defaultModel) {
        await configureAI({
          provider: defaultModel.provider || 'finna',
          apiKey: defaultModel.apiKey,
          baseURL: defaultModel.baseURL,
          model: defaultModel.model
        })
      }
      await saveConfig(newConfig)
      setConfig(newConfig)
      message.success('AI 设置已保存')
    } catch (error) {
      message.error('保存失败')
    }
  }

  const handleReset = () => {
    setResetModalVisible(true)
  }

  const handleConfirmReset = async () => {
    try {
      setLoading(true)
      setResetModalVisible(false)
      await resetConfig()
      message.success('重置成功')
      await loadSettings()
    } catch (error) {
      message.error('重置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleReinitializeWorkspaces = async () => {
    setReinitializing(true)
    try {
      const existing = await listWorkspaces()
      const existingRoles = existing.map(w => w.job_role)
      const toCreate = presetWorkspaces.filter(p => !existingRoles.includes(p.value))
      let created = 0
      for (const preset of toCreate) {
        try {
          await createWorkspace({
            job_role: preset.value,
            workspace_name: preset.name,
            category: preset.category as '技术研发' | '产品设计',
            target_levels: [],
            evaluation_dimensions: [
              { name: '基础知识', weight: 0.2, description: '基础理论和概念' },
              { name: '实践能力', weight: 0.25, description: '实际操作和解决问题' },
              { name: '系统设计', weight: 0.2, description: '架构和系统设计能力' },
              { name: '项目经验', weight: 0.2, description: '项目经历和贡献' },
              { name: '沟通协作', weight: 0.15, description: '团队协作和沟通能力' },
            ],
          })
          created++
        } catch (error: any) {
          if (!error?.message?.includes('already exists')) {
            console.warn(`初始化工作空间 ${preset.value} 失败:`, error?.message)
          }
        }
      }
      const newConfig = { ...config, workspace_initialized: true }
      await saveConfig(newConfig)
      setConfig(newConfig)
      setWorkspaceInitialized(true)
      if (created > 0) {
        message.success(`已初始化 ${created} 个工作空间`)
      } else {
        message.info('所有预设工作空间已存在，无需初始化')
      }
    } catch (error) {
      message.error('初始化工作空间失败')
    } finally {
      setReinitializing(false)
    }
  }

  const openModal = (model?: AIModelConfig) => {
    if (model) {
      setEditingModel(model)
      modelForm.setFieldsValue(model)
    } else {
      setEditingModel(null)
      modelForm.resetFields()
      modelForm.setFieldsValue({ provider: 'finna', isDefault: aiModels.length === 0 })
    }
    setIsModalOpen(true)
  }

  const handleSaveModel = async (values: any) => {
    const newModel: AIModelConfig = {
      id: editingModel?.id || Date.now().toString(),
      name: values.name,
      provider: values.provider,
      apiKey: values.apiKey,
      baseURL: values.baseURL || '',
      model: values.model,
      isDefault: values.isDefault
    }

    let newModels: AIModelConfig[]
    if (editingModel) {
      newModels = aiModels.map(m => {
        if (m.id === newModel.id) return newModel
        if (newModel.isDefault) return { ...m, isDefault: false }
        return m
      })
    } else {
      if (newModel.isDefault) {
        newModels = aiModels.map(m => ({ ...m, isDefault: false }))
      } else {
        newModels = [...aiModels]
      }
      newModels.push(newModel)
    }

    setAiModels(newModels)
    setIsModalOpen(false)
    
    const newConfig = { ...config, aiModels: newModels }
    const defaultModel = newModels.find(m => m.isDefault) || newModels[0]
    if (defaultModel) {
      await configureAI({
        provider: defaultModel.provider || 'finna',
        apiKey: defaultModel.apiKey,
        baseURL: defaultModel.baseURL,
        model: defaultModel.model
      })
    }
    await saveConfig(newConfig)
    setConfig(newConfig)
    message.success('模型配置已保存')
  }

  const handleDeleteModel = (id: string) => {
    setDeleteModelId(id)
    setDeleteModelVisible(true)
  }

  const handleConfirmDeleteModel = async () => {
    if (!deleteModelId) return
    const newModels = aiModels.filter(m => m.id !== deleteModelId)
    if (newModels.length > 0 && !newModels.some(m => m.isDefault)) {
      newModels[0].isDefault = true
    }
    setAiModels(newModels)
    setDeleteModelVisible(false)
    setDeleteModelId(null)
    
    const newConfig = { ...config, aiModels: newModels }
    const defaultModel = newModels.find(m => m.isDefault)
    if (defaultModel) {
      await configureAI({
        provider: defaultModel.provider || 'finna',
        apiKey: defaultModel.apiKey,
        baseURL: defaultModel.baseURL,
        model: defaultModel.model
      })
    }
    await saveConfig(newConfig)
    setConfig(newConfig)
    message.success('模型已删除')
  }

  const handleSetDefault = async (id: string) => {
    const newModels = aiModels.map(m => ({ ...m, isDefault: m.id === id }))
    setAiModels(newModels)
    
    const newConfig = { ...config, aiModels: newModels }
    const defaultModel = newModels.find(m => m.isDefault)
    if (defaultModel) {
      await configureAI({
        provider: defaultModel.provider || 'finna',
        apiKey: defaultModel.apiKey,
        baseURL: defaultModel.baseURL,
        model: defaultModel.model
      })
    }
    await saveConfig(newConfig)
    setConfig(newConfig)
    message.success('默认模型已更新')
  }

  const openVoiceModal = (model?: AIModelConfig) => {
    if (model) {
      setEditingVoiceModel(model)
      voiceModelForm.setFieldsValue(model)
    } else {
      setEditingVoiceModel(null)
      voiceModelForm.resetFields()
      voiceModelForm.setFieldsValue({ provider: 'finna', isDefault: aiVoiceModels.length === 0 })
    }
    setIsVoiceModalOpen(true)
  }

  const handleSaveVoiceModel = async (values: any) => {
    const newModel: AIModelConfig = {
      id: editingVoiceModel?.id || Date.now().toString(),
      name: values.name,
      provider: values.provider,
      apiKey: values.apiKey,
      baseURL: values.baseURL || '',
      model: values.model,
      isDefault: values.isDefault
    }

    let newModels: AIModelConfig[]
    if (editingVoiceModel) {
      newModels = aiVoiceModels.map(m => {
        if (m.id === newModel.id) return newModel
        if (newModel.isDefault) return { ...m, isDefault: false }
        return m
      })
    } else {
      if (newModel.isDefault) {
        newModels = aiVoiceModels.map(m => ({ ...m, isDefault: false }))
      } else {
        newModels = [...aiVoiceModels]
      }
      newModels.push(newModel)
    }

    setAiVoiceModels(newModels)
    setIsVoiceModalOpen(false)

    const newConfig = { ...config, aiVoiceModels: newModels }
    await saveConfig(newConfig)
    setConfig(newConfig)
    message.success('语音模型配置已保存')
  }

  const handleDeleteVoiceModel = (id: string) => {
    setDeleteVoiceModelId(id)
    setDeleteVoiceModelVisible(true)
  }

  const handleConfirmDeleteVoiceModel = async () => {
    if (!deleteVoiceModelId) return
    const newModels = aiVoiceModels.filter(m => m.id !== deleteVoiceModelId)
    if (newModels.length > 0 && !newModels.some(m => m.isDefault)) {
      newModels[0].isDefault = true
    }
    setAiVoiceModels(newModels)
    setDeleteVoiceModelVisible(false)
    setDeleteVoiceModelId(null)

    const newConfig = { ...config, aiVoiceModels: newModels }
    await saveConfig(newConfig)
    setConfig(newConfig)
    message.success('语音模型已删除')
  }

  const handleSetDefaultVoiceModel = async (id: string) => {
    const newModels = aiVoiceModels.map(m => ({ ...m, isDefault: m.id === id }))
    setAiVoiceModels(newModels)

    const newConfig = { ...config, aiVoiceModels: newModels }
    await saveConfig(newConfig)
    setConfig(newConfig)
    message.success('默认语音模型已更新')
  }

  const modelFormItems = (formInstance: FormInstance, isVoice: boolean) => (
    <Form form={formInstance} layout="vertical" onFinish={isVoice ? handleSaveVoiceModel : handleSaveModel}>
      <Form.Item
        name="name"
        label="配置名称"
        rules={[{ required: true, message: '请输入配置名称' }]}
      >
        <Input placeholder={isVoice ? '例如：qwen3-asr-flash' : '例如：deepseek-v4-flash'} style={{ borderRadius: 8 }} />
      </Form.Item>

      <Form.Item
        name="provider"
        label="供应商"
        rules={[{ required: true, message: '请选择或输入供应商' }]}
      >
        <Select
          placeholder="选择供应商"
          allowClear
          showSearch
          options={[
            { value: 'finna', label: 'Finna' },
            { value: 'deepseek', label: 'DeepSeek' },
            { value: 'qwen', label: '通义千问' },
            { value: 'custom', label: '自定义' }
          ]}
          dropdownRender={(menu) => (
            <>
              {menu}
              <div style={{ padding: '8px 12px' }}>
                <Input
                  placeholder="输入自定义供应商名称"
                  onPressEnter={(e) => {
                    const value = (e.target as HTMLInputElement).value
                    if (value) {
                      formInstance.setFieldsValue({ provider: value })
                    }
                  }}
                  style={{ borderRadius: 8 }}
                />
              </div>
            </>
          )}
        />
      </Form.Item>

      <Form.Item
        name="model"
        label="模型名称"
        rules={[{ required: true, message: '请输入模型名称' }]}
      >
        <Input placeholder={isVoice ? '例如：qwen3-asr-flash 或自定义语音模型名' : '例如：deepseek-v4-flash 或自定义模型名'} style={{ borderRadius: 8 }} />
      </Form.Item>

      <Form.Item
        name="apiKey"
        label="API Key"
        rules={[{ required: true, message: '请输入 API Key' }]}
      >
        <Input.Password placeholder="请输入 API Key" style={{ borderRadius: 8 }} />
      </Form.Item>

      <Form.Item
        name="baseURL"
        label="Base URL（可选）"
      >
        <Input placeholder="例如：https://www.finna.com.cn/v1" style={{ borderRadius: 8 }} />
      </Form.Item>

      <Form.Item
        name="isDefault"
        valuePropName="checked"
      >
        <Checkbox>{isVoice ? '设为默认语音模型' : '设为默认模型'}</Checkbox>
      </Form.Item>
    </Form>
  )

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: colors.textPrimary, marginBottom: 4 }}>系统设置</div>
        <div style={{ fontSize: 13, color: colors.textTertiary }}>管理应用配置、工作目录和 AI 模型参数</div>
      </div>

      <div style={{
        padding: '14px 20px',
        background: `${colors.primary}08`,
        borderRadius: 10,
        border: `1px solid ${colors.primary}20`,
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 24,
      }}>
        <InfoCircleOutlined style={{ fontSize: 16, color: colors.primary }} />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 13, color: colors.textSecondary }}>配置文件位置：</span>
          <span style={{ fontSize: 13, color: colors.textPrimary, fontWeight: 500 }}>{configPath || '加载中...'}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <SectionBlock
        title="工作目录"
        description="配置数据存储位置，更换或迁移工作目录"
        icon={<DatabaseOutlined />}
        accentColor={colors.primary}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px',
          background: colors.surfaceHover,
          borderRadius: 10,
          marginBottom: 16,
        }}>
          <FolderOpenOutlined style={{ fontSize: 16, color: colors.primary }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: colors.textTertiary }}>当前目录</div>
            <div style={{ fontSize: 14, color: colors.textPrimary, fontWeight: 500 }}>{workspaceRoot || '未选择'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Button type="primary" icon={<FolderOpenOutlined />} onClick={handleSelectWorkspace} style={{ borderRadius: 8, height: 36 }}>
            更换目录
          </Button>
          <Button icon={<SwapOutlined />} onClick={handleMigrateWorkspace} loading={migrating} style={{ borderRadius: 8, height: 36 }}>
            迁移目录
          </Button>
          <Button danger icon={<ReloadOutlined />} onClick={handleReset} style={{ borderRadius: 8, height: 36 }}>
            重置配置
          </Button>
        </div>
      </SectionBlock>

      <SectionBlock
        title="工作空间预设初始化"
        description="一键创建7个预设岗位工作空间"
        icon={<CloudServerOutlined />}
        accentColor="#52c41a"
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px',
          background: colors.surfaceHover,
          borderRadius: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Tag color={workspaceInitialized ? 'success' : 'warning'} style={{ borderRadius: 6, margin: 0, fontSize: 13, padding: '4px 12px' }}>
              {workspaceInitialized ? '已初始化' : '未初始化'}
            </Tag>
            <span style={{ fontSize: 13, color: colors.textSecondary }}>
              {workspaceInitialized ? '预设工作空间已就绪' : '需要初始化才能使用'}
            </span>
          </div>
          <Button
            icon={<PlusOutlined />}
            onClick={handleReinitializeWorkspaces}
            loading={reinitializing}
            style={{ borderRadius: 8, height: 36 }}
          >
            初始化
          </Button>
        </div>
      </SectionBlock>

      <SectionBlock
        title="AI 模型配置"
        description="用于问答和出题的大语言模型配置"
        icon={<RobotOutlined />}
        accentColor="#722ed1"
        extra={aiModels.length > 0 ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()} style={{ borderRadius: 8, height: 36 }}>
            添加模型
          </Button>
        ) : undefined}
      >
        {aiModels.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {aiModels.map(model => (
              <ModelCard
                key={model.id}
                model={model}
                isDefault={model.isDefault || false}
                accentColor="#722ed1"
                onEdit={() => openModal(model)}
                onDelete={() => handleDeleteModel(model.id)}
                onSetDefault={() => handleSetDefault(model.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<RobotOutlined />}
            text="尚未配置 AI 模型，添加后即可开始面试"
            onAdd={() => openModal()}
            accentColor="#722ed1"
          />
        )}
      </SectionBlock>

      <SectionBlock
        title="AI 语音模型配置"
        description="用于语音识别和合成的模型配置"
        icon={<AudioOutlined />}
        accentColor="#13c2c2"
        extra={aiVoiceModels.length > 0 ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openVoiceModal()} style={{ borderRadius: 8, height: 36 }}>
            添加语音模型
          </Button>
        ) : undefined}
      >
        {aiVoiceModels.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {aiVoiceModels.map(model => (
              <VoiceModelCard
                key={model.id}
                model={model}
                isDefault={model.isDefault || false}
                onEdit={() => openVoiceModal(model)}
                onDelete={() => handleDeleteVoiceModel(model.id)}
                onSetDefault={() => handleSetDefaultVoiceModel(model.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<AudioOutlined />}
            text="尚未配置语音模型，添加后即可使用语音功能"
            onAdd={() => openVoiceModal()}
            accentColor="#13c2c2"
          />
        )}
      </SectionBlock>
      </div>

      <Modal
        title={editingModel ? '编辑模型配置' : '添加模型配置'}
        open={isModalOpen}
        onOk={() => modelForm.submit()}
        onCancel={() => setIsModalOpen(false)}
        width={600}
        destroyOnHidden
      >
        {modelFormItems(modelForm, false)}
      </Modal>

      <Modal
        title={editingVoiceModel ? '编辑语音模型配置' : '添加语音模型配置'}
        open={isVoiceModalOpen}
        onOk={() => voiceModelForm.submit()}
        onCancel={() => setIsVoiceModalOpen(false)}
        width={600}
        destroyOnHidden
      >
        {modelFormItems(voiceModelForm, true)}
      </Modal>

      <ConfirmModal
        open={switchWorkspaceModalVisible}
        title="更换工作目录"
        message={'更换工作目录后，当前工作目录的数据不会被迁移，新目录将作为工作目录使用。如需迁移数据，请使用「迁移工作目录」功能。确定要更换吗？'}
        confirmText="确认更换"
        type="warning"
        onConfirm={handleConfirmSwitchWorkspace}
        onCancel={() => {
          setSwitchWorkspaceModalVisible(false)
          setSwitchWorkspacePath('')
        }}
      />

      <ConfirmModal
        open={migrateModalVisible}
        title="工作目录迁移确认"
        message={migrateMessage}
        confirmText="确认迁移"
        confirmLoading={migrating}
        type="warning"
        onConfirm={handleConfirmMigrate}
        onCancel={() => {
          setMigrateModalVisible(false)
          setMigrateTargetPath('')
          setMigrateMessage('')
        }}
      />

      <ConfirmModal
        open={resetModalVisible}
        title="重置配置"
        message="这将清除所有配置，工作目录将恢复为默认位置（配置目录/workspaces），确定要重置吗？"
        confirmText="确认重置"
        type="danger"
        onConfirm={handleConfirmReset}
        onCancel={() => setResetModalVisible(false)}
      />

      <ConfirmModal
        open={deleteModelVisible}
        title="删除模型"
        message="确定要删除这个模型配置吗？删除后无法恢复。"
        confirmText="确定删除"
        type="danger"
        onConfirm={handleConfirmDeleteModel}
        onCancel={() => {
          setDeleteModelVisible(false)
          setDeleteModelId(null)
        }}
      />

      <ConfirmModal
        open={deleteVoiceModelVisible}
        title="删除语音模型"
        message="确定要删除这个语音模型配置吗？删除后无法恢复。"
        confirmText="确定删除"
        type="danger"
        onConfirm={handleConfirmDeleteVoiceModel}
        onCancel={() => {
          setDeleteVoiceModelVisible(false)
          setDeleteVoiceModelId(null)
        }}
      />
      </div>
    </div>
  )
}