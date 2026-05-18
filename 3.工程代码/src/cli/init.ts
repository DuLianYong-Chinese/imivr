import * as p from '@clack/prompts'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import os from 'os'

function getConfigDir(): string {
  if (process.env.IMIVR_CONFIG_DIR) return process.env.IMIVR_CONFIG_DIR
  return join(os.homedir(), '.imivr')
}

function getConfigFile(): string {
  return join(getConfigDir(), 'imivr.json')
}

function readConfig(): any {
  const configFile = getConfigFile()
  if (existsSync(configFile)) {
    return JSON.parse(readFileSync(configFile, 'utf-8'))
  }
  return {}
}

function writeConfig(config: any): void {
  const configDir = getConfigDir()
  const configFile = getConfigFile()
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true })
  writeFileSync(configFile, JSON.stringify(config, null, 2))
}

const PROVIDER_DEFAULTS: Record<string, { baseURL: string; model: string }> = {
  openai: { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  finna: { baseURL: 'https://www.finna.com.cn/v1', model: 'deepseek-v4-flash' },
  deepseek: { baseURL: 'https://api.deepseek.com', model: 'deepseek-chat' },
  qwen: { baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
}

const VOICE_MODEL_DEFAULTS: Record<string, string> = {
  finna: 'qwen3-asr-flash',
}

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'finna', label: 'Finna' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'qwen', label: '通义千问' },
  { value: 'custom', label: '自定义' },
]

async function configureModel(label: string, type: 'chat' | 'voice'): Promise<any | null> {
  const provider = await p.select({
    message: `选择${label}提供商`,
    options: PROVIDER_OPTIONS,
  })

  if (p.isCancel(provider)) return null

  let providerName = provider as string

  if (provider === 'custom') {
    const customProvider = await p.text({
      message: '请输入供应商名称',
      placeholder: 'my-provider',
    })
    if (p.isCancel(customProvider)) return null
    providerName = customProvider as string
  }

  const apiKey = await p.password({
    message: '请输入 API Key',
  })

  if (p.isCancel(apiKey)) return null

  let baseURL = ''
  let model = ''
  const defaults = PROVIDER_DEFAULTS[provider as string]

  if (provider === 'custom') {
    const customUrl = await p.text({
      message: '请输入 API Base URL',
      placeholder: 'https://api.openai.com/v1',
    })
    if (p.isCancel(customUrl)) return null
    baseURL = customUrl as string
  } else if (defaults) {
    baseURL = defaults.baseURL
  }

  let defaultModel = ''
  if (provider !== 'custom') {
    if (type === 'voice' && VOICE_MODEL_DEFAULTS[provider as string]) {
      defaultModel = VOICE_MODEL_DEFAULTS[provider as string]
    } else if (defaults) {
      defaultModel = defaults.model
    }
  }

  const modelInput = await p.text({
    message: '请输入模型名称',
    placeholder: defaultModel || 'gpt-4o-mini',
    defaultValue: defaultModel,
  })
  if (p.isCancel(modelInput)) return null
  model = modelInput as string

  return {
    id: String(Date.now()),
    name: label,
    provider: providerName,
    apiKey: apiKey as string,
    baseURL: baseURL || undefined,
    model: model || undefined,
    isDefault: true,
  }
}

export async function runInit(): Promise<void> {
  console.log('')
  p.intro('🎯 我是面试官 - 安装引导')

  const configDir = getConfigDir()
  const configFile = getConfigFile()
  const existingConfig = existsSync(configFile)

  if (existingConfig) {
    const reconfigure = await p.confirm({
      message: '检测到已有配置，是否重新配置？',
      initialValue: false,
    })
    if (!reconfigure) {
      p.outro('已取消，使用现有配置。')
      return
    }
  }

  const workspaceRoot = await p.text({
    message: '请输入工作空间目录路径（面试数据存储位置）',
    placeholder: join(os.homedir(), '.imivr', 'workspaces'),
    defaultValue: join(os.homedir(), '.imivr', 'workspaces'),
  })

  if (p.isCancel(workspaceRoot)) {
    p.cancel('已取消安装引导。')
    return
  }

  const wsDir = workspaceRoot as string
  if (!existsSync(wsDir)) {
    mkdirSync(wsDir, { recursive: true })
  }

  const needAiConfig = await p.confirm({
    message: '是否现在配置 AI 模型？（可稍后在设置页面配置）',
    initialValue: true,
  })

  let aiModels: any[] = []
  let aiVoiceModels: any[] = []

  if (needAiConfig && !p.isCancel(needAiConfig)) {
    const chatModel = await configureModel('问答模型', 'chat')
    if (chatModel) aiModels.push(chatModel)

    const needVoiceConfig = await p.confirm({
      message: '是否配置语音模型？（用于语音面试场景）',
      initialValue: false,
    })

    if (needVoiceConfig && !p.isCancel(needVoiceConfig)) {
      const voiceModel = await configureModel('语音模型', 'voice')
      if (voiceModel) aiVoiceModels.push(voiceModel)
    }
  }

  const config = {
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    version: '1.0.0',
    initialized: true,
    workspaceRoot: wsDir,
    aiModels,
    aiVoiceModels,
  }

  writeConfig(config)

  const s = p.spinner()
  s.start('正在保存配置...')
  await new Promise(r => setTimeout(r, 500))
  s.stop('配置已保存')

  p.outro(`✅ 安装完成！运行 imivr start 启动服务。`)
}
