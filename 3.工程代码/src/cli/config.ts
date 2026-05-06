import { existsSync, readFileSync, writeFileSync } from 'fs'
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
  if (!existsSync(configDir)) throw new Error('配置目录不存在，请先运行 imivr init')
  writeFileSync(configFile, JSON.stringify(config, null, 2))
}

export async function showConfig(): Promise<void> {
  const config = readConfig()
  console.log('')
  console.log('📋 当前配置:')
  console.log(JSON.stringify(config, null, 2))
  console.log('')
}

export async function setConfig(key: string, value: string): Promise<void> {
  const config = readConfig()

  let parsedValue: any = value
  if (value === 'true') parsedValue = true
  else if (value === 'false') parsedValue = false
  else if (!isNaN(Number(value))) parsedValue = Number(value)

  const keys = key.split('.')
  let current = config
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {}
    current = current[keys[i]]
  }
  current[keys[keys.length - 1]] = parsedValue
  config.updated = new Date().toISOString()

  writeConfig(config)
  console.log(`✅ 已设置 ${key} = ${JSON.stringify(parsedValue)}`)
}

export async function getConfig(key: string): Promise<void> {
  const config = readConfig()
  const keys = key.split('.')
  let current = config
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k]
    } else {
      console.log(`❌ 配置项 ${key} 不存在`)
      return
    }
  }
  console.log(`${key} = ${JSON.stringify(current, null, 2)}`)
}
