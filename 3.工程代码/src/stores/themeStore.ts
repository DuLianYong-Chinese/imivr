import { create } from 'zustand'
import type { ThemeColor, ThemeMode, ThemeConfig, ThemeColors } from '@/types'
import { THEME_COLOR_MAP } from '@/types'
import { getConfig, saveConfig } from '@/core/filesystem'

interface ThemeState {
  config: ThemeConfig
  colors: ThemeColors
  initialized: boolean

  init: () => Promise<void>
  setColor: (color: ThemeColor) => Promise<void>
  setMode: (mode: ThemeMode) => Promise<void>
  setCustomPrimaryColor: (color: string, colorMeta?: { h: number; s: number; b: number; a: number }) => Promise<void>
  getColors: (color: ThemeColor, mode: ThemeMode) => ThemeColors
}

function generateCustomColors(baseColor: string, mode: ThemeMode): ThemeColors {
  const isDark = mode === 'dark'
  
  const adjustBrightness = (hex: string, percent: number) => {
    const num = parseInt(hex.slice(1), 16)
    const amt = Math.round(2.55 * percent)
    const R = Math.min(255, Math.max(0, (num >> 16) + amt))
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt))
    const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt))
    return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`
  }
  
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  
  return {
    primary: baseColor,
    primaryHover: isDark ? adjustBrightness(baseColor, 20) : adjustBrightness(baseColor, -10),
    primaryActive: isDark ? adjustBrightness(baseColor, -10) : adjustBrightness(baseColor, -20),
    primaryBg: isDark ? hexToRgba(baseColor, 0.15) : hexToRgba(baseColor, 0.1),
    success: '#52c41a',
    warning: '#faad14',
    error: '#ff4d4f',
    info: baseColor,
    textPrimary: isDark ? '#ffffff' : '#1f1f1f',
    textSecondary: isDark ? '#a6a6a6' : '#595959',
    textTertiary: isDark ? '#666666' : '#8c8c8c',
    border: isDark ? '#424242' : '#d9d9d9',
    background: isDark ? '#141414' : '#f5f5f5',
    surface: isDark ? '#1f1f1f' : '#ffffff',
    surfaceHover: isDark ? '#2a2a2a' : '#fafafa',
  }
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  config: {
    color: 'blue',
    mode: 'light',
    customPrimaryColor: undefined,
  },
  colors: THEME_COLOR_MAP['blue']['light'],
  initialized: false,

  init: async () => {
    try {
      const savedConfig = await getConfig()

      if (savedConfig.theme) {
        const config: ThemeConfig = savedConfig.theme
        const colors = get().getColors(config.color, config.mode)

        set({
          config,
          colors,
          initialized: true,
        })
        return
      }
    } catch (error) {
      console.error('[Theme] 加载主题配置失败:', error)
    }

    set({
      colors: get().getColors('blue', 'light'),
      initialized: true,
    })
  },

  setColor: async (color: ThemeColor) => {
    const state = get()
    const newConfig: ThemeConfig = { ...state.config, color }
    const colors = state.getColors(color, state.config.mode)
    
    set({
      config: newConfig,
      colors,
    })
    
    await saveThemeConfig(newConfig)
  },

  setMode: async (mode: ThemeMode) => {
    const state = get()
    const newConfig: ThemeConfig = { ...state.config, mode }
    const colors = state.getColors(state.config.color, mode)
    
    set({
      config: newConfig,
      colors,
    })
    
    await saveThemeConfig(newConfig)
  },

  setCustomPrimaryColor: async (color: string, colorMeta?: { h: number; s: number; b: number; a: number }) => {
    const state = get()
    const newConfig: ThemeConfig = {
      ...state.config,
      customPrimaryColor: color,
      color: 'custom',
      customColorMeta: colorMeta,
    }
    const colors = generateCustomColors(color, state.config.mode)

    set({
      config: newConfig,
      colors,
    })

    await saveThemeConfig(newConfig)
  },

  getColors: (color: ThemeColor, mode: ThemeMode): ThemeColors => {
    if (color === 'custom' && get().config.customPrimaryColor) {
      return generateCustomColors(get().config.customPrimaryColor!, mode)
    }

    return THEME_COLOR_MAP[color][mode]
  },
}))

async function saveThemeConfig(themeConfig: ThemeConfig) {
  try {
    const existingConfig = await getConfig()
    
    const mergedConfig = {
      ...existingConfig,
      theme: themeConfig,
      updated: new Date().toISOString()
    }
    
    await saveConfig(mergedConfig)
  } catch (error) {
    console.error('[Theme] 保存主题配置失败:', error)
  }
}
