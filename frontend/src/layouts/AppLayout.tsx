import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { PatientHeader } from './PatientHeader'

export function AppLayout() {
  const { pathname } = useLocation()
  // Only show PatientHeader on patient-facing routes or clinician patient detail
  const showPatientHeader = pathname === '/' || pathname === '/program' || pathname === '/progress'
    || pathname === '/messages' || pathname.startsWith('/dashboard/patient/')

  return (
    <div className="flex h-screen bg-neutral-50">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:ml-64 pb-16 lg:pb-0 min-h-0">
        {showPatientHeader && <PatientHeader />}
        <main className="flex-1 flex flex-col min-h-0 overflow-auto">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
