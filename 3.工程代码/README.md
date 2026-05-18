# 我是面试官 - 工程代码

基于本地优先架构的智能面试辅助系统，采用 CLI + Express + React SPA 架构，所有数据以 Markdown 文件形式存储在本地。

## 技术架构

- **前端框架**: React 18 + TypeScript
- **UI 组件**: Ant Design 5
- **路由**: React Router 6
- **状态管理**: Zustand
- **服务端**: Express 5
- **CLI 框架**: Commander.js + @clack/prompts
- **Markdown 解析**: gray-matter
- **简历解析**: markitdown-ts
- **AI 引擎**: OpenAI 兼容 API
- **构建工具**: Vite 5 + tsup
- **运行环境**: Node.js >= 20

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式运行
pnpm dev

# 构建
pnpm build

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint
```

## 项目结构

```
src/
├── cli/                # CLI 命令行工具
│   ├── index.ts        # 入口（Commander.js）
│   ├── server.ts       # Express 服务端
│   ├── config.ts       # 配置管理
│   ├── init.ts         # 安装引导
│   ├── doctor.ts       # 健康检查
│   └── uninstall.ts    # 卸载
├── core/               # 核心层
│   ├── ai/             # AI 引擎（配置、调用、语音）
│   ├── filesystem/     # 文件系统代理
│   ├── markdown/       # Markdown 解析
│   └── plugin/         # 插件系统（Prompt 模板）
├── modules/            # 业务模块
│   ├── workspace/      # 工作空间管理
│   ├── interview/      # 面试管理
│   ├── jd/             # JD 管理
│   ├── question-bank/  # 题库管理
│   ├── resume/         # 简历管理
│   ├── scoring/        # 评分管理
│   ├── assessment/     # 等级评定
│   └── report/         # 报告生成
├── pages/              # 页面组件
│   ├── WorkspaceList.tsx
│   ├── WorkspaceDetail.tsx
│   ├── InterviewList.tsx
│   ├── InterviewDetail.tsx
│   ├── InterviewInProgress.tsx
│   ├── QuestionBank.tsx
│   └── Settings.tsx
├── components/         # 共享组件
├── stores/             # Zustand 状态管理
├── types/              # TypeScript 类型定义
└── utils/              # 工具函数
```

## 构建产物

| 命令 | 产物 | 说明 |
|------|------|------|
| `pnpm build:cli` | `dist/cli/` | CLI 可执行文件 |
| `pnpm build:web` | `dist/web/` | 前端静态资源 |
| `pnpm build` | 以上两者 | 完整构建 |

## 发布到 npm

### 发布配置

`package.json` 中的关键字段：

| 字段 | 值 | 说明 |
|------|-----|------|
| `name` | `imivr-bobfintech` | npm 包名 |
| `version` | `1.0.8` | 当前版本号 |
| `main` | `dist/cli/index.js` | 包入口文件 |
| `bin` | `{ "imivr": "dist/cli/index.js" }` | CLI 命令注册 |
| `files` | `["dist/cli", "dist/web"]` | 发布时包含的文件 |

`prepublishOnly` 脚本会在发布前自动执行 `pnpm build`，确保产物是最新的。

### 发布步骤

```bash
# 1. 确保代码通过检查
pnpm typecheck
pnpm lint

# 2. 更新版本号（遵循 semver 规范）
# 修改 package.json 中的 version 字段，例如 1.0.8 → 1.0.8

# 3. 登录 npm（首次需要）
npm login

# 4. 发布（prepublishOnly 会自动执行 pnpm build）
npm publish

# 5. 验证安装
npm install -g imivr-bobfintech
imivr --version
```

### 版本管理建议

- 使用 `npm version patch|minor|major` 自动更新版本号并创建 git tag
- 发布前在本地执行 `pnpm build` 验证构建产物完整性
- 通过 `.npmignore` 排除不需要发布的文件（源码、配置等）

## 配置说明

配置文件存储在 `~/.imivr/imivr.json`，包含工作目录路径、AI 模型列表（问答+语音）、主题配置。

首次使用 `imivr init` 进行初始化配置，选择工作空间根目录后会自动创建 7 个预设工种工作空间。
