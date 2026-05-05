import { useState, useEffect } from 'react'
import { Card, Button, Modal, Form, Input, Tag, message } from 'antd'
import { EditOutlined, EyeOutlined, PlusOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons'
import { readFile, writeFile, exists, deleteFile, listFiles } from '@/core/filesystem'
import { useThemeStore } from '@/stores/themeStore'
import ConfirmModal from '@/components/ConfirmModal'

interface JDConfigItem {
  key: string
  name: string
  fileName: string
  content: string
  exists: boolean
}

interface JDManagementCardsProps {
  jobRole: string
  onDataChange?: () => void
}

export default function JDManagementCards({ jobRole, onDataChange }: JDManagementCardsProps) {
  const { colors } = useThemeStore()
  const [, setLoading] = useState(false)
  const [jdConfigs, setJdConfigs] = useState<JDConfigItem[]>([])
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [deletingJD, setDeletingJD] = useState<JDConfigItem | null>(null)

  const preStyle = {
    background: colors.surfaceHover,
    padding: 16,
    borderRadius: 4,
    maxHeight: 500,
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    margin: 0,
    color: colors.textPrimary,
  } as const

  const [viewModalVisible, setViewModalVisible] = useState(false)
  const [viewingJD, setViewingJD] = useState<JDConfigItem | null>(null)

  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingJD, setEditingJD] = useState<JDConfigItem | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [editForm] = Form.useForm()

  const templatesDir = `${jobRole}/templates`

  useEffect(() => {
    loadJDConfigs()
  }, [jobRole])

  const loadJDConfigs = async () => {
    if (!jobRole) return
    setLoading(true)
    try {
      const configs: JDConfigItem[] = []
      
      const dirExists = await exists(templatesDir)
      if (dirExists) {
        const files = await listFiles(templatesDir)
        
        const jdFiles = files.filter((f: string) => {
          const normalizedPath = f.replace(/\\/g, '/')
          const fileName = normalizedPath.split('/').pop() || normalizedPath
          return fileName.startsWith('jd-') && fileName.endsWith('-template.md')
        })
        
        for (const filePath of jdFiles) {
          try {
            const content = await readFile(filePath)
            const normalizedPath = filePath.replace(/\\/g, '/')
            const fileName = normalizedPath.split('/').pop() || normalizedPath
            const match = fileName.match(/^jd-(.+)-template\.md$/)
            const name = match ? match[1] : fileName
            
            configs.push({
              key: fileName,
              name,
              fileName: fileName,
              content,
              exists: true,
            })
          } catch (readError) {
            console.error('[JD] 读取文件失败:', filePath, readError)
          }
        }
      }
      
      setJdConfigs(configs)
    } catch (error) {
      console.error('[JD] 加载职位描述(JD)失败:', error)
      message.error('加载职位描述(JD)失败')
    } finally {
      setLoading(false)
    }
  }

  const handleView = (jd: JDConfigItem) => {
    setViewingJD(jd)
    setViewModalVisible(true)
  }

  const handleCreate = () => {
    setIsCreating(true)
    setEditingJD(null)
    editForm.setFieldsValue({ name: '', content: '' })
    setEditModalVisible(true)
  }

  const handleEdit = (jd: JDConfigItem) => {
    setIsCreating(false)
    setEditingJD(jd)
    editForm.setFieldsValue({ name: jd.name, content: jd.content })
    setEditModalVisible(true)
  }

  const handleSave = async (values: { name: string; content: string }) => {
    if (!jobRole) return

    try {
      const fileName = `jd-${values.name}-template.md`
      const filePath = `${templatesDir}/${fileName}`

      if (isCreating) {
        const fileExists = await exists(filePath)
        if (fileExists) {
          message.error(`职位描述(JD) "${values.name}" 已存在，请使用其他名称`)
          return
        }
      }

      if (!isCreating && editingJD && editingJD.fileName !== fileName) {
        const oldFilePath = `${templatesDir}/${editingJD.fileName}`
        await deleteFile(oldFilePath)
      }

      const success = await writeFile(filePath, values.content)
      if (!success) {
        message.error(isCreating ? '创建失败，请重试' : '保存失败，请重试')
        return
      }
      message.success(isCreating ? '创建成功' : '保存成功')
      setEditModalVisible(false)
      setEditingJD(null)
      editForm.resetFields()
      loadJDConfigs()
      onDataChange?.()
    } catch (error: any) {
      message.error(error.message || (isCreating ? '创建失败' : '保存失败'))
    }
  }

  const handleDelete = (jd: JDConfigItem) => {
    setDeletingJD(jd)
    setDeleteModalVisible(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletingJD) return
    try {
      const filePath = `${templatesDir}/${deletingJD.fileName}`
      await deleteFile(filePath)
      message.success('删除成功')
      setDeleteModalVisible(false)
      setDeletingJD(null)
      loadJDConfigs()
      onDataChange?.()
    } catch (error: any) {
      message.error(error.message || '删除失败')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flexShrink: 0, marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          创建职位描述(JD)
        </Button>
      </div>

      {jdConfigs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: colors.textTertiary }}>
          <FileTextOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <p>暂无职位描述(JD)，点击上方按钮创建</p>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {jdConfigs.map((jd) => (
            <Card
              key={jd.key}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag color="blue">{jd.name}</Tag>
                  <Tag color="success">已创建</Tag>
                </div>
              }
              actions={[
                <Button key="view" type="link" icon={<EyeOutlined />} onClick={() => handleView(jd)}>
                  查看
                </Button>,
                <Button key="edit" type="link" icon={<EditOutlined />} onClick={() => handleEdit(jd)}>
                  编辑
                </Button>,
                <Button key="delete" type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(jd)}>
                  删除
                </Button>,
              ]}
            >
              <div style={{ minHeight: 60 }}>
                <p style={{ color: colors.textSecondary, marginBottom: 8 }}>文件路径: {templatesDir}/{jd.fileName}</p>
                <p style={{ color: colors.textTertiary, fontSize: 12 }}>内容长度: {jd.content.length} 字符</p>
              </div>
            </Card>
          ))}
        </div>
        </div>
      )}

      <Modal
        title={viewingJD ? `${viewingJD.name} - 职位描述(JD)详情` : '职位描述(JD)详情'}
        open={viewModalVisible}
        onCancel={() => { setViewModalVisible(false); setViewingJD(null); }}
        footer={[<Button key="close" onClick={() => { setViewModalVisible(false); setViewingJD(null); }}>关闭</Button>]}
        width={900}
      >
        {viewingJD && (
          <div>
            <pre style={preStyle}>{viewingJD.content}</pre>
          </div>
        )}
      </Modal>

      <Modal
        title={isCreating ? '创建职位描述(JD)' : (editingJD ? `${editingJD.name} - 编辑职位描述(JD)` : '编辑职位描述(JD)')}
        open={editModalVisible}
        onOk={() => editForm.submit()}
        onCancel={() => { setEditModalVisible(false); setEditingJD(null); editForm.resetFields(); }}
        width={900}
      >
        <Form form={editForm} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="name"
            label="职位描述(JD)名称"
            rules={[
              { required: true, message: '请输入职位描述(JD)名称' },
              { pattern: /^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/, message: '名称只能包含字母、数字、中文、下划线和横线' }
            ]}
          >
            <Input placeholder="请输入职位描述(JD)名称，如：Java开发、前端工程师等" disabled={!isCreating} />
          </Form.Item>

          <Form.Item
            name="content"
            style={{ marginBottom: 0 }}
            rules={[{ required: true, message: '请输入职位描述(JD)内容' }]}
          >
            <Input.TextArea
              rows={15}
              placeholder="请输入 Markdown 格式的职位描述(JD)内容..."
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <ConfirmModal
        open={deleteModalVisible}
        title="确认删除"
        message={`确定要删除职位描述(JD) "${deletingJD?.name}" 吗？删除后无法恢复。`}
        confirmText="确定删除"
        type="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteModalVisible(false)
          setDeletingJD(null)
        }}
      />
    </div>
  )
}