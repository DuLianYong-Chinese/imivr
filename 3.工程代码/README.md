# 我是面试官 - 面试辅助系统

基于本地优先架构的面试辅助系统，使用 TypeScript + React + Electron 开发，所有数据以 Markdown 文件形式存储在本地。

## 技术架构

- **前端框架**: React 18 + TypeScript
- **桌面应用**: Electron
- **UI 组件**: Ant Design 5
- **状态管理**: Zustand
- **路由**: React Router 6
- **构建工具**: Vite 5

## 本地优先架构特点

1. **数据存储**: 所有数据以 Markdown 文件形式存储在用户选择的本地目录中
2. **配置文件**: 存储在 `~/imivr/imivr.json`
3. **离线可用**: 核心功能无需网络连接
4. **数据主权**: 用户完全掌控自己的数据
5. **Git 友好**: 工作空间目录可以直接纳入版本控制

## 项目结构

```
d:\我是面试官\3.工程代码\
├── electron/
│   ├── main.cjs         # Electron 主进程
│   └── preload.cjs     # 预加载脚本
├── src/
│   ├── core/
│   │   ├── ai/         # AI 调用模块
│   │   ├── filesystem/ # 文件系统模块（使用 Electron API）
│   │   ├── markdown/   # Markdown 解析
│   │   └── plugin/     # 插件系统
│   ├── modules/
│   │   ├── workspace/  # 工作空间管理
│   │   ├── resume/     # 简历管理
│   │   ├── interview/  # 面试执行
│   │   ├── scoring/    # 评分管理
│   │   ├── assessment/ # 等级评定
│   │   └── report/     # 报告生成
│   ├── pages/          # 页面组件
│   ├── components/     # 共享组件
│   ├── types/          # TypeScript 类型定义
│   └── stores/         # Zustand 状态管理
├── plugins/            # 工种插件目录
├── package.json
└── vite.config.ts
```

## 快速开始

### 1. 安装依赖

```bash
cd d:\我是面试官\3.工程代码
pnpm install
```

### 2. 开发模式运行

**注意**: 由于项目需要 Electron 来访问本地文件系统，请先安装 Electron：

```bash
# 目前项目架构采用 Electron 但需要额外配置
# 可以先用浏览器版本进行开发调试（使用 IndexedDB 模拟）
pnpm dev
```

如果需要使用 Electron 版本，可以修改 package.json 的 script 并安装相应依赖。

## 配置说明

首次使用时会提示选择工作空间根目录，选择后会在该目录下创建：

```
工作空间根目录/
└── workspaces/
    ├── frontend_dev/
    │   ├── workspace.md
    │   ├── question-bank/
    │   ├── interviews/
    │   └── templates/
    ├── backend_dev/
    └── ...
```

配置文件存储在 `~/imivr/imivr.json`，包含：

```json
{
  "workspaceRoot": "D:\\my-workspace",
  "ai": {
    "provider": "openai",
    "apiKey": "sk-xxx",
    "baseURL": "https://api.openai.com/v1",
    "model": "gpt-4o"
  }
}
```

## 功能模块

1. **工作空间管理**: 创建、管理不同工种的工作空间
2. **简历管理**: 上传、解析、管理简历
3. **题库管理**: 管理按难度分类的面试题目
4. **问题生成**: 基于简历和职位智能生成问题
5. **面试执行**: 管理面试流程，记录答案
6. **评分管理**: 按题目和维度评分
7. **等级评定**: 自动评定 P3-P7 等级
8. **报告生成**: 生成完整面试报告

## 技术亮点

1. **插件系统**: 支持通过插件扩展不同工种
2. **Markdown 格式**: 所有数据文件易于阅读和版本控制
3. **本地优先**: 无需服务器，数据完全本地存储
4. **类型安全**: 全项目 TypeScript 开发
5. **组件化**: 可复用的 React 组件架构
