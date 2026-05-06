import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Tabs, App, Spin, Tag } from 'antd'
import { ArrowLeftOutlined, PlayCircleOutlined, TeamOutlined, FileTextOutlined, ThunderboltOutlined } from '@ant-design/icons'
import type { WorkspaceDetail } from '@/types'
import { getWorkspaceDetail } from '@/modules/workspace'
import { formatDate } from '@/utils/date'
import QuestionBankCards from '@/components/QuestionBankCards'
import JDManagementCards from '@/components/JDManagementCards'
import { useThemeStore } from '@/stores/themeStore'

const presetIcons: Record<string, { icon: string; bg: string }> = {
  frontend_dev: { icon: '💻', bg: '#e6f7ff' },
  backend_dev: { icon: '🔧', bg: '#e6f7ff' },
  algorithm_eng: { icon: '🧠', bg: '#e6f7ff' },
  test_eng: { icon: '🔍', bg: '#e6f7ff' },
  data_dev: { icon: '📊', bg: '#e6f7ff' },
  product_mgr: { icon: '📱', bg: '#f6ffed' },
  ui_designer: { icon: '🎨', bg: '#f6ffed' },
}

export default function WorkspaceDetail() {
  const { message } = App.useApp()
  const { colors } = useThemeStore()
  const { jobRole } = useParams<{ jobRole: string }>()
  const navigate = useNavigate()
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWorkspace()
  }, [jobRole])

  const loadWorkspace = async () => {
    if (!jobRole) return
    setLoading(true)
    try {
      const data = await getWorkspaceDetail(jobRole)
      setWorkspace(data)
    } catch (error) {
      message.error('加载工作空间失败')
    } finally {
      setLoading(false)
    }
  }

  const onDataChange = useCallback(() => {
    loadWorkspace()
  }, [jobRole])

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin size="large" /></div>
  }

  if (!workspace) {
    return <div style={{ padding: 24, textAlign: 'center', color: colors.textSecondary }}>加载中...</div>
  }

  const preset = presetIcons[workspace.job_role] || { icon: '📋', bg: colors.primaryBg }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flexShrink: 0, padding: '24px 24px 0 24px' }}>
      <div style={{
        marginBottom: 20,
        background: colors.surface,
        borderRadius: 14,
        border: `1px solid ${colors.border}`,
        overflow: 'hidden',
        boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
        height: 77,
      }}>
        <div style={{
          height: 4,
          background: `linear-gradient(90deg, ${colors.primary}, ${colors.primary}60, transparent)`,
        }} />
        <div style={{
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          height: 73,
        }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/workspaces')} style={{ borderRadius: 8 }} size="small">
            返回
          </Button>

          <div style={{ width: 1, height: 28, background: colors.border }} />

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: preset.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, lineHeight: 1,
            }}>
              {preset.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary, lineHeight: 1.3 }}>{workspace.workspace_name}</div>
              <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tag style={{ borderRadius: 6, fontSize: 11, padding: '0 8px', margin: 0, background: colors.primaryBg, color: colors.primary, border: 'none', fontWeight: 600 }}>
                  {workspace.category}
                </Tag>
                <span style={{ fontSize: 12, color: colors.textTertiary }}>{workspace.job_role}</span>
              </div>
            </div>

            <div style={{ width: 1, height: 28, background: colors.border }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: colors.primary }}>{workspace.interview_count || 0}</div>
                <div style={{ fontSize: 11, color: colors.textTertiary }}>面试</div>
              </div>
              <div style={{ width: 1, height: 28, background: colors.border }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#722ed1' }}>{workspace.question_stats?.total || 0}</div>
                <div style={{ fontSize: 11, color: colors.textTertiary }}>题库</div>
              </div>
              <div style={{ width: 1, height: 28, background: colors.border }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fa8c16' }}>{workspace.question_stats?.jd_count || 0}</div>
                <div style={{ fontSize: 11, color: colors.textTertiary }}>职位描述(JD)</div>
              </div>
            </div>
          </div>

          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={() => navigate(`/workspaces/${jobRole}/interviews`)}
            style={{ borderRadius: 8, height: 36, fontWeight: 700, fontSize: 14 }}
          >
            开始面试
          </Button>
        </div>
      </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', padding: '0 24px 24px 24px' }}>
      <div style={{
        background: colors.surface, borderRadius: 14, border: `1px solid ${colors.border}`,
        overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
        height: '100%', display: 'flex', flexDirection: 'column',
      }}>
        <Tabs
          className="tabs-flex-layout"
          style={{ padding: '0px 20px 20px', height: '100%', display: 'flex', flexDirection: 'column' }}
          items={[
            {
              key: 'jd',
              label: <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TeamOutlined />职位描述(JD)</span>,
              children: jobRole ? <JDManagementCards jobRole={jobRole} onDataChange={onDataChange} /> : null,
              style: { flex: 1, overflowY: 'auto' },
            },
            {
              key: 'questions',
              label: <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileTextOutlined />题库管理</span>,
              children: jobRole ? <QuestionBankCards jobRole={jobRole} onDataChange={onDataChange} /> : null,
              style: { flex: 1, overflowY: 'auto' },
            },
          ]}
        />
      </div>
      </div>
    </div>
  )
}