# 我是面试官 - 快速启动指南

## 项目架构说明

本项目采用 **本地优先架构**，以 CLI 命令行工具形式分发：

1. **安装方式**: `npm install -g imivr-bobfintech` 全局安装
2. **配置文件**: 存储在 `~/.imivr/imivr.json`（Windows 下是 `C:\Users\你的用户名\.imivr\imivr.json`）
3. **工作空间**: 用户选择一个本地目录作为工作空间根目录
4. **数据格式**: 所有数据以 Markdown 文件形式存储在工作空间中
5. **运行方式**: CLI 启动 Express 服务端 + React SPA 前端，浏览器访问使用

## 快速开始

```bash
# 要求 Node.js >= 20

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

## 配置文件结构

`~/.imivr/imivr.json` 包含以下内容：

```json
{
  "version": "1.0.7",
  "initialized": true,
  "workspaceRoot": "/home/user/.imivr/workspaces",
  "aiModels": [
    {
      "id": "1713300000000",
      "name": "问答模型",
      "provider": "finna",
      "apiKey": "sk-xxx",
      "baseURL": "https://www.finna.com.cn/v1",
      "model": "deepseek-v4-pro",
      "isDefault": true
    }
  ],
  "aiVoiceModels": [
    {
      "id": "1713300000001",
      "name": "语音模型",
      "provider": "finna",
      "apiKey": "sk-xxx",
      "baseURL": "https://www.finna.com.cn/v1",
      "model": "qwen3-asr-flash",
      "isDefault": true
    }
  ],
  "theme": {
    "color": "blue",
    "mode": "light"
  }
}
```

## 工作空间目录结构

选择工作空间根目录后，系统会自动创建 7 个预设工种工作空间：

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

## 使用流程

### 1. 首次启动

1. 执行 `imivr init` 进入安装引导
2. 选择工作空间根目录（或使用默认目录）
3. 配置 AI 问答模型（供应商、API Key、模型）
4. 配置 AI 语音模型（可选）
5. 系统自动创建 7 个预设工种工作空间

### 2. 开始面试

1. 浏览器打开 `http://localhost:5173`
2. 在首页选择一个工种工作空间
3. 进入面试列表，点击"新建面试"
4. 填写候选人信息、目标职级、关联 JD（可选）
5. 上传候选人简历（PDF/Word），系统自动解析
6. 点击"生成问题"，AI 自动生成梯度化面试问题
7. 点击"开始面试"进入全屏面试模式
8. 逐题记录候选人回答（支持语音转文字）
9. 面试结束后逐题评分
10. 执行等级评定，生成面试报告

### 3. 系统设置

点击左侧导航栏的"设置"，可以：

- 查看和切换工作目录
- 迁移工作空间数据
- 管理 AI 问答模型（增删改、设默认）
- 管理 AI 语音模型
- 自定义主题颜色和模式（白天/黑夜）
- 重新初始化预设工作空间

## CLI 命令

| 命令 | 说明 |
|------|------|
| `imivr start` | 启动服务，自动查找可用端口 |
| `imivr start --port 3000` | 指定端口启动 |
| `imivr init` | 安装引导向导 |
| `imivr doctor` | 健康检查 |
| `imivr config` | 查看当前配置 |
| `imivr config set <key> <value>` | 设置配置项 |
| `imivr config get <key>` | 获取配置项 |
| `imivr uninstall` | 卸载清理 |

## 常见问题

### Q: 配置文件在哪里？
A: Windows 下是 `C:\Users\你的用户名\.imivr\imivr.json`，Linux/macOS 下是 `~/.imivr/imivr.json`

### Q: 可以手动编辑工作空间的 Markdown 文件吗？
A: 可以！所有数据都存储在易读的 Markdown 格式中，你可以使用任意文本编辑器进行修改。

### Q: 如何备份工作空间？
A: 只需要将工作空间根目录整个复制一份即可，也可以使用 Git 进行版本控制。

### Q: 是否支持离线使用？
A: 支持！除了 AI 相关功能需要网络连接外，其他核心功能（工作空间管理、题库浏览、评分等）完全离线可用。

### Q: 支持哪些 AI 供应商？
A: 支持 finna、deepseek、qwen（通义千问）、openai 以及任意 OpenAI 兼容接口的自定义供应商。

### Q: 端口被占用怎么办？
A: 系统会自动查找可用端口，无需手动处理。

## 下一步

- 查看 `README.md` 了解更详细的技术文档
- 查看 `../1.概要设计/我是面试官-系统概要设计文档.md` 了解整体架构设计
- 查看 `../2.需求设计/我是面试官-需求设计.md` 了解各模块需求设计
