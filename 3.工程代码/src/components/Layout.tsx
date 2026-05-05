import { Outlet, useNavigate, useLocation, Link, useParams } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { SettingOutlined, SunOutlined, MoonOutlined, CheckOutlined, PlusOutlined, BgColorsOutlined } from '@ant-design/icons'
import { Dropdown, Button, Space, Tooltip, ColorPicker, Breadcrumb } from 'antd'
import LogoSvg from './LogoSvg'
import { useThemeStore } from '@/stores/themeStore'
import { listWorkspaces } from '@/modules/workspace'
import type { ThemeColor } from '@/types'

const COLOR_OPTIONS: { value: ThemeColor; label: string; color: string }[] = [
  { value: 'red', label: '赤', color: '#cf1322' },
  { value: 'orange', label: '橙', color: '#fa8c16' },
  { value: 'yellow', label: '黄', color: '#fadb14' },
  { value: 'green', label: '绿', color: '#52c41a' },
  { value: 'cyan', label: '青', color: '#13c2c2' },
  { value: 'blue', label: '蓝', color: '#1677ff' },
  { value: 'purple', label: '紫', color: '#722ed1' },
]

const breadcrumbMap: Record<string, string> = {
  '/': '首页',
  '/workspaces': '工作空间',
  '/settings': '系统设置',
}

let workspaceNameCache: Record<string, string> = {}

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [workspaceNames, setWorkspaceNames] = useState<Record<string, string>>({})
  const { config, colors, setColor, setMode, setCustomPrimaryColor } = useThemeStore()
  const [pickerKey, setPickerKey] = useState(0)
  const isDark = config.mode === 'dark'
  const isCustomColor = config.color === 'custom'

  useEffect(() => {
    loadWorkspaceNames()
  }, [location.pathname])

  const loadWorkspaceNames = async () => {
    const pathSnippets = location.pathname.split('/').filter(i => i)
    if (pathSnippets.length >= 2 && pathSnippets[0] === 'workspaces') {
      const jobRole = pathSnippets[1]
      if (workspaceNameCache[jobRole]) {
        setWorkspaceNames({ [jobRole]: workspaceNameCache[jobRole] })
        return
      }
      try {
        const workspaces = await listWorkspaces()
        const nameMap: Record<string, string> = {}
        workspaces.forEach(ws => {
          nameMap[ws.job_role] = ws.workspace_name
          workspaceNameCache[ws.job_role] = ws.workspace_name
        })
        setWorkspaceNames(nameMap)
      } catch (error) {
        console.error('加载工作空间名称失败:', error)
      }
    }
  }

  const breadcrumbs = useMemo(() => {
    const pathSnippets = location.pathname.split('/').filter(i => i)
    const items = [
      { title: <Link to="/">我是面试官</Link>, key: 'home' }
    ]
    let currentPath = ''
    pathSnippets.forEach((snippet, index) => {
      currentPath += `/${snippet}`
      const isLast = index === pathSnippets.length - 1
      let title = breadcrumbMap[currentPath]
      if (!title) {
        if (snippet === 'workspaces') title = '工作空间'
        else if (snippet === 'settings') title = '系统设置'
        else if (snippet === 'interviews') title = '面试记录'
        else if (snippet === 'questions') title = '题库管理'
        else if (index === 1 && pathSnippets[0] === 'workspaces' && workspaceNames[snippet]) {
          title = workspaceNames[snippet]
        }
        else title = snippet
      }
      if (isLast) {
        items.push({ title: title as any, key: currentPath })
      } else {
        items.push({ title: <Link to={currentPath}>{title}</Link>, key: currentPath })
      }
    })
    return items
  }, [location.pathname, workspaceNames])

  const handleColorChangeComplete = async (color: any) => {
    const hexColor = color.toHexString()
    const hsb = color.toHsb()
    await setCustomPrimaryColor(hexColor, { h: hsb.h, s: hsb.s, b: hsb.b, a: hsb.a })
  }

  const displayColor = isCustomColor ? config.customPrimaryColor : undefined

  const themeItems = [
    {
      key: 'mode',
      label: (
        <div style={{ padding: '8px 0' }}>
          <div style={{ marginBottom: 8, fontSize: 13, color: colors.textTertiary }}>模式切换</div>
          <Space>
            <Button type={isDark ? 'default' : 'primary'} size="small" icon={<SunOutlined />} onClick={async () => await setMode('light')}>白天</Button>
            <Button type={isDark ? 'primary' : 'default'} size="small" icon={<MoonOutlined />} onClick={async () => await setMode('dark')}>黑夜</Button>
          </Space>
        </div>
      ),
    },
    { type: 'divider' as const },
    {
      key: 'color',
      label: (
        <div style={{ padding: '8px 0' }}>
          <div style={{ marginBottom: 8, fontSize: 13, color: colors.textTertiary }}>主题颜色</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {COLOR_OPTIONS.map((opt) => (
              <Tooltip key={opt.value} title={opt.label}>
                <button
                  onClick={async () => await setColor(opt.value)}
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    border: (!isCustomColor && config.color === opt.value) ? `2px solid ${opt.color}` : '2px solid transparent',
                    background: opt.color, cursor: 'pointer', transition: 'all 0.2s',
                    transform: (!isCustomColor && config.color === opt.value) ? 'scale(1.1)' : 'scale(1)',
                    boxShadow: (!isCustomColor && config.color === opt.value) ? `0 0 8px ${opt.color}80` : '0 2px 4px rgba(0,0,0,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {!isCustomColor && config.color === opt.value && <CheckOutlined style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }} />}
                </button>
              </Tooltip>
            ))}
            <Tooltip title="自定义颜色">
              <div style={{ position: 'relative' }}>
                <ColorPicker key={pickerKey} size="small" defaultValue={displayColor} onChangeComplete={handleColorChangeComplete}>
                  <button style={{
                    width: 32, height: 32, borderRadius: '50%',
                    border: isCustomColor ? `2px solid ${config.customPrimaryColor}` : '2px dashed #d9d9d9',
                    background: isCustomColor ? config.customPrimaryColor : '#fafafa',
                    cursor: 'pointer', transition: 'all 0.2s',
                    transform: isCustomColor ? 'scale(1.1)' : 'scale(1)',
                    boxShadow: isCustomColor ? `0 0 8px ${config.customPrimaryColor}80` : '0 2px 4px rgba(0,0,0,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isCustomColor ? <CheckOutlined style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }} /> : <PlusOutlined style={{ color: '#999', fontSize: 14 }} />}
                  </button>
                </ColorPicker>
              </div>
            </Tooltip>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div style={{ height: '100vh', background: colors.background, overflow: 'hidden' }}>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56,
        background: colors.surface, borderBottom: `1px solid ${colors.border}`,
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <LogoSvg style={{ marginRight: 0 }} />
            <span style={{ fontSize: 17, fontWeight: 800, fontFamily: '"Noto Serif SC", serif', letterSpacing: 2, color: colors.primary }}>我是面试官</span>
          </Link>
          <Breadcrumb items={breadcrumbs} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tooltip title="系统设置">
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={() => navigate('/settings')}
              style={{ fontSize: 18, borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            />
          </Tooltip>
          <Dropdown
            menu={{ items: themeItems }}
            trigger={['click']}
            placement="bottomRight"
            overlayStyle={{ width: 280 }}
          >
            <Tooltip title="主题设置">
              <Button
                type="text"
                icon={<BgColorsOutlined />}
                style={{ fontSize: 18, borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              />
            </Tooltip>
          </Dropdown>
        </div>
      </div>

      <div style={{ marginTop: 56, height: 'calc(100vh - 56px)', background: colors.background, overflow: 'hidden' }}>
        <Outlet />
      </div>
    </div>
  )
}