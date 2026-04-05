'use client'
import { useEffect, useState } from 'react'

type Toast = { id: number; msg: string; type: 'ok' | 'err' | 'info' | 'warn' }
let addToastFn: ((msg: string, type?: Toast['type']) => void) | null = null

export function showToast(msg: string, type: Toast['type'] = 'ok') {
  addToastFn?.(msg, type)
}

export default function ToastRoot() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    addToastFn = (msg, type = 'ok') => {
      const id = Date.now()
      setToasts(t => [...t, { id, msg, type }])
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3400)
    }
    return () => { addToastFn = null }
  }, [])

  const colors: Record<Toast['type'], string> = {
    ok: 'var(--green)', err: 'var(--red)', info: 'var(--blue)', warn: 'var(--yellow)'
  }

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999, pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div key={t.id} className="animate-toast-in" style={{
          background: '#fff', border: '1px solid var(--border)',
          borderLeft: `4px solid ${colors[t.type]}`,
          borderRadius: 'var(--r)', padding: '12px 16px',
          fontSize: 13, fontWeight: 600, color: 'var(--text)',
          boxShadow: 'var(--shadow-lg)', maxWidth: 300
        }}>{t.msg}</div>
      ))}
    </div>
  )
}
