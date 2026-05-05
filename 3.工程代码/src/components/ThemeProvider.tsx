import { useEffect, useMemo } from 'react'
import { ConfigProvider, theme, App as AntApp } from 'antd'
import { useThemeStore } from '@/stores/themeStore'
import type { ThemeColors } from '@/types'

interface ThemeProviderProps {
  children: React.ReactNode
}

function applyThemeColors(colors: ThemeColors) {
  const root = document.documentElement
  
  root.style.setProperty('--color-primary', colors.primary)
  root.style.setProperty('--color-primary-hover', colors.primaryHover)
  root.style.setProperty('--color-primary-active', colors.primaryActive)
  root.style.setProperty('--color-primary-bg', colors.primaryBg)
  root.style.setProperty('--color-success', colors.success)
  root.style.setProperty('--color-warning', colors.warning)
  root.style.setProperty('--color-error', colors.error)
  root.style.setProperty('--color-info', colors.info)
  root.style.setProperty('--color-text-primary', colors.textPrimary)
  root.style.setProperty('--color-text-secondary', colors.textSecondary)
  root.style.setProperty('--color-text-tertiary', colors.textTertiary)
  root.style.setProperty('--color-border', colors.border)
  root.style.setProperty('--color-background', colors.background)
  root.style.setProperty('--color-surface', colors.surface)
  root.style.setProperty('--color-surface-hover', colors.surfaceHover)
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
  const { config, colors, init, initialized } = useThemeStore()
  
  useEffect(() => {
    if (!initialized) {
      init()
    }
  }, [initialized, init])
  
  useEffect(() => {
    applyThemeColors(colors)
    
    if (config.mode === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [colors, config.mode])
  
  const antdTheme = useMemo(() => ({
    algorithm: config.mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: colors.primary,
      colorSuccess: colors.success,
      colorWarning: colors.warning,
      colorError: colors.error,
      colorInfo: colors.info,
      colorBgContainer: colors.surface,
      colorBgElevated: colors.surface,
      colorBorder: colors.border,
      colorText: colors.textPrimary,
      colorTextSecondary: colors.textSecondary,
      colorTextTertiary: colors.textTertiary,
    },
    components: {
      Menu: {
        darkItemBg: colors.surface,
        darkItemSelectedBg: colors.primaryBg,
        darkItemHoverBg: colors.surfaceHover,
      },
      Layout: {
        headerBg: colors.surface,
        siderBg: colors.surface,
        bodyBg: colors.background,
      },
      Card: {
        colorBgContainer: colors.surface,
      },
    },
  }), [colors, config.mode])
  
  return (
    <ConfigProvider theme={antdTheme}>
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  )
}
