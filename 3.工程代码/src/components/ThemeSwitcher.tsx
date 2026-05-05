import { useState } from 'react'
import {
  Dropdown,
  Button,
  Space,
  Tooltip,
  ColorPicker,
} from 'antd'
import {
  SunOutlined,
  MoonOutlined,
  SettingOutlined,
  CheckOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useThemeStore } from '@/stores/themeStore'
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

export default function ThemeSwitcher() {
  const { config, setColor, setMode, setCustomPrimaryColor } = useThemeStore()
  const [open, setOpen] = useState(false)
  // pickerKey 用于控制 ColorPicker 重建：每次打开面板时递增，确保用最新的 store 颜色初始化
  const [pickerKey, setPickerKey] = useState(0)
  const isDark = config.mode === 'dark'
  const isCustomColor = config.color === 'custom'

  const handleColorSelect = async (colorValue: ThemeColor) => {
    await setColor(colorValue)
  }

  // onChangeComplete: 只在拖拽/选择结束时触发，持久化到 store
  const handleColorChangeComplete = async (color: any) => {
    const hexColor = color.toHexString()
    const hsb = color.toHsb()
    await setCustomPrimaryColor(hexColor, {
      h: hsb.h,
      s: hsb.s,
      b: hsb.b,
      a: hsb.a,
    })
  }

  const handleDropdownOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setPickerKey(k => k + 1)
    }
    setOpen(isOpen)
  }

  // 自定义颜色按钮的显示颜色：优先用 store 中的值
  const displayColor = isCustomColor ? config.customPrimaryColor : undefined

  const dropdownItems = [
    {
      key: 'mode',
      label: (
        <div style={{ padding: '8px 0' }}>
          <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
            模式切换
          </div>
          <Space>
            <Button
              type={isDark ? 'default' : 'primary'}
              size="small"
              icon={<SunOutlined />}
              onClick={async () => await setMode('light')}
            >
              白天
            </Button>
            <Button
              type={isDark ? 'primary' : 'default'}
              size="small"
              icon={<MoonOutlined />}
              onClick={async () => await setMode('dark')}
            >
              黑夜
            </Button>
          </Space>
        </div>
      ),
    },
    { type: 'divider' as const },
    {
      key: 'color',
      label: (
        <div style={{ padding: '8px 0' }}>
          <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
            主题颜色
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {COLOR_OPTIONS.map((opt) => (
              <Tooltip key={opt.value} title={opt.label}>
                <button
                  onClick={async () => await handleColorSelect(opt.value)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: (!isCustomColor && config.color === opt.value) ? `2px solid ${opt.color}` : '2px solid transparent',
                    background: opt.color,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    transform: (!isCustomColor && config.color === opt.value) ? 'scale(1.1)' : 'scale(1)',
                    boxShadow: (!isCustomColor && config.color === opt.value) ? `0 0 8px ${opt.color}80` : '0 2px 4px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {!isCustomColor && config.color === opt.value && (
                    <CheckOutlined style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }} />
                  )}
                </button>
              </Tooltip>
            ))}
            <Tooltip title="自定义颜色">
              <div style={{ position: 'relative' }}>
                <ColorPicker
                  key={pickerKey}
                  size="small"
                  defaultValue={displayColor}
                  onChangeComplete={handleColorChangeComplete}
                >
                  <button
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      border: isCustomColor ? `2px solid ${config.customPrimaryColor}` : '2px dashed #d9d9d9',
                      background: isCustomColor ? config.customPrimaryColor : '#fafafa',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      transform: isCustomColor ? 'scale(1.1)' : 'scale(1)',
                      boxShadow: isCustomColor ? `0 0 8px ${config.customPrimaryColor}80` : '0 2px 4px rgba(0,0,0,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isCustomColor ? (
                      <CheckOutlined style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }} />
                    ) : (
                      <PlusOutlined style={{ color: '#999', fontSize: 14 }} />
                    )}
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
    <Dropdown
      menu={{ items: dropdownItems }}
      trigger={['click']}
      open={open}
      onOpenChange={handleDropdownOpenChange}
      placement="bottomRight"
      overlayStyle={{ width: 280 }}
    >
      <Tooltip title="主题设置">
        <Button
          type="text"
          icon={<SettingOutlined />}
          style={{
            fontSize: 18,
            borderRadius: '50%',
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      </Tooltip>
    </Dropdown>
  )
}
