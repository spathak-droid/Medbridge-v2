import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'

interface SearchItem {
  id: string
  category: 'Pages' | 'Quick Actions'
  icon: JSX.Element
  title: string
  description: string
  path: string
}

const pageItems: SearchItem[] = [
  {
    id: 'dashboard',
    category: 'Pages',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
    title: 'Dashboard',
    description: 'View your home dashboard',
    path: '/',
  },
  {
    id: 'ai-coach',
    category: 'Pages',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
    title: 'AI Coach',
    description: 'Chat with your AI health coach',
    path: '/chat',
  },
  {
    id: 'program',
    category: 'Pages',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    title: 'My Program',
    description: 'View your exercise program',
    path: '/program',
  },
  {
    id: 'messages',
    category: 'Pages',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
    title: 'Messages',
    description: 'View your messages',
    path: '/messages',
  },
  {
    id: 'reminders',
    category: 'Pages',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    ),
    title: 'Reminders',
    description: 'Manage your reminders and schedule',
    path: '/reminders',
  },
  {
    id: 'progress',
    category: 'Pages',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: 'Progress',
    description: 'Track your recovery progress',
    path: '/progress',
  },
  {
    id: 'settings',
    category: 'Pages',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Settings',
    description: 'Manage your account settings',
    path: '/settings',
  },
]

const actionItems: SearchItem[] = [
  {
    id: 'log-exercise',
    category: 'Quick Actions',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
    title: 'Log exercise',
    description: 'Record a completed exercise',
    path: '/program',
  },
  {
    id: 'send-message',
    category: 'Quick Actions',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
      </svg>
    ),
    title: 'Send message',
    description: 'Send a message to your care team',
    path: '/messages',
  },
  {
    id: 'check-in',
    category: 'Quick Actions',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Check in',
    description: 'Complete your daily check-in',
    path: '/chat',
  },
]

const allItems = [...pageItems, ...actionItems]

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const navigate = useNavigate()
  const overlayRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = query.trim()
    ? allItems.filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase())
      )
    : allItems

  const groupedPages = filtered.filter((i) => i.category === 'Pages')
  const groupedActions = filtered.filter((i) => i.category === 'Quick Actions')
  const flatList = [...groupedPages, ...groupedActions]

  const openModal = useCallback(() => {
    setOpen(true)
    setQuery('')
    setSelectedIndex(0)
  }, [])

  const closeModal = useCallback(() => {
    if (overlayRef.current && panelRef.current) {
      gsap.to(panelRef.current, {
        scale: 0.95,
        opacity: 0,
        duration: 0.15,
        ease: 'power2.in',
      })
      gsap.to(overlayRef.current, {
        opacity: 0,
        duration: 0.15,
        ease: 'power2.in',
        onComplete: () => setOpen(false),
      })
    } else {
      setOpen(false)
    }
  }, [])

  const selectItem = useCallback(
    (item: SearchItem) => {
      closeModal()
      // Navigate after animation completes
      setTimeout(() => navigate(item.path), 160)
    },
    [closeModal, navigate]
  )

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) {
          closeModal()
        } else {
          openModal()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, openModal, closeModal])

  // GSAP entrance animation
  useEffect(() => {
    if (open && overlayRef.current && panelRef.current) {
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.2, ease: 'power2.out' }
      )
      gsap.fromTo(
        panelRef.current,
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(1.4)' }
      )
      // Focus input after animation
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Arrow key navigation inside modal
  useEffect(() => {
    if (!open) return
    const handleNav = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % flatList.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + flatList.length) % flatList.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (flatList[selectedIndex]) {
          selectItem(flatList[selectedIndex])
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        closeModal()
      }
    }
    window.addEventListener('keydown', handleNav)
    return () => window.removeEventListener('keydown', handleNav)
  }, [open, flatList, selectedIndex, selectItem, closeModal])

  // Reset selectedIndex when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  if (!open) return null

  let runningIndex = -1

  const renderGroup = (label: string, items: SearchItem[]) => {
    if (items.length === 0) return null
    return (
      <div className="py-2">
        <div className="px-4 pb-1.5 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
          {label}
        </div>
        {items.map((item) => {
          runningIndex++
          const idx = runningIndex
          const isSelected = idx === selectedIndex
          return (
            <button
              key={item.id}
              onClick={() => selectItem(item)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                isSelected
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <div
                className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                  isSelected ? 'bg-blue-100 text-blue-600' : 'bg-neutral-100 text-neutral-500'
                }`}
              >
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-neutral-800'}`}>
                  {item.title}
                </div>
                <div className={`text-xs truncate ${isSelected ? 'text-blue-500' : 'text-neutral-400'}`}>
                  {item.description}
                </div>
              </div>
              {isSelected && (
                <div className="flex-shrink-0 text-xs text-blue-400 font-medium">
                  Enter
                </div>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={(e) => {
        if (e.target === overlayRef.current) closeModal()
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden border border-neutral-200/60"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100">
          <svg
            className="w-5 h-5 text-neutral-400 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages and actions..."
            className="flex-1 text-sm text-neutral-800 placeholder-neutral-400 outline-none bg-transparent"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-neutral-400 bg-neutral-100 rounded-md border border-neutral-200">
            {navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+K
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {flatList.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-neutral-400">
              No results found for "{query}"
            </div>
          ) : (
            <>
              {renderGroup('Pages', groupedPages)}
              {renderGroup('Quick Actions', groupedActions)}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-neutral-100 bg-neutral-50/50">
          <span className="flex items-center gap-1 text-[11px] text-neutral-400">
            <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-[10px] font-medium">
              &uarr;&darr;
            </kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1 text-[11px] text-neutral-400">
            <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-[10px] font-medium">
              Enter
            </kbd>
            Select
          </span>
          <span className="flex items-center gap-1 text-[11px] text-neutral-400">
            <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-[10px] font-medium">
              Esc
            </kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  )
}
