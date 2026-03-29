import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  deleteUser,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { registerRole, findOrCreatePatient } from '../lib/api'

export type UserRole = 'patient' | 'clinician'

interface AuthUser {
  uid: string
  email: string | null
  role: UserRole
  name: string
}

interface AuthContextValue {
  user: AuthUser | null
  firebaseUser: User | null
  loading: boolean
  isDemo: boolean
  signIn: (email: string, password: string, role: UserRole) => Promise<void>
  signUp: (email: string, password: string, role: UserRole, name: string) => Promise<void>
  demoLogin: (role: UserRole) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

const ROLE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// Read the role for a uid — localStorage with expiry
function getStoredRole(uid: string): UserRole | null {
  const stored = localStorage.getItem(`carearc_role_${uid}`)
  if (!stored) return null
  const ts = localStorage.getItem(`carearc_role_ts_${uid}`)
  if (ts && Date.now() - Number(ts) > ROLE_TTL_MS) {
    // Expired — clear and force re-fetch from Firestore
    localStorage.removeItem(`carearc_role_${uid}`)
    localStorage.removeItem(`carearc_role_ts_${uid}`)
    localStorage.removeItem(`carearc_name_${uid}`)
    return null
  }
  return stored as UserRole | null
}

function setStoredRole(uid: string, role: UserRole) {
  localStorage.setItem(`carearc_role_${uid}`, role)
  localStorage.setItem(`carearc_role_ts_${uid}`, String(Date.now()))
}

function getStoredName(uid: string): string | null {
  return localStorage.getItem(`carearc_name_${uid}`)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)

  // Flag to tell onAuthStateChanged to skip — signIn/signUp will handle user state
  const manualAuth = useRef(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser)

      // If signIn or signUp is handling this, don't interfere
      if (manualAuth.current) {
        return
      }

      if (fbUser) {
        // Always fetch from Firestore to get the real name and role
        try {
          const snap = await Promise.race([
            getDoc(doc(db, 'users', fbUser.uid)),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
          ])
          if (snap.exists()) {
            const data = snap.data()
            const firestoreRole = (data.role as UserRole) || getStoredRole(fbUser.uid)
            const firestoreName = data.name || fbUser.displayName || ''
            if (firestoreRole) {
              setStoredRole(fbUser.uid, firestoreRole)
              if (firestoreName) localStorage.setItem(`carearc_name_${fbUser.uid}`, firestoreName)
              await registerRole(firestoreRole).catch(() => {})
              setUser({ uid: fbUser.uid, email: fbUser.email, role: firestoreRole, name: firestoreName })
            } else {
              await firebaseSignOut(auth)
              setUser(null)
            }
          } else {
            // No Firestore doc — fall back to localStorage
            const role = getStoredRole(fbUser.uid)
            if (role) {
              const name = getStoredName(fbUser.uid) || fbUser.displayName || ''
              registerRole(role).catch(() => {})
              setUser({ uid: fbUser.uid, email: fbUser.email, role, name })
            } else {
              await firebaseSignOut(auth)
              setUser(null)
            }
          }
        } catch {
          // Firestore timeout — fall back to localStorage
          const role = getStoredRole(fbUser.uid)
          if (role) {
            const name = getStoredName(fbUser.uid) || fbUser.displayName || ''
            registerRole(role).catch(() => {})
            setUser({ uid: fbUser.uid, email: fbUser.email, role, name })
          } else {
            await firebaseSignOut(auth)
            setUser(null)
          }
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const signIn = async (email: string, password: string, role: UserRole) => {
    // Tell onAuthStateChanged to not handle this — we will
    manualAuth.current = true

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)

      // Check role — localStorage is the source of truth (never cleared on signout)
      const storedRole = getStoredRole(cred.user.uid)

      if (storedRole && storedRole !== role) {
        await firebaseSignOut(auth)
        throw new Error(
          `This account is registered as a ${storedRole}. Please use the ${storedRole} login.`
        )
      }

      // Always fetch from Firestore to get role verification and the real name
      try {
        const snap = await Promise.race([
          getDoc(doc(db, 'users', cred.user.uid)),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
        ])
        if (snap.exists()) {
          const data = snap.data()
          const actualRole = data.role as UserRole
          if (actualRole !== role) {
            await firebaseSignOut(auth)
            throw new Error(
              `This account is registered as a ${actualRole}. Please use the ${actualRole} login.`
            )
          }
          if (data.name) localStorage.setItem(`carearc_name_${cred.user.uid}`, data.name)
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('registered as')) throw err
      }

      // Role verified — register in backend DB before setting user state
      // (must complete before dashboard API calls that check role)
      await registerRole(role).catch(() => {})

      const name = getStoredName(cred.user.uid) || cred.user.displayName || ''
      setStoredRole(cred.user.uid, role)
      setUser({ uid: cred.user.uid, email: cred.user.email, role, name })
      setLoading(false)
    } finally {
      manualAuth.current = false
    }
  }

  const signUp = async (email: string, password: string, role: UserRole, name: string) => {
    // Tell onAuthStateChanged to not handle this — we will
    manualAuth.current = true

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)

      // Set displayName on Firebase so it's available on any device/sign-in
      await updateProfile(cred.user, { displayName: name })

      // Persist role to localStorage immediately (source of truth)
      setStoredRole(cred.user.uid, role)
      localStorage.setItem(`carearc_name_${cred.user.uid}`, name)

      // Register role in backend DB before setting user state
      await registerRole(role).catch(() => {})

      // For patients: verify clinician has pre-created their record
      // If not, delete the Firebase account and throw an error
      if (role === 'patient') {
        try {
          await findOrCreatePatient(cred.user.uid, name)
        } catch (err: unknown) {
          // Clean up: delete the Firebase account since they can't proceed
          await deleteUser(cred.user).catch(() => {})
          localStorage.removeItem(`carearc_role_${cred.user.uid}`)
          localStorage.removeItem(`carearc_name_${cred.user.uid}`)
          const msg = err instanceof Error ? err.message : 'Account verification failed'
          if (msg.includes("clinician hasn't set up") || msg.includes('403')) {
            throw new Error("Your clinician hasn't set up your account yet. Please contact your care team.")
          }
          throw err
        }
      }

      // Set user state
      setUser({ uid: cred.user.uid, email, role, name })
      setLoading(false)

      // Write to Firestore in background (not blocking — backend DB is source of truth)
      setDoc(doc(db, 'users', cred.user.uid), {
        role, name, email, createdAt: new Date().toISOString(),
      }).catch((err) => console.error('Failed to save user to Firestore:', err))
    } finally {
      manualAuth.current = false
    }
  }

  const demoLogin = async (role: UserRole) => {
    const email = role === 'patient'
      ? (import.meta.env.VITE_DEMO_PATIENT_EMAIL || 'tom@email.com')
      : (import.meta.env.VITE_DEMO_CLINICIAN_EMAIL || 'bob@email.com')
    const password = role === 'patient'
      ? (import.meta.env.VITE_DEMO_PATIENT_PASSWORD || 'tom2026')
      : (import.meta.env.VITE_DEMO_CLINICIAN_PASSWORD || 'bob2026')
    await signIn(email, password, role)
  }

  const signOut = async () => {
    // Clear demo credentials
    localStorage.removeItem('carearc_demo_uid')
    localStorage.removeItem('carearc_demo_role')
    if (isDemo) {
      setIsDemo(false)
      setUser(null)
      return
    }
    // DO NOT clear localStorage role — it's the permanent source of truth
    // that prevents cross-role login
    await firebaseSignOut(auth)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, isDemo, signIn, signUp, demoLogin, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
