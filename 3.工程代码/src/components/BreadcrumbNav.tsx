import { Link, useLocation } from 'react-router-dom'
import { Breadcrumb } from 'antd'
import { useMemo } from 'react'
import { useAppStore } from '@/stores'

// 面包屑映射
const breadcrumbMap: Record<string, string> = {
  '/': '首页',
  '/workspaces': '工作空间',
  '/settings': '系统设置',
}

interface BreadcrumbItem {
  title: React.ReactNode
  key: string
  [key: `data-${string}`]: unknown
}

export function useBreadcrumbs() {
  const location = useLocation()
  const { currentInterview } = useAppStore()

  return useMemo(() => {
    const pathSnippets = location.pathname.split('/').filter(i => i)
    const items: BreadcrumbItem[] = [
      {
        title: <Link to="/">我是面试官</Link>,
        key: 'home'
      }
    ]

    let currentPath = ''
    pathSnippets.forEach((snippet, index) => {
      currentPath += `/${snippet}`
      const isLast = index === pathSnippets.length - 1
      
      // 获取显示名称
      let title = breadcrumbMap[currentPath]
      if (!title) {
        // 根据路径片段推断名称
        if (snippet === 'workspaces') title = '工作空间'
        else if (snippet === 'settings') title = '系统设置'
        else if (snippet === 'interviews') title = '面试记录'
        else if (snippet === 'questions') title = '题库管理'
        // 如果是面试ID（以 int- 开头），且有当前面试信息，显示候选人名称
        else if (snippet.startsWith('int-') && currentInterview) {
          title = currentInterview.candidate_name
        }
        else title = snippet
      }

      if (isLast) {
        items.push({ title, key: currentPath })
      } else {
        items.push({ title: <Link to={currentPath}>{title}</Link>, key: currentPath })
      }
    })

    return items
  }, [location.pathname, currentInterview])
}

export default function BreadcrumbNav() {
  const breadcrumbs = useBreadcrumbs()

  return (
    <div style={{
      marginBottom: 24,
      padding: '12px 0',
      borderBottom: '1px solid #f0f0f0'
    }}>
      <Breadcrumb items={breadcrumbs as any} />
    </div>
  )
}
