import './index.css'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { ConsentGate } from './components/ConsentGate'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ChatPage } from './pages/ChatPage'
import { ProgramPage } from './pages/ProgramPage'
import { ProgressPage } from './pages/ProgressPage'
import { RemindersPage } from './pages/RemindersPage'
import { SettingsPage } from './pages/SettingsPage'
import { ClinicianDashboard } from './pages/ClinicianDashboard'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { PatientDetailPage } from './pages/PatientDetailPage'
import { ClinicianMessagesPage } from './pages/ClinicianMessagesPage'
import { ExerciseLibraryPage } from './pages/ExerciseLibraryPage'
import { MessagesPage } from './pages/MessagesPage'
import { HealthPage } from './pages/HealthPage'
import { LandingPage } from './pages/LandingPage'
import { FindingsPage } from './pages/FindingsPage'
import { PatientLogin } from './pages/auth/PatientLogin'
import { PatientSignup } from './pages/auth/PatientSignup'
import { ClinicianLogin } from './pages/auth/ClinicianLogin'
import { ClinicianSignup } from './pages/auth/ClinicianSignup'
import { usePatient } from './hooks/usePatient'
import { useAuth } from './contexts/AuthContext'

function PatientChatWrapper() {
  const { patientId, loading } = usePatient()
  if (loading || !patientId) return null
  return (
    <ConsentGate patientId={patientId} onDecline={() => {}}>
      <ChatPage patientId={patientId} />
    </ConsentGate>
  )
}

function PatientProgramWrapper() {
  const { patientId, loading } = usePatient()
  if (loading || !patientId) return null
  return (
    <ConsentGate patientId={patientId} onDecline={() => {}}>
      <ProgramPage />
    </ConsentGate>
  )
}

function PatientProgressWrapper() {
  const { patientId, loading } = usePatient()
  if (loading || !patientId) return null
  return (
    <ConsentGate patientId={patientId} onDecline={() => {}}>
      <ProgressPage />
    </ConsentGate>
  )
}

function AuthRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/landing" replace />
  return user.role === 'patient'
    ? <Navigate to="/" replace />
    : <Navigate to="/dashboard" replace />
}

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/findings" element={<FindingsPage />} />
      <Route path="/patient/login" element={<PatientLogin />} />
      <Route path="/patient/signup" element={<PatientSignup />} />
      <Route path="/clinician/login" element={<ClinicianLogin />} />
      <Route path="/clinician/signup" element={<ClinicianSignup />} />

      {/* Patient routes */}
      <Route element={<AppLayout />}>
        <Route path="/" element={
          <ProtectedRoute role="patient">
            <PatientChatWrapper />
          </ProtectedRoute>
        } />
        <Route path="/program" element={
          <ProtectedRoute role="patient">
            <PatientProgramWrapper />
          </ProtectedRoute>
        } />
        <Route path="/progress" element={
          <ProtectedRoute role="patient">
            <PatientProgressWrapper />
          </ProtectedRoute>
        } />
        <Route path="/messages" element={
          <ProtectedRoute role="patient">
            <MessagesPage />
          </ProtectedRoute>
        } />
        <Route path="/reminders" element={
          <ProtectedRoute role="patient">
            <RemindersPage />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={<SettingsPage />} />

        {/* Clinician routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute role="clinician">
            <ClinicianDashboard />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/patient/:id" element={
          <ProtectedRoute role="clinician">
            <PatientDetailPage />
          </ProtectedRoute>
        } />
        <Route path="/clinician-messages" element={
          <ProtectedRoute role="clinician">
            <ClinicianMessagesPage />
          </ProtectedRoute>
        } />
        <Route path="/exercise-library" element={
          <ProtectedRoute role="clinician">
            <ExerciseLibraryPage />
          </ProtectedRoute>
        } />
        <Route path="/analytics" element={
          <ProtectedRoute role="clinician">
            <AnalyticsPage />
          </ProtectedRoute>
        } />
        <Route path="/health" element={<HealthPage />} />
      </Route>

      <Route path="*" element={<AuthRedirect />} />
    </Routes>
  )
}

export default App
