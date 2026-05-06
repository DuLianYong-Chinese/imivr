import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Modal, Form, Input, Tag, App, Radio, Upload, Tabs, Space } from 'antd'
import { ArrowLeftOutlined, EditOutlined, EyeOutlined, UploadOutlined, UpOutlined, DownOutlined } from '@ant-design/icons'
import type { UploadFile, RcFile } from 'antd/es/upload/interface'
import { readFile, writeFile, exists, createDirectory } from '@/core/filesystem'
import { useThemeStore } from '@/stores/themeStore'

const { TextArea } = Input

// 固定5个难度等级
const DIFFICULTY_LEVELS = [
  { key: 'L1', label: 'L1-初级', folder: 'L1-初级', color: 'green' },
  { key: 'L2', label: 'L2-中级', folder: 'L2-中级', color: 'blue' },
  { key: 'L3', label: 'L3-高级', folder: 'L3-高级', color: 'orange' },
  { key: 'L4', label: 'L4-专家', folder: 'L4-专家', color: 'red' },
  { key: 'L5', label: 'L5-大神', folder: 'L5-大神', color: 'purple' },
]

interface QuestionBankItem {
  key: string
  label: string
  folder: string
  color: string
  content: string
  exists: boolean
}

// 搜索高亮组件
interface SearchHighlighterProps {
  content: string
  searchText: string
  currentIndex: number
  onMatchesChange: (count: number) => void
  shouldScroll: boolean
  colors: any
}

function SearchHighlighter({ content, searchText, currentIndex, onMatchesChange, shouldScroll, colors }: SearchHighlighterProps) {
  const containerRef = useRef<HTMLPreElement>(null)
  const [matches, setMatches] = useState<number[]>([])
  const prevShouldScroll = useRef(shouldScroll)
  
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

  useEffect(() => {
    if (!searchText || !content) {
      setMatches([])
      onMatchesChange(0)
      return
    }

    const indices: number[] = []
    const lowerContent = content.toLowerCase()
    const lowerSearch = searchText.toLowerCase()
    let index = 0

    while ((index = lowerContent.indexOf(lowerSearch, index)) !== -1) {
      indices.push(index)
      index += lowerSearch.length
    }

    setMatches(indices)
    onMatchesChange(indices.length)
  }, [content, searchText, onMatchesChange])

  useEffect(() => {
    // 只在 shouldScroll 从 false 变为 true 时才滚动（即点击上下按钮时）
    if (shouldScroll && !prevShouldScroll.current && matches.length > 0 && currentIndex >= 0 && currentIndex < matches.length && containerRef.current) {
      const highlightElements = containerRef.current.querySelectorAll('.search-highlight')
      if (highlightElements[currentIndex]) {
        highlightElements[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
    prevShouldScroll.current = shouldScroll
  }, [shouldScroll, currentIndex, matches])

  if (!searchText || matches.length === 0) {
    return <pre ref={containerRef} style={preStyle}>{content}</pre>
  }

  // 构建高亮内容
  const parts: JSX.Element[] = []
  let lastIndex = 0
  const lowerContent = content.toLowerCase()
  const lowerSearch = searchText.toLowerCase()

  matches.forEach((matchIndex, i) => {
    // 添加匹配前的文本
    if (matchIndex > lastIndex) {
      parts.push(<span key={`text-${i}`}>{content.substring(lastIndex, matchIndex)}</span>)
    }

    // 添加高亮匹配的文本
    const isCurrent = i === currentIndex
    parts.push(
      <span
        key={`highlight-${i}`}
        className="search-highlight"
        style={{
          backgroundColor: isCurrent ? '#52c41a' : '#d9f7be',
          color: isCurrent ? '#fff' : '#389e0d',
          padding: '2px 4px',
          borderRadius: 4,
          fontWeight: isCurrent ? 'bold' : 'normal',
        }}
      >
        {content.substring(matchIndex, matchIndex + searchText.length)}
      </span>
    )

    lastIndex = matchIndex + searchText.length
  })

  // 添加剩余文本
  if (lastIndex < content.length) {
    parts.push(<span key="text-end">{content.substring(lastIndex)}</span>)
  }

  return <pre ref={containerRef} style={preStyle}>{parts}</pre>
}

export default function QuestionBank() {
  const { message } = App.useApp()
  const { colors } = useThemeStore()
  const { jobRole } = useParams<{ jobRole: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [banks, setBanks] = useState<QuestionBankItem[]>([])
  
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

  // 查看弹窗
  const [viewModalVisible, setViewModalVisible] = useState(false)
  const [viewingBank, setViewingBank] = useState<QuestionBankItem | null>(null)
  const [viewSearchText, setViewSearchText] = useState('')
  const [viewMatchCount, setViewMatchCount] = useState(0)
  const [viewCurrentMatch, setViewCurrentMatch] = useState(0)
  const [viewShouldScroll, setViewShouldScroll] = useState(false)

  // 编辑弹窗
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingBank, setEditingBank] = useState<QuestionBankItem | null>(null)
  const [editForm] = Form.useForm()
  const [uploadMode, setUploadMode] = useState<'manual' | 'file'>('manual')
  const [uploadAction, setUploadAction] = useState<'append' | 'overwrite'>('append')
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [editSearchInput, setEditSearchInput] = useState('')
  const [editSearchText, setEditSearchText] = useState('')
  const [editMatchCount, setEditMatchCount] = useState(0)
  const [editCurrentMatch, setEditCurrentMatch] = useState(0)
  const textAreaRef = useRef<any>(null)

  useEffect(() => {
    loadBanks()
  }, [jobRole])

  const loadBanks = async () => {
    if (!jobRole) return
    setLoading(true)
    try {
      const loadedBanks: QuestionBankItem[] = []
      for (const level of DIFFICULTY_LEVELS) {
        const folderPath = `${jobRole}/question-bank/${level.folder}`
        const filePath = `${folderPath}/questions.md`

        await createDirectory(folderPath)

        let content = ''
        const fileExists = await exists(filePath)
        if (fileExists) {
          content = await readFile(filePath)
        }

        loadedBanks.push({
          key: level.key,
          label: level.label,
          folder: level.folder,
          color: level.color,
          content,
          exists: fileExists,
        })
      }
      setBanks(loadedBanks)
    } catch (error) {
      message.error('加载题库失败')
    } finally {
      setLoading(false)
    }
  }

  const handleView = (bank: QuestionBankItem) => {
    setViewingBank(bank)
    setViewSearchInput('')
    setViewSearchText('')
    setViewMatchCount(0)
    setViewCurrentMatch(0)
    setViewShouldScroll(false)
    setViewModalVisible(true)
  }

  // 查看弹窗执行搜索
  const [viewSearchInput, setViewSearchInput] = useState('')

  const executeViewSearch = useCallback(() => {
    setViewSearchText(viewSearchInput)
    setViewCurrentMatch(0)
    setViewShouldScroll(false)
  }, [viewSearchInput])

  // 查看弹窗的导航处理
  const handleViewNavigate = useCallback((direction: 'up' | 'down') => {
    if (viewMatchCount === 0) return

    let newIndex: number
    if (direction === 'up') {
      newIndex = viewCurrentMatch <= 0 ? viewMatchCount - 1 : viewCurrentMatch - 1
    } else {
      newIndex = viewCurrentMatch >= viewMatchCount - 1 ? 0 : viewCurrentMatch + 1
    }
    setViewCurrentMatch(newIndex)
    setViewShouldScroll(true)

    // 滚动完成后重置状态
    setTimeout(() => setViewShouldScroll(false), 100)
  }, [viewCurrentMatch, viewMatchCount])

  // 编辑弹窗执行搜索
  const executeEditSearch = useCallback(() => {
    setEditSearchText(editSearchInput)
    setEditCurrentMatch(0)
  }, [editSearchInput])

  const handleEdit = (bank: QuestionBankItem) => {
    setEditingBank(bank)
    editForm.setFieldsValue({ content: bank.content })
    setUploadMode('manual')
    setUploadAction('append')
    setFileList([])
    setEditSearchInput('')
    setEditSearchText('')
    setEditMatchCount(0)
    setEditCurrentMatch(0)
    setEditModalVisible(true)
  }

  const handleSave = async (values: any) => {
    if (!jobRole || !editingBank) return

    try {
      const folderPath = `${jobRole}/question-bank/${editingBank.folder}`
      const filePath = `${folderPath}/questions.md`

      let newContent = values.content || ''

      if (uploadMode === 'file' && fileList.length > 0) {
        const file = fileList[0]
        const fileObj = (file.originFileObj || file) as RcFile
        if (fileObj) {
          const text = await fileObj.text()
          if (uploadAction === 'append' && editingBank.content) {
            newContent = editingBank.content + '\n\n---\n\n' + text
          } else {
            newContent = text
          }
        }
      }

      const success = await writeFile(filePath, newContent)
      if (!success) {
        message.error('保存失败，请重试')
        return
      }
      message.success('保存成功')
      setEditModalVisible(false)
      setEditingBank(null)
      editForm.resetFields()
      setFileList([])
      loadBanks()
    } catch (error: any) {
      message.error(error.message || '保存失败')
    }
  }

  const beforeUpload = (file: UploadFile) => {
    const isMarkdown = file.type === 'text/markdown' || file.name?.endsWith('.md')
    if (!isMarkdown) {
      message.error('只支持上传 Markdown (.md) 文件')
      return Upload.LIST_IGNORE
    }
    setFileList([file])
    return false
  }



  // 计算编辑模式匹配数
  const calculateEditMatches = useCallback(() => {
    if (!textAreaRef.current || !editSearchText) {
      setEditMatchCount(0)
      return []
    }

    const textarea = textAreaRef.current.resizableTextArea?.textArea || textAreaRef.current
    const content = textarea.value
    const lowerContent = content.toLowerCase()
    const lowerSearch = editSearchText.toLowerCase()

    const indices: number[] = []
    let index = 0
    while ((index = lowerContent.indexOf(lowerSearch, index)) !== -1) {
      indices.push(index)
      index += lowerSearch.length
    }

    setEditMatchCount(indices.length)
    return indices
  }, [editSearchText])

  // 定位到指定匹配项并滚动到可视区域
  const navigateToEditMatch = useCallback((matchIndices: number[], targetIndex: number) => {
    if (!textAreaRef.current || matchIndices.length === 0 || targetIndex < 0 || targetIndex >= matchIndices.length) return

    const textarea = textAreaRef.current.resizableTextArea?.textArea || textAreaRef.current
    const matchIndex = matchIndices[targetIndex]

    // 先设置选区
    textarea.setSelectionRange(matchIndex, matchIndex + editSearchText.length)
    textarea.focus()

    // 计算滚动位置，使匹配内容居中显示
    const textBeforeMatch = textarea.value.substring(0, matchIndex)
    const linesBeforeMatch = textBeforeMatch.split('\n').length
    const lineHeight = 20 // 估算行高
    const scrollTop = Math.max(0, (linesBeforeMatch - 5) * lineHeight) // 提前5行滚动，让内容居中

    textarea.scrollTop = scrollTop
  }, [editSearchText])

  // 只在点击上下按钮时定位，不监听 editCurrentMatch 的变化
  const handleEditNavigate = useCallback((direction: 'up' | 'down') => {
    // 先计算匹配
    const indices = calculateEditMatches()
    if (indices.length === 0) return

    let newIndex: number
    if (direction === 'up') {
      newIndex = editCurrentMatch <= 0 ? indices.length - 1 : editCurrentMatch - 1
    } else {
      newIndex = editCurrentMatch >= indices.length - 1 ? 0 : editCurrentMatch + 1
    }
    setEditCurrentMatch(newIndex)

    // 立即定位到新位置
    navigateToEditMatch(indices, newIndex)
  }, [editCurrentMatch, calculateEditMatches, navigateToEditMatch])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flexShrink: 0, padding: '24px 24px 0 24px' }}>
      <div style={{ marginBottom: 24, padding: '16px 0', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/workspaces/${jobRole}`)}>返回</Button>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 500, color: colors.textPrimary }}>题库管理</h2>
        </div>
      </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px 24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {banks.map((bank) => (
          <Card
            key={bank.key}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag color={bank.color}>{bank.label}</Tag>
                {bank.exists && <Tag color="success">已创建</Tag>}
              </div>
            }
            actions={[
              <Button key="view" type="link" icon={<EyeOutlined />} onClick={() => handleView(bank)}>查看</Button>,
              <Button key="edit" type="link" icon={<EditOutlined />} onClick={() => handleEdit(bank)}>编辑</Button>,
            ]}
          >
            <div style={{ minHeight: 60 }}>
              {bank.exists ? (
                <div>
                  <p style={{ color: colors.textSecondary, marginBottom: 8 }}>文件路径: {jobRole}/question-bank/{bank.folder}/questions.md</p>
                  <p style={{ color: colors.textTertiary, fontSize: 12 }}>内容长度: {bank.content.length} 字符</p>
                </div>
              ) : (
                <p style={{ color: colors.textTertiary }}>暂无内容，点击编辑添加题目</p>
              )}
            </div>
          </Card>
        ))}
      </div>
      </div>

      {/* 查看弹窗 */}
      <Modal
        title={viewingBank ? `${viewingBank.label} - 题目内容` : '题目内容'}
        open={viewModalVisible}
        onCancel={() => { setViewModalVisible(false); setViewingBank(null); }}
        footer={[<Button key="close" onClick={() => { setViewModalVisible(false); setViewingBank(null); }}>关闭</Button>]}
        width={900}
      >
        {viewingBank && (
          <div>
            {/* 搜索栏 */}
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Input
                placeholder="搜索内容..."
                value={viewSearchInput}
                onChange={(e) => setViewSearchInput(e.target.value)}
                onPressEnter={executeViewSearch}
                style={{ width: 300 }}
                allowClear
              />
              <Button type="primary" onClick={executeViewSearch}>搜索</Button>
              {viewMatchCount > 0 && (
                <Space>
                  <span style={{ color: colors.textSecondary, fontSize: 12 }}>{viewCurrentMatch + 1}/{viewMatchCount}</span>
                  <Button
                    icon={<UpOutlined />}
                    size="small"
                    onClick={() => handleViewNavigate('up')}
                  />
                  <Button
                    icon={<DownOutlined />}
                    size="small"
                    onClick={() => handleViewNavigate('down')}
                  />
                </Space>
              )}
            </div>

            {viewingBank.exists ? (
              <SearchHighlighter
                content={viewingBank.content}
                searchText={viewSearchText}
                currentIndex={viewCurrentMatch}
                onMatchesChange={setViewMatchCount}
                shouldScroll={viewShouldScroll}
                colors={colors}
              />
            ) : (
              <p style={{ color: colors.textTertiary, textAlign: 'center', padding: 40 }}>暂无内容</p>
            )}
          </div>
        )}
      </Modal>

      {/* 编辑弹窗 */}
      <Modal
        title={editingBank ? `${editingBank.label} - 编辑题目` : '编辑题目'}
        open={editModalVisible}
        onOk={() => editForm.submit()}
        onCancel={() => { setEditModalVisible(false); setEditingBank(null); editForm.resetFields(); setFileList([]); }}
        width={900}
      >
        <Form form={editForm} layout="vertical" onFinish={handleSave}>
          <Tabs activeKey={uploadMode} onChange={(key) => setUploadMode(key as 'manual' | 'file')} items={[
            {
              key: 'manual',
              label: '直接编辑',
              children: (
                <div>
                  {/* 搜索栏 */}
                  <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Input
                      placeholder="搜索内容..."
                      value={editSearchInput}
                      onChange={(e) => setEditSearchInput(e.target.value)}
                      onPressEnter={executeEditSearch}
                      style={{ width: 280 }}
                      allowClear
                    />
                    <Button type="primary" onClick={executeEditSearch} size="small">搜索</Button>
                    {editMatchCount > 0 && (
                      <span style={{ color: colors.textSecondary, fontSize: 12, margin: '0 4px' }}>
                        {editCurrentMatch + 1}/{editMatchCount}
                      </span>
                    )}
                    {editMatchCount > 0 && (
                      <>
                        <Button
                          icon={<UpOutlined />}
                          size="small"
                          onClick={() => handleEditNavigate('up')}
                        />
                        <Button
                          icon={<DownOutlined />}
                          size="small"
                          onClick={() => handleEditNavigate('down')}
                        />
                      </>
                    )}
                  </div>
                  <Form.Item name="content" style={{ marginBottom: 0 }}>
                    <TextArea
                      ref={textAreaRef}
                      rows={15}
                      placeholder="请输入 Markdown 格式的题目内容..."
                      style={{ fontFamily: 'monospace' }}
                    />
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'file',
              label: '上传文件',
              children: (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <Radio.Group value={uploadAction} onChange={(e) => setUploadAction(e.target.value)}>
                      <Radio.Button value="append">追加到现有内容</Radio.Button>
                      <Radio.Button value="overwrite">覆盖现有内容</Radio.Button>
                    </Radio.Group>
                  </div>
                  <Upload accept=".md,text/markdown" beforeUpload={beforeUpload} fileList={fileList} onRemove={() => setFileList([])} maxCount={1}>
                    <Button icon={<UploadOutlined />}>选择 Markdown 文件</Button>
                  </Upload>
                  <p style={{ color: colors.textTertiary, marginTop: 8, fontSize: 12 }}>支持 .md 格式的 Markdown 文件</p>
                </div>
              ),
            },
          ]} />
        </Form>
      </Modal>
    </div>
  )
}
