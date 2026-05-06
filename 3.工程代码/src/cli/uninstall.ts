import * as p from '@clack/prompts'
import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import os from 'os'

function getConfigDir(): string {
  if (process.env.IMIVR_CONFIG_DIR) return process.env.IMIVR_CONFIG_DIR
  return join(os.homedir(), '.imivr')
}

export async function runUninstall(): Promise<void> {
  console.log('')
  p.intro('🗑️  我是面试官 - 卸载')

  const confirmed = await p.confirm({
    message: '确定要卸载吗？这将删除所有配置和工作空间数据。',
    initialValue: false,
  })

  if (p.isCancel(confirmed) || !confirmed) {
    p.outro('已取消卸载。')
    return
  }

  const keepData = await p.confirm({
    message: '是否保留工作空间数据？',
    initialValue: true,
  })

  const configDir = getConfigDir()

  if (!p.isCancel(keepData) && !keepData && existsSync(configDir)) {
    const s = p.spinner()
    s.start('正在清理数据...')
    try {
      rmSync(configDir, { recursive: true, force: true })
      s.stop('数据已清理')
    } catch (error: any) {
      s.stop(`清理失败: ${error.message}`)
      p.outro('卸载过程中出现错误，请手动删除目录: ' + configDir)
      return
    }
  } else {
    console.log(`  工作空间数据已保留在: ${configDir}`)
  }

  p.outro('卸载完成。如需完全移除，请运行: npm uninstall -g imivr-bobfintech')
}
