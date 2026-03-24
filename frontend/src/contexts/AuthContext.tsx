import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

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
  const stored = localStorage.getItem(`medbridge_role_${uid}`)
  if (!stored) return null
  const ts = localStorage.getItem(`medbridge_role_ts_${uid}`)
  if (ts && Date.now() - Number(ts) > ROLE_TTL_MS) {
    // Expired — clear and force re-fetch from Firestore
    localStorage.removeItem(`medbridge_role_${uid}`)
    localStorage.removeItem(`medbridge_role_ts_${uid}`)
    localStorage.removeItem(`medbridge_name_${uid}`)
    return null
  }
  return stored as UserRole | null
}

function setStoredRole(uid: string, role: UserRole) {
  localStorage.setItem(`medbridge_role_${uid}`, role)
  localStorage.setItem(`medbridge_role_ts_${uid}`, String(Date.now()))
}

function getStoredName(uid: string): string | null {
  return localStorage.getItem(`medbridge_name_${uid}`)
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
        // Page refresh / returning user — restore from localStorage
        const role = getStoredRole(fbUser.uid)
        const name = getStoredName(fbUser.uid)
        if (role) {
          setUser({
            uid: fbUser.uid,
            email: fbUser.email,
            role,
            name: name || fbUser.email || '',
          })
          setLoading(false)
          return
        }

        // No localStorage — try Firestore (different browser/device)
        try {
          const snap = await Promise.race([
            getDoc(doc(db, 'users', fbUser.uid)),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
          ])
          if (snap.exists()) {
            const data = snap.data()
            const firestoreRole = data.role as UserRole
            const firestoreName = data.name || fbUser.email || ''
            setStoredRole(fbUser.uid, firestoreRole)
            localStorage.setItem(`medbridge_name_${fbUser.uid}`, firestoreName)
            setUser({ uid: fbUser.uid, email: fbUser.email, role: firestoreRole, name: firestoreName })
          } else {
            // No role data anywhere — sign out
            await firebaseSignOut(auth)
            setUser(null)
          }
        } catch {
          await firebaseSignOut(auth)
          setUser(null)
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

      // If no localStorage role, check Firestore (3s timeout)
      if (!storedRole) {
        try {
          const snap = await Promise.race([
            getDoc(doc(db, 'users', cred.user.uid)),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
          ])
          if (snap.exists()) {
            const actualRole = snap.data().role as UserRole
            if (actualRole !== role) {
              await firebaseSignOut(auth)
              throw new Error(
                `This account is registered as a ${actualRole}. Please use the ${actualRole} login.`
              )
            }
            // Store the name from Firestore
            const fsName = snap.data().name
            if (fsName) localStorage.setItem(`medbridge_name_${cred.user.uid}`, fsName)
          }
        } catch (err) {
          if (err instanceof Error && err.message.includes('registered as')) throw err
          // Timeout — allow (first login on this device, no data anywhere)
        }
      }

      // Role verified — set user state
      const name = getStoredName(cred.user.uid) || cred.user.email || ''
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

      // Persist role to localStorage immediately (source of truth)
      setStoredRole(cred.user.uid, role)
      localStorage.setItem(`medbridge_name_${cred.user.uid}`, name)

      // Set user state
      setUser({ uid: cred.user.uid, email, role, name })
      setLoading(false)

      // Write to Firestore in background (for cross-device support)
      setDoc(doc(db, 'users', cred.user.uid), {
        role, name, email, createdAt: new Date().toISOString(),
      }).catch(() => {})
    } finally {
      manualAuth.current = false
    }
  }

  const demoLogin = (role: UserRole) => {
    const demoUser: AuthUser = {
      uid: `demo-${role}`,
      email: role === 'patient' ? 'demo-patient@medbridge.com' : 'demo-clinician@medbridge.com',
      role,
      name: role === 'patient' ? 'Demo Patient' : 'Dr. Demo',
    }
    // Store demo credentials so the API layer can send X-Demo-User header
    localStorage.setItem('medbridge_demo_uid', demoUser.uid)
    localStorage.setItem('medbridge_demo_role', role)
    setIsDemo(true)
    setUser(demoUser)
    setLoading(false)
  }

  const signOut = async () => {
    // Clear demo credentials
    localStorage.removeItem('medbridge_demo_uid')
    localStorage.removeItem('medbridge_demo_role')
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
