import { Command } from 'commander'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgPath = resolve(__dirname, '../../package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

const program = new Command()

program
  .name('imivr')
  .description('我是面试官 - 面试辅助系统')
  .version(pkg.version, '-v, --version', '查看版本号')
  .helpOption('-h, --help', '查看帮助信息')

program
  .command('start')
  .description('启动 Web 服务')
  .option('-p, --port <port>', '指定端口号', '5173')
  .option('--no-open', '不自动打开浏览器')
  .action(async (options) => {
    const { startServer } = await import('./server')
    await startServer({
      port: parseInt(options.port),
      open: options.open,
    })
  })

program
  .command('init')
  .description('安装引导向导')
  .action(async () => {
    const { runInit } = await import('./init')
    await runInit()
  })

program
  .command('doctor')
  .description('健康检查')
  .action(async () => {
    const { runDoctor } = await import('./doctor')
    await runDoctor()
  })

program
  .command('uninstall')
  .description('卸载（清理配置和工作空间数据）')
  .action(async () => {
    const { runUninstall } = await import('./uninstall')
    await runUninstall()
  })

program
  .command('config')
  .description('查看当前配置')
  .action(async () => {
    const { showConfig } = await import('./config')
    await showConfig()
  })

program
  .command('config:set')
  .description('设置配置项')
  .argument('<key>', '配置键名')
  .argument('<value>', '配置值')
  .action(async (key: string, value: string) => {
    const { setConfig } = await import('./config')
    await setConfig(key, value)
  })

program
  .command('config:get')
  .description('获取配置项')
  .argument('<key>', '配置键名')
  .action(async (key: string) => {
    const { getConfig } = await import('./config')
    await getConfig(key)
  })

program.parse()
