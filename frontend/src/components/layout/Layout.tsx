import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useTaskReminder } from '@/hooks/useTaskReminder'

export function Layout() {
  const { isAuthenticated } = useAuthStore()

  // Start polling for task reminders as soon as user is logged in
  useTaskReminder()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      <Sidebar />
      <Header />
      <main className="ml-[220px] pt-14 min-h-screen">
        <div className="p-6 animate-fadeIn">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
