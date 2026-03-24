import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useApi } from './useApi'

describe('useApi', () => {
  it('starts in loading state', () => {
    const fetcher = vi.fn(() => new Promise<string>(() => {}))
    const { result } = renderHook(() => useApi(fetcher))

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('returns data on success', async () => {
    const fetcher = vi.fn(() => Promise.resolve('hello'))
    const { result } = renderHook(() => useApi(fetcher))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.data).toBe('hello')
    expect(result.current.error).toBeNull()
  })

  it('returns error on failure', async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error('fail')))
    const { result } = renderHook(() => useApi(fetcher))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe('fail')
  })
})
