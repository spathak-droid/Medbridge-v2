import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { getPatients, findOrCreatePatient } from '../lib/api'
import { useAuth } from './AuthContext'
import type { PatientSummary } from '../lib/types'

export interface PatientContextValue {
  patientId: number
  setPatientId: (id: number) => void
  patient: PatientSummary | null
  patients: PatientSummary[]
  loading: boolean
  refresh: () => void
}

export const PatientContext = createContext<PatientContextValue>({
  patientId: 0,
  setPatientId: () => {},
  patient: null,
  patients: [],
  loading: true,
  refresh: () => {},
})

export function PatientProvider({ children }: { children: ReactNode }) {
  const { user, isDemo } = useAuth()
  const [patientId, setPatientId] = useState(0)
  const [patients, setPatients] = useState<PatientSummary[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPatients = useCallback(() => {
    if (!user) {
      setPatients([])
      setLoading(false)
      return
    }

    setLoading(true)

    if (isDemo) {
      // Demo mode: show all patients (seeded data)
      getPatients(false)
        .then((data) => {
          setPatients(data)
          if (data.length > 0) {
            setPatientId((prev) => {
              if (!prev || !data.find((p) => p.id === prev)) {
                return data[0].id
              }
              return prev
            })
          }
        })
        .catch((err) => console.error('Failed to load patients:', err))
        .finally(() => setLoading(false))
    } else if (user.role === 'clinician') {
      // Real clinician: show only real patients, exclude own record
      getPatients(true, user.uid)
        .then((data) => {
          setPatients(data)
          if (data.length > 0) {
            setPatientId((prev) => {
              if (!prev || !data.find((p) => p.id === prev)) {
                return data[0].id
              }
              return prev
            })
          }
        })
        .catch((err) => console.error('Failed to load patients:', err))
        .finally(() => setLoading(false))
    } else {
      // Real patient: find/create their own patient record
      findOrCreatePatient(user.uid, user.name)
        .then((p) => {
          setPatients([p])
          setPatientId(p.id)
        })
        .catch((err) => console.error('Failed to find/create patient:', err))
        .finally(() => setLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, user?.role, isDemo])

  useEffect(() => {
    fetchPatients()
  }, [fetchPatients])

  const patient = patients.find((p) => p.id === patientId) ?? null

  return (
    <PatientContext.Provider
      value={{ patientId, setPatientId, patient, patients, loading, refresh: fetchPatients }}
    >
      {children}
    </PatientContext.Provider>
  )
}
