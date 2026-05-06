# Imivr CLI 化改造 - 任务规划

## 目标

将 imivr（我是面试官）从纯前端 Vite 项目改造为可本地安装的 npm CLI 工具，支持命令行启动、安装引导、配置管理等能力，类似 OpenClaw 的使用体验。

## 参考架构：OpenClaw

| 特性 | OpenClaw 实现 | imivr 适配方案 |
|------|-------------|---------------|
| 全局安装 | `npm install -g openclaw` | `npm install -g imivr` |
| CLI 入口 | `package.json` bin 字段 → CLI 脚本 | 同 |
| 安装引导 | `openclaw onboard` 交互式向导 | `imivr init` 或 `imivr setup` |
| 启动服务 | `openclaw gateway --port 18789` | `imivr start --port 5173` |
| Web 控制台 | `openclaw dashboard` 打开浏览器 | `imivr start` 自动打开浏览器 |
| 配置管理 | `~/.openclaw/openclaw.json` | `~/.imivr/imivr.json` |
| 工作空间 | `~/.openclaw/workspace/` | `~/.imivr/workspaces/` |
| 健康检查 | `openclaw doctor` | `imivr doctor` |
| 卸载 | `openclaw uninstall` | `imivr uninstall` |
| 版本查看 | `openclaw --version` | `imivr --version` |
| 帮助 | `openclaw --help` | `imivr --help` |

## 阶段划分

### 阶段 1：项目结构重组
- [ ] 将现有 `3.工程代码/` 提升为项目根目录
- [ ] 创建 CLI 入口文件 `src/cli/index.ts`
- [ ] 配置 `package.json` 的 `bin` 字段
- [ ] 分离前端构建产物与 CLI 服务端代码

### 阶段 2：CLI 命令框架
- [ ] 使用 `commander` 或 `yargs` 搭建命令解析框架
- [ ] 实现 `imivr --version` / `imivr --help`
- [ ] 实现 `imivr start [options]` 启动 Web 服务
- [ ] 实现 `imivr init` 安装引导向导
- [ ] 实现 `imivr doctor` 健康检查
- [ ] 实现 `imivr uninstall` 卸载命令

### 阶段 3：服务端集成
- [ ] 将 Vite 插件 `fs.mjs` 改造为独立的 Express/Koa 服务端
- [ ] 实现文件系统 API（读写配置、工作空间文件）
- [ ] CLI 启动时同时启动 API 服务 + 静态文件服务
- [ ] 生产模式下 serve Vite build 产物

### 阶段 4：安装引导（Onboarding）
- [ ] 交互式 CLI 向导（选择工作目录、配置 AI 模型）
- [ ] 首次运行自动检测并引导配置
- [ ] 预设工作空间初始化

### 阶段 5：配置管理
- [ ] 统一配置文件 `~/.imivr/imivr.json`
- [ ] `imivr config get/set` 命令
- [ ] 配置迁移/升级机制

### 阶段 6：构建与发布
- [ ] 配置 `tsup` 或 `unbuild` 构建 CLI
- [ ] `npm publish` 发布到 npm registry
- [ ] 编写 README 安装说明

## 目标 CLI 命令清单

```
imivr                          # 默认启动（等同于 imivr start）
imivr --version                # 查看版本
imivr --help                   # 查看帮助

imivr start                    # 启动服务（默认端口 5173）
imivr start --port 3000        # 指定端口启动
imivr start --no-open          # 不自动打开浏览器

imivr init                     # 安装引导向导
imivr doctor                   # 健康检查
imivr uninstall                # 卸载（清理配置、工作空间数据）
imivr config                   # 查看配置
imivr config set <key> <value> # 设置配置项
imivr config get <key>         # 获取配置项
```

## 技术选型

| 层面 | 技术 |
|------|------|
| CLI 框架 | commander |
| 服务端 | Express（轻量） |
| 构建工具 | tsup（快速构建 TS） |
| 交互式向导 | inquirer / @clack/prompts |
| 配置存储 | JSON 文件（~/.imivr/imivr.json） |
| 前端 | 现有 Vite + React（不变） |

## 遇到的错误

| 错误 | 尝试次数 | 解决方案 |
|------|---------|---------|
| - | - | - |
