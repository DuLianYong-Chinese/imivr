import { create } from 'zustand'
import type { WorkspaceInfo, Interview, Question } from '@/types'

interface AppState {
  currentWorkspace: WorkspaceInfo | null
  currentInterview: Interview | null
  setCurrentWorkspace: (workspace: WorkspaceInfo | null) => void
  setCurrentInterview: (interview: Interview | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentWorkspace: null,
  currentInterview: null,
  setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
  setCurrentInterview: (interview) => set({ currentInterview: interview }),
}))

interface AIConfigState {
  provider: 'openai' | 'qwen' | 'custom'
  apiKey: string
  baseUrl?: string
  model?: string
  configured: boolean
  setConfig: (config: { provider: 'openai' | 'qwen' | 'custom'; apiKey: string; baseUrl?: string; model?: string }) => void
}

export const useAIConfigStore = create<AIConfigState>((set) => ({
  provider: 'openai',
  apiKey: '',
  baseUrl: undefined,
  model: undefined,
  configured: false,
  setConfig: (config) => set({ ...config, configured: true }),
}))

export { useThemeStore } from './themeStore'
