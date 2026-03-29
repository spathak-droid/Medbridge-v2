import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { PatientHeader } from './PatientHeader'
import { NotificationBell } from '../components/ui/NotificationBell'
import { GlobalSearch } from '../components/ui/GlobalSearch'
import { useAuth } from '../contexts/AuthContext'
import { usePatient } from '../hooks/usePatient'

const patientRoutes = ['/', '/chat', '/program', '/progress', '/messages', '/reminders', '/settings']

export function AppLayout() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const { patientId } = usePatient()

  // Only show PatientHeader on patient-facing routes or clinician patient detail
  const showPatientHeader = pathname.startsWith('/dashboard/patient/')

  // Show floating notification bell on patient routes (no top header bar for patients)
  const isPatientRoute = user?.role === 'patient' && patientRoutes.some(
    (r) => pathname === r || (r !== '/' && pathname.startsWith(r))
  )

  return (
    <div className="flex h-screen bg-neutral-50 text-neutral-800">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:ml-64 pb-16 lg:pb-0 min-h-0 min-w-0">
        {showPatientHeader && <PatientHeader />}
        <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <GlobalSearch />

      {/* Floating notification bell for patient routes */}
      {isPatientRoute && patientId > 0 && (
        <div className="fixed top-3 right-4 z-30">
          <NotificationBell patientId={patientId} />
        </div>
      )}
    </div>
  )
}
