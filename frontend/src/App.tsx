import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { Layout } from '@/components/layout/Layout'
import { LoadingPage } from '@/components/ui/EmptyState'

// Lazy load pages
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const TasksPage = lazy(() => import('@/pages/TasksPage'))
const PlanningPage = lazy(() => import('@/pages/PlanningPage'))
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'))
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={
          <div className="min-h-screen bg-dark-bg flex items-center justify-center">
            <LoadingPage />
          </div>
        }>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />

            {/* Protected routes */}
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/planning" element={<PlanningPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>

      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#111827',
            color: '#F1F5F9',
            border: '1px solid #1E293B',
            borderRadius: '10px',
            fontSize: '13px',
            fontFamily: 'Space Grotesk, sans-serif',
            padding: '12px 16px',
          },
          success: { iconTheme: { primary: '#10B981', secondary: '#111827' } },
          error: { iconTheme: { primary: '#EF4444', secondary: '#111827' } },
        }}
      />
    </QueryClientProvider>
  )
}

export default App
