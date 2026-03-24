import { useContext } from 'react'
import { PatientContext, type PatientContextValue } from '../contexts/PatientContext'

export function usePatient(): PatientContextValue {
  return useContext(PatientContext)
}
