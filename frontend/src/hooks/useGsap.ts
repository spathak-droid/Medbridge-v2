import { useEffect, useRef } from 'react'
import gsap from 'gsap'

/**
 * Stagger-animate children of a container on mount.
 * Attach the returned ref to a wrapper div.
 */
export function useStaggerIn(
  selector = ':scope > *',
  deps: unknown[] = [],
  options?: { delay?: number; stagger?: number; y?: number; duration?: number }
) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const els = ref.current.querySelectorAll(selector)
    if (els.length === 0) return

    gsap.fromTo(
      els,
      { opacity: 0, y: options?.y ?? 24 },
      {
        opacity: 1,
        y: 0,
        duration: options?.duration ?? 0.5,
        stagger: options?.stagger ?? 0.08,
        delay: options?.delay ?? 0.1,
        ease: 'power3.out',
      }
    )
  }, deps)

  return ref
}

/**
 * Counter animation — animates a number from 0 to target.
 */
export function useCountUp(target: number, deps: unknown[] = [], duration = 1.2) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const obj = { val: 0 }
    gsap.to(obj, {
      val: target,
      duration,
      delay: 0.3,
      ease: 'power2.out',
      onUpdate: () => {
        if (ref.current) {
          ref.current.textContent = Math.round(obj.val).toString()
        }
      },
    })
  }, deps)

  return ref
}

/**
 * Animate a single element on mount with fade + slide.
 */
export function useFadeIn(
  deps: unknown[] = [],
  options?: { delay?: number; y?: number; x?: number; duration?: number; scale?: number }
) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    gsap.fromTo(
      ref.current,
      {
        opacity: 0,
        y: options?.y ?? 20,
        x: options?.x ?? 0,
        scale: options?.scale ?? 1,
      },
      {
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1,
        duration: options?.duration ?? 0.6,
        delay: options?.delay ?? 0.1,
        ease: 'power3.out',
      }
    )
  }, deps)

  return ref
}

/**
 * Animate a progress bar width from 0 to target%.
 */
export function useProgressBar(targetPct: number, deps: unknown[] = []) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    gsap.fromTo(
      ref.current,
      { width: '0%' },
      {
        width: `${Math.max(targetPct, 3)}%`,
        duration: 1,
        delay: 0.5,
        ease: 'power2.out',
      }
    )
  }, deps)

  return ref
}
