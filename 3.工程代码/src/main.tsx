import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './index.css'
import './polyfills' // Import Buffer polyfill first
import { configureAI } from './core/ai'
import { getConfig } from './core/filesystem'

async function initApp() {
  try {
    const config = await getConfig()
    const defaultModel = (config.aiModels || []).find((m: any) => m.isDefault) || (config.aiModels || [])[0]
    if (defaultModel) {
      await configureAI({
        provider: defaultModel.provider || 'finna',
        apiKey: defaultModel.apiKey,
        baseURL: defaultModel.baseURL,
        model: defaultModel.model
      })
    }
  } catch (error) {
    console.error('Failed to initialize AI config:', error)
  }
  
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ConfigProvider locale={zhCN}>
        <AntdApp>
          <App />
        </AntdApp>
      </ConfigProvider>
    </React.StrictMode>,
  )
}

initApp()
