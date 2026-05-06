import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import os from 'os'

function getConfigDir(): string {
  if (process.env.IMIVR_CONFIG_DIR) return process.env.IMIVR_CONFIG_DIR
  return join(os.homedir(), '.imivr')
}

function getConfigFile(): string {
  return join(getConfigDir(), 'imivr.json')
}

export async function runDoctor(): Promise<void> {
  console.log('')
  console.log('🔍 我是面试官 - 健康检查')
  console.log('')

  const checks: { name: string; status: 'ok' | 'warn' | 'error'; message: string }[] = []

  const configDir = getConfigDir()
  const configFile = getConfigFile()

  if (existsSync(configDir)) {
    checks.push({ name: '配置目录', status: 'ok', message: configDir })
  } else {
    checks.push({ name: '配置目录', status: 'error', message: `不存在: ${configDir}` })
  }

  if (existsSync(configFile)) {
    try {
      const config = JSON.parse(readFileSync(configFile, 'utf-8'))
      checks.push({ name: '配置文件', status: 'ok', message: configFile })

      if (config.workspaceRoot) {
        if (existsSync(config.workspaceRoot)) {
          checks.push({ name: '工作空间目录', status: 'ok', message: config.workspaceRoot })
        } else {
          checks.push({ name: '工作空间目录', status: 'error', message: `不存在: ${config.workspaceRoot}` })
        }
      } else {
        checks.push({ name: '工作空间目录', status: 'warn', message: '未配置' })
      }

      if (config.aiModels && config.aiModels.length > 0) {
        checks.push({ name: 'AI 模型配置', status: 'ok', message: `已配置 ${config.aiModels.length} 个模型` })
      } else {
        checks.push({ name: 'AI 模型配置', status: 'warn', message: '未配置 AI 模型' })
      }

      if (config.initialized) {
        checks.push({ name: '初始化状态', status: 'ok', message: '已完成初始化' })
      } else {
        checks.push({ name: '初始化状态', status: 'warn', message: '未完成初始化，请运行 imivr init' })
      }
    } catch {
      checks.push({ name: '配置文件', status: 'error', message: '配置文件格式错误' })
    }
  } else {
    checks.push({ name: '配置文件', status: 'error', message: `不存在: ${configFile}` })
  }

  const nodeVersion = process.version
  checks.push({ name: 'Node.js 版本', status: 'ok', message: nodeVersion })

  for (const check of checks) {
    const icon = check.status === 'ok' ? '✅' : check.status === 'warn' ? '⚠️' : '❌'
    console.log(`  ${icon} ${check.name}: ${check.message}`)
  }

  const hasError = checks.some(c => c.status === 'error')
  console.log('')
  if (hasError) {
    console.log('❌ 发现问题，请运行 imivr init 重新配置。')
  } else {
    console.log('✅ 一切正常！')
  }
  console.log('')
}
