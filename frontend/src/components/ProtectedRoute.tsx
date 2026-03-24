import { Navigate } from 'react-router-dom'
import { useAuth, type UserRole } from '../contexts/AuthContext'

interface Props {
  children: React.ReactNode
  role: UserRole
}

export function ProtectedRoute({ children, role }: Props) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to={`/${role}/login`} replace />
  }

  if (user.role !== role) {
    return <Navigate to={`/${user.role === 'patient' ? '/' : '/dashboard'}`} replace />
  }

  return <>{children}</>
}
