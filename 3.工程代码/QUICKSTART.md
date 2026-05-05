# 我是面试官 - 快速启动指南

## 项目架构说明

本项目采用 **本地优先架构**，类似于 OpenClaw 的设计理念：

1. **配置文件**: 存储在 `~/imivr/imivr.json`（Windows 下是 `C:\Users\你的用户名\.imivr\imivr.json`）
2. **工作空间**: 用户选择一个本地目录作为工作空间根目录
3. **数据格式**: 所有数据以 Markdown 文件形式存储在工作空间中
4. **桌面应用**: 使用 Electron 实现，无需网络连接即可使用核心功能

## 配置文件结构

`imivr.json` 包含以下内容：

```json
{
  "workspaceRoot": "D:\\your-workspace-folder",
  "ai": {
    "provider": "openai",
    "apiKey": "sk-your-api-key",
    "baseURL": "https://api.openai.com/v1",
    "model": "gpt-4o"
  }
}
```

## 工作空间目录结构

当你选择一个目录作为工作空间根目录后，系统会创建以下结构：

```
工作空间根目录/
└── workspaces/
    ├── frontend_dev/
    │   ├── workspace.md              # 工作空间配置
    │   ├── question-bank/           # 题库
    │   │   ├── L1-基础/
    │   │   ├── L2-理解/
    │   │   ├── L3-分析/
    │   │   ├── L4-设计/
    │   │   └── L5-专家/
    │   ├── interviews/             # 面试记录
    │   │   ├── 2026-04-21-张三/
    │   │   │   ├── resume.md
    │   │   │   ├── interview.md
    │   │   │   ├── score.md
    │   │   │   ├── assessment.md
    │   │   │   └── report.md
    │   │   └── ...
    │   └── templates/
    ├── backend_dev/
    └── ...
```

## 快速开始（开发模式）

### 方式一：Electron 模式（推荐）

Electron 模式提供完整的本地文件系统访问能力。

```bash
# 1. 安装依赖
cd d:\我是面试官\3.工程代码
pnpm install

# 2. 运行开发模式
pnpm dev
```

### 方式二：纯浏览器模式（备用）

如果不需要真实文件系统访问，可以使用纯浏览器模式（数据存储在 IndexedDB 中）。

## 使用流程

### 1. 首次启动

1. 启动应用后，会看到欢迎页面
2. 点击"选择工作目录"按钮
3. 在弹出的对话框中选择一个本地目录（例如：`D:\interview-workspace`）
4. 系统会自动在该目录中创建必要的文件夹结构

### 2. 创建工作空间

1. 点击"新建工作空间"按钮
2. 选择工种（例如：前端开发工程师）
3. 系统自动填充其他信息
4. 点击确定创建工作空间

### 3. 系统设置

点击左侧导航栏的"设置"，可以：

- 查看当前工作空间目录
- 更换工作空间目录
- 配置 AI 接口（API Key、模型等）

## 技术实现细节

### Electron 主进程

- **文件**: `electron/main.cjs`
- **功能**: 提供 IPC 接口，让前端可以访问 Node.js 的 fs 模块

### 预加载脚本

- **文件**: `electron/preload.cjs`
- **功能**: 通过 contextBridge 暴露安全的 API 给渲染进程

### 前端文件系统模块

- **文件**: `src/core/filesystem/index.ts`
- **功能**: 封装与 Electron 主进程的通信，提供统一的文件操作 API

## 常见问题

### Q: 配置文件在哪里？
A: 在 Windows 下是 `C:\Users\你的用户名\.imivr\imivr.json`，Linux/macOS 下是 `~/.imivr/imivr.json`

### Q: 可以手动编辑工作空间的 Markdown 文件吗？
A: 可以！所有数据都存储在易读的 Markdown 格式中，你可以使用任意文本编辑器进行修改。

### Q: 如何备份工作空间？
A: 只需要将工作空间根目录整个复制一份即可，也可以使用 Git 进行版本控制。

### Q: 是否支持离线使用？
A: 支持！除了 AI 相关功能需要网络连接外，其他核心功能（工作空间管理、题库浏览、评分等）完全离线可用。

## 下一步

- 查看 `d:\我是面试官\3.工程代码\README.md` 了解更详细的技术文档
- 查看 `d:\我是面试官\1.概要设计\我是面试官-系统概要设计文档.md` 了解整体架构设计
