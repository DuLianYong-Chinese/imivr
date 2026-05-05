import { AICallError, AIResponseParseError } from './errors'

export interface AIConfig {
  provider: 'openai' | 'qwen' | 'custom'
  apiKey: string
  baseURL?: string
  model?: string
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

let aiConfig: AIConfig | null = null

export function configureAI(config: AIConfig): void {
  aiConfig = config
}

export function getAIConfig(): AIConfig | null {
  return aiConfig
}

export async function callAI(
  prompt: string,
  variables?: Record<string, unknown>
): Promise<string> {
  if (!aiConfig) {
    throw new AICallError('AI not configured. Please set API key in settings.')
  }

  let finalPrompt = prompt
  if (variables) {
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{${key}}`
      const replacement = typeof value === 'object' ? JSON.stringify(value) : String(value)
      finalPrompt = finalPrompt.replace(new RegExp(placeholder, 'g'), replacement)
    })
  }

  switch (aiConfig.provider) {
    case 'openai':
      return callOpenAI(finalPrompt)
    case 'qwen':
      return callQwenAI(finalPrompt)
    default:
      throw new AICallError(`Unsupported AI provider: ${aiConfig.provider}`)
  }
}

async function callOpenAI(prompt: string): Promise<string> {
  if (!aiConfig) throw new AICallError('AI not configured')

  const baseUrl = aiConfig.baseURL || 'https://api.openai.com/v1'
  const model = aiConfig.model || 'gpt-4o-mini'

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new AICallError(`OpenAI API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || ''
}

async function callQwenAI(prompt: string): Promise<string> {
  if (!aiConfig) throw new AICallError('AI not configured')

  const baseUrl = aiConfig.baseURL || 'https://dashscope.aliyuncs.com/api/v1'
  const model = aiConfig.model || 'qwen-turbo'

  const response = await fetch(`${baseUrl}/services/aigc/text-generation/generation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: { prompt },
      parameters: { temperature: 0.7, max_tokens: 4096 },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new AICallError(`Qwen API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.output?.text || ''
}

export async function callAIWithJSON<T>(
  prompt: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await callAI(prompt, variables)
  
  try {
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : response
    return JSON.parse(jsonStr.trim())
  } catch {
    throw new AIResponseParseError(`Failed to parse AI response as JSON: ${response.substring(0, 200)}...`)
  }
}

export function buildPrompt(template: string, variables: Record<string, unknown>): string {
  let result = template
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{${key}}`
    const replacement = typeof value === 'object' ? JSON.stringify(value) : String(value)
    result = result.replace(new RegExp(placeholder, 'g'), replacement)
  })
  return result
}
