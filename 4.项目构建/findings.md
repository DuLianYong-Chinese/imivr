# imivr CLI 化改造 - 研究发现

## OpenClaw 架构分析

### 1. npm 包结构
- 通过 `npm install -g openclaw` 全局安装
- `package.json` 中配置 `bin` 字段指向 CLI 入口
- CLI 入口通常是一个 Node.js 脚本（JS/TS 编译后）

### 2. CLI 命令体系
OpenClaw 拥有非常丰富的命令体系，分为多个子命令组：

**基础命令：**
- `openclaw --version` / `--help`
- `openclaw tui` — 终端交互界面
- `openclaw dashboard` — Web 管理控制台
- `openclaw restart` / `stop` / `update`

**安装引导：**
- `openclaw onboard` — 交互式配置向导
- `openclaw onboard --install-daemon` — 安装为系统服务
- `openclaw configure` — 重新配置
- `openclaw setup` — 最小化初始配置

**诊断排错：**
- `openclaw doctor` — 全面健康检查
- `openclaw doctor --fix` — 自动修复
- `openclaw status` / `status --deep`
- `openclaw logs` / `logs --follow`

**Gateway 管理：**
- `openclaw gateway` — 启动网关
- `openclaw gateway --port 18789` — 指定端口
- `openclaw gateway start/stop/restart`
- `openclaw gateway install` — 安装为系统服务

**模型管理：**
- `openclaw models list/set/status`
- `openclaw models auth login`

**配置管理：**
- `openclaw config` — 查看配置
- `openclaw config edit` — 编辑配置
- `openclaw config get/set <key> <value>`

### 3. 配置文件
- 主配置：`~/.openclaw/openclaw.json`
- 工作空间：`~/.openclaw/workspace/`
- 技能目录：`~/.openclaw/skills/`
- Agent 数据：`~/.openclaw/agents/<ID>/`

### 4. 对 imivr 的启示

**可以借鉴的：**
- `bin` 字段配置 CLI 入口
- commander 做子命令分组
- 交互式向导用 inquirer/@clack/prompts
- 配置文件放在用户目录 `~/.imivr/`
- `start` 命令同时启动 API 服务 + 静态文件服务
- `doctor` 命令做环境检查

**不需要的（imivr 场景不适用）：**
- Gateway/Channel/Agent 管理（imivr 是单机工具）
- Docker 沙箱
- 浏览器自动化
- 定时任务
- 多通道对接（飞书/微信等）

### 5. 技术实现要点

**CLI + Web 服务架构：**
```
用户执行 imivr start
  → CLI 进程启动
  → 启动 Express 服务器（提供 /api/fs/* 等 API）
  → serve Vite build 产物（dist/ 目录）
  → 自动打开浏览器 http://localhost:5173
```

**构建流程：**
```
1. tsup 构建 CLI 代码 → dist/cli.js
2. vite build 构建前端 → dist/web/
3. CLI 启动时 serve dist/web/ 作为静态文件
```

**开发模式：**
```
pnpm dev
  → vite dev server（前端热更新，端口 5173）
  → 同时启动 API 服务（端口 3001，代理文件系统操作）
```
