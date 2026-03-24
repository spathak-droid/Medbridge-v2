import { useEffect, useRef } from 'react'

interface ConfettiProps {
  active: boolean
  duration?: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  w: number
  h: number
  rotation: number
  spin: number
  gravity: number
  opacity: number
}

const COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
]

function burst(cx: number, cy: number, dirX: number, count: number): Particle[] {
  const out: Particle[] = []
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2 // upward spread
    const speed = 10 + Math.random() * 12
    out.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed * dirX + (Math.random() - 0.5) * 3,
      vy: Math.sin(angle) * speed - Math.random() * 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      w: 5 + Math.random() * 7,
      h: 3 + Math.random() * 4,
      rotation: Math.random() * 360,
      spin: (Math.random() - 0.5) * 12,
      gravity: 0.15 + Math.random() * 0.1,
      opacity: 1,
    })
  }
  return out
}

export function Confetti({ active, duration = 2500 }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!active) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const W = canvas.width
    const H = canvas.height

    // Initial bursts from both bottom corners
    let particles = [
      ...burst(0, H, 1, 55),
      ...burst(W, H, -1, 55),
    ]
    const t0 = performance.now()

    function frame(now: number) {
      if (!ctx || !canvas) return
      const elapsed = now - t0

      ctx.clearRect(0, 0, W, H)

      // Add secondary waves in first 400ms
      if (elapsed < 400 && Math.random() < 0.3) {
        particles.push(...burst(0, H, 1, 4))
        particles.push(...burst(W, H, -1, 4))
      }

      let alive = 0
      for (const p of particles) {
        if (p.opacity <= 0) continue
        alive++

        p.vy += p.gravity
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.985
        p.rotation += p.spin

        if (elapsed > duration * 0.5) {
          p.opacity -= 0.015
        }

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.globalAlpha = Math.max(0, p.opacity)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }

      if (alive > 0 && elapsed < duration + 1500) {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        ctx.clearRect(0, 0, W, H)
      }
    }

    rafRef.current = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ctx.clearRect(0, 0, W, H)
    }
  }, [active, duration])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
    />
  )
}
