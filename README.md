<p align="center">
  <h1 align="center">🎙️ 我是面试官</h1>
</p>
<h3 align="center">AI 驱动的本地优先智能面试助手</h3>
<p align="center">
  <a href="https://github.com/DuLianYong-Chinese/imivr/blob/main/LICENSE"><img src="https://img.shields.io/github/license/DuLianYong-Chinese/imivr?color=%231890FF" alt="License: MIT"></a>
  <a href="https://github.com/DuLianYong-Chinese/imivr"><img src="https://img.shields.io/github/stars/DuLianYong-Chinese/imivr?color=%231890FF&style=flat-square" alt="GitHub Stars"></a>
  <a href="https://www.npmjs.com/package/imivr-bobfintech"><img src="https://img.shields.io/npm/v/imivr-bobfintech?color=%231890FF" alt="npm version"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node.js"></a>
</p>

------------------------------

## 什么是「我是面试官」？

「我是面试官」是一款基于大语言模型（LLM）的智能面试辅助工具，以 CLI 命令行工具形式分发（npm 包 `imivr-bobfintech`），帮助面试官高效完成技术面试全流程。系统通过 AI 分析候选人简历与岗位 JD 要求，自动生成梯度化面试问题清单，并在面试后根据评分给出综合评价与职级推荐。

**「我是面试官」的优势：**

- **本地优先**：所有数据以 Markdown 文件形式存储在本地，无需云端数据库，数据主权完全归你所有；
- **AI 加持**：集成 OpenAI 兼容接口，支持 finna / deepseek / qwen / openai 等多种 AI 供应商，智能出题、辅助评分、自动评定；
- **梯度化出题**：按 L1（初级）到 L5（大神）五级难度自动生成面试问题，结合题库参考和候选人特征标签精准出题；
- **标准化评定**：统一 P3-P7 职级评定标准，综合得分自动计算，支持 AI 评定、手动评定和规则兜底三种方式；
- **多工种覆盖**：预设前端、后端、算法、测试、数据、产品、设计 7 个工种，支持插件化扩展；
- **语音转录**：浏览器端录音 + AI 语音转文字，面试过程更流畅；
- **Git 友好**：工作空间目录可直接纳入版本控制，面试记录可追溯、可备份。

**「我是面试官」支持的 AI 供应商：**

- finna（默认问答模型：deepseek-v4-flash，默认语音模型：qwen3-asr-flash）
- deepseek
- qwen（通义千问）
- openai
- 自定义（任意 OpenAI 兼容接口）

## 快速开始

### 环境准备

要求 Node.js >= 20，推荐使用 [nvm](https://github.com/nvm-sh/nvm)（Linux/macOS）或 [nvm-windows](https://github.com/coreybutler/nvm-windows)（Windows）管理 Node.js 版本：

**Linux / macOS：**
```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# 安装并使用 Node.js 20
nvm install 20
nvm use 20
```

**Windows：**
```powershell
# 下载 nvm-windows 安装包
# https://github.com/coreybutler/nvm-windows/releases

# 安装并使用 Node.js 20
nvm install 20
nvm use 20
```

也可以直接从 [nodejs.org](https://nodejs.org/) 下载 LTS 版本安装。

### 安装与启动

```bash
# 全局安装
npm install -g imivr-bobfintech

# 初始化配置（设置工作目录和 AI 模型）
imivr init

# 启动服务
imivr start

# 浏览器访问 http://localhost:5173 即可使用
```

也可以通过 npx 直接运行：

```bash
npx imivr-bobfintech start
```

## 功能模块

<table>
  <tr>
    <td width="50%">
      <h4>📋 工作空间管理</h4>
      <p>7 个预设工种工作空间，首次自动初始化。支持自定义考察维度和权重配置。</p>
    </td>
    <td width="50%">
      <h4>📄 简历解析</h4>
      <p>支持 PDF / Word 简历上传，markitdown-ts 自动转换，AI 结构化提取关键信息。</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>📝 JD 管理</h4>
      <p>标准化岗位描述配置模板，灵活定义技能要求和考察维度，指导 AI 出题方向。</p>
    </td>
    <td>
      <h4>📚 题库管理</h4>
      <p>按 L1-L5 难度分级组织题库，支持 Markdown 编辑和上传，AI 出题时作为参考上下文。</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>🤖 智能出题</h4>
      <p>基于简历 + JD + 题库 + 候选人标签，AI 流式生成梯度化面试问题，支持标签定向出题和难度分布调整。</p>
    </td>
    <td>
      <h4>🎤 面试执行</h4>
      <p>全屏面试模式，左右分栏布局，支持语音录入转文字、自动保存（1秒防抖 + 30秒定时）、面试计时。</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>⭐ 多维评分</h4>
      <p>逐题评分（0-10）+ AI 辅助评分（1-5）+ 面试官四维度评价（沟通/项目/潜力/价值观）+ 手动加分（-5~+5）。</p>
    </td>
    <td>
      <h4>🏆 等级评定</h4>
      <p>综合得分自动计算，AI 评定 / 手动评定 / 规则兜底三种方式，输出 P3-P7 职级推荐和录用建议。</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>📊 报告生成</h4>
      <p>整合全流程数据生成完整面试报告，支持 default / detailed / summary 三种模板，重新生成自动备份。</p>
    </td>
    <td>
      <h4>🏷️ 候选人标签</h4>
      <p>AI 分析简历生成 7 大类特征标签（技术/项目/软技能/职业规划/岗位挑战/领导力/行业洞察），辅助出题方向。</p>
    </td>
  </tr>
</table>

## CLI 命令

| 命令 | 说明 |
|------|------|
| `imivr start` | 启动服务（Express + 静态文件），自动查找可用端口 |
| `imivr init` | 安装引导，配置工作目录和 AI 模型 |
| `imivr doctor` | 健康检查（配置目录、工作空间、模型状态） |
| `imivr config` | 查看当前配置 |
| `imivr config:set <key> <value>` | 设置配置项（支持点号分隔的 key） |
| `imivr config:get <key>` | 获取配置项 |
| `imivr uninstall` | 卸载清理 |

## 数据存储

```
{workspaceRoot}/
├── frontend_dev/                    # 前端开发工程师
│   ├── workspace.md                 # 工作空间配置
│   ├── question-bank/               # 题库（L1-L5 分级）
│   ├── interviews/                  # 面试记录
│   │   └── 2026-04-17-张三/
│   │       ├── interview.md         # 面试基本信息
│   │       ├── resume.md            # 简历解析结果
│   │       ├── questions.md         # 面试问题清单
│   │       ├── answers.md           # 答题记录与评分
│   │       ├── assessment.md        # 等级评定结果
│   │       ├── report.md            # 面试评估报告
│   │       └── tags.md              # 候选人特征标签
│   └── templates/                   # JD 模板
├── backend_dev/                     # 后端开发工程师
├── algorithm_eng/                   # 算法工程师
├── test_eng/                        # 测试工程师
├── data_dev/                        # 数据开发工程师
├── product_mgr/                     # 产品经理
└── ui_designer/                     # UI 设计师
```

配置文件：`~/.imivr/imivr.json`

## 技术栈

- **前端**：[React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Ant Design 5](https://ant.design/)
- **路由**：[React Router 6](https://reactrouter.com/)
- **状态管理**：[Zustand](https://zustand-demo.pmnd.rs/)
- **服务端**：[Express 5](https://expressjs.com/)
- **CLI 框架**：[Commander.js](https://github.com/tj/commander.js) + [@clack/prompts](https://github.com/natemoo-re/clack)
- **Markdown 解析**：[gray-matter](https://github.com/jonschlinkert/gray-matter)
- **简历解析**：[markitdown-ts](https://github.com/microsoft/markitdown)
- **AI 引擎**：OpenAI 兼容 API
- **构建工具**：[Vite 5](https://vitejs.dev/) + [tsup](https://tsup.egoist.dev/)
- **运行环境**：[Node.js](https://nodejs.org/) >= 20

## 项目文档

| 目录 | 说明 |
|------|------|
| [1.概要设计](./1.概要设计/我是面试官-系统概要设计文档.md) | 系统架构、模块分层、数据流、技术选型 |
| [2.需求设计](./2.需求设计/我是面试官-需求设计.md) | 12 个模块的详细需求设计文档 |
| [3.工程代码](./3.工程代码/) | 完整工程源码与开发指南 |
| [4.项目构建](./4.项目构建/我是面试官-项目构建方案.md) | CLI 化改造方案、技术选型、架构设计与实施记录 |

## 项目结构

```
imivr/
├── 1.概要设计/           # 系统概要设计文档
├── 2.需求设计/           # 需求设计文档（按模块拆分）
├── 3.工程代码/           # 工程源码
│   ├── src/
│   │   ├── cli/          # CLI 命令行工具
│   │   ├── core/         # 核心层（AI、文件系统、Markdown、插件）
│   │   ├── modules/      # 业务模块（8 个模块）
│   │   ├── pages/        # 页面组件（7 个路由页面）
│   │   ├── components/   # 共享组件
│   │   ├── stores/       # Zustand 状态管理
│   │   ├── types/        # TypeScript 类型定义
│   │   └── utils/        # 工具函数
│   └── plugins/          # 工种插件目录
└── 4.项目构建/           # 构建计划与进度
```

---

<p align="center">
  <b>我是面试官</b> —— 让每一次面试都有据可依
</p>
