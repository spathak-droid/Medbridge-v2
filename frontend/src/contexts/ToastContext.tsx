import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import gsap from 'gsap'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastActions {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

interface ToastContextValue {
  toast: ToastActions
}

const ToastContext = createContext<ToastContextValue>({
  toast: {
    success: () => {},
    error: () => {},
    info: () => {},
  },
})

export function useToast() {
  return useContext(ToastContext)
}

const BORDER_COLORS: Record<ToastType, string> = {
  success: '#22c55e',
  error: '#ef4444',
  info: '#3b82f6',
}

const ICONS: Record<ToastType, ReactNode> = {
  success: (
    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
    </svg>
  ),
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    gsap.fromTo(
      el,
      { x: 120, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.35, ease: 'power3.out' },
    )
  }, [])

  const dismiss = useCallback(() => {
    const el = ref.current
    if (!el) return
    gsap.to(el, {
      x: 120,
      opacity: 0,
      duration: 0.25,
      ease: 'power2.in',
      onComplete: () => onClose(toast.id),
    })
  }, [toast.id, onClose])

  useEffect(() => {
    const timer = setTimeout(dismiss, 3000)
    return () => clearTimeout(timer)
  }, [dismiss])

  return (
    <div
      ref={ref}
      style={{ borderLeftColor: BORDER_COLORS[toast.type] }}
      className="pointer-events-auto flex items-center gap-3 bg-white border-l-4 rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.1)] px-4 py-3 min-w-[260px] max-w-[360px]"
    >
      {ICONS[toast.type]}
      <span className="flex-1 text-sm font-medium text-neutral-700">{toast.message}</span>
      <button
        onClick={dismiss}
        className="flex-shrink-0 text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
        aria-label="Close"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function ToastContainer({
  toasts,
  onClose,
}: {
  toasts: Toast[]
  onClose: (id: number) => void
}) {
  return (
    <div className="fixed bottom-6 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={onClose} />
      ))}
    </div>
  )
}

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = ++nextId
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const toast: ToastActions = {
    success: useCallback((message: string) => addToast(message, 'success'), [addToast]),
    error: useCallback((message: string) => addToast(message, 'error'), [addToast]),
    info: useCallback((message: string) => addToast(message, 'info'), [addToast]),
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  )
}
