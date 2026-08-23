import { useState } from 'react'

export function useAsyncStatus() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  return {
    message,
    error,
    succeed(text: string) {
      setError('')
      setMessage(text)
    },
    fail(value: unknown) {
      setMessage('')
      setError(value instanceof Error ? value.message : String(value))
    },
    clear() {
      setMessage('')
      setError('')
    }
  }
}
