import { Modal, Button } from 'antd'
import { useThemeStore } from '@/stores/themeStore'

interface ConfirmModalProps {
  open: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmLoading?: boolean
  type?: 'warning' | 'danger' | 'info'
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

const WarningIcon = ({ color }: { color: string }) => (
  <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 4L2 44h44L24 4z" fill={color} opacity="0.15"/>
    <path d="M24 4L2 44h44L24 4z" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
    <path d="M24 18v12" stroke={color} strokeWidth="3" strokeLinecap="round"/>
    <circle cx="24" cy="36" r="2" fill={color}/>
  </svg>
)

const DangerIcon = ({ color }: { color: string }) => (
  <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="22" fill={color} opacity="0.12"/>
    <circle cx="24" cy="24" r="22" stroke={color} strokeWidth="2"/>
    <path d="M18 18l12 12M30 18l-12 12" stroke={color} strokeWidth="3" strokeLinecap="round"/>
  </svg>
)

const InfoIcon = ({ color }: { color: string }) => (
  <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="22" fill={color} opacity="0.12"/>
    <circle cx="24" cy="24" r="22" stroke={color} strokeWidth="2"/>
    <path d="M24 16v4" stroke={color} strokeWidth="3" strokeLinecap="round"/>
    <circle cx="24" cy="28" r="2" fill={color}/>
  </svg>
)

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  confirmLoading = false,
  type = 'warning',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { colors } = useThemeStore()

  const iconColorMap = {
    warning: '#faad14',
    danger: '#ff4d4f',
    info: colors.primary,
  }

  const iconMap = {
    warning: <WarningIcon color={iconColorMap.warning} />,
    danger: <DangerIcon color={iconColorMap.danger} />,
    info: <InfoIcon color={iconColorMap.info} />,
  }

  const titleMap = {
    warning: title || '警告确认',
    danger: title || '危险操作',
    info: title || '信息确认',
  }

  const okButtonPropsMap = {
    warning: { style: { background: '#faad14', borderColor: '#faad14' } },
    danger: { danger: true },
    info: { type: 'primary' as const },
  }

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width={480}
      closable={true}
      centered
    >
      <div style={{ display: 'flex', gap: 20, paddingTop: 8 }}>
        <div style={{ flexShrink: 0 }}>
          {iconMap[type]}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ 
            margin: '0 0 12px 0', 
            fontSize: 18, 
            fontWeight: 600, 
            color: colors.textPrimary 
          }}>
            {titleMap[type]}
          </h3>
          <p style={{ 
            margin: 0, 
            fontSize: 14, 
            lineHeight: 1.8, 
            color: colors.textSecondary 
          }}>
            {message}
          </p>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: 12, 
            marginTop: 24 
          }}>
            <Button onClick={onCancel}>
              {cancelText}
            </Button>
            <Button 
              type={type === 'danger' ? 'primary' : 'default'}
              danger={type === 'danger'}
              loading={confirmLoading}
              onClick={onConfirm}
              style={type === 'warning' ? { 
                background: '#faad14', 
                borderColor: '#faad14', 
                color: '#fff' 
              } : undefined}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}