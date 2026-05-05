import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ThemeProvider from './components/ThemeProvider'
import WorkspaceList from './pages/WorkspaceList'
import WorkspaceDetail from './pages/WorkspaceDetail'
import InterviewList from './pages/InterviewList'
import InterviewDetail from './pages/InterviewDetail'
import InterviewInProgress from './pages/InterviewInProgress'
import QuestionBank from './pages/QuestionBank'
import Settings from './pages/Settings'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* 面试进行中页面 - 全屏独立路由 */}
          <Route path="workspaces/:jobRole/interviews/:interviewId/in-progress" element={<InterviewInProgress />} />

          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/workspaces" replace />} />
            <Route path="workspaces" element={<WorkspaceList />} />
            <Route path="workspaces/:jobRole" element={<WorkspaceDetail />} />
            <Route path="workspaces/:jobRole/interviews" element={<InterviewList />} />
            <Route path="workspaces/:jobRole/interviews/:interviewId" element={<InterviewDetail />} />
            <Route path="workspaces/:jobRole/questions" element={<QuestionBank />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
