'use client'

import { useEffect, useState, Suspense } from 'react' // Adicionado Suspense aqui
import { useSearchParams, useRouter } from 'next/navigation'
import Header from '@/components/Header'
import ToastRoot from '@/components/ToastRoot'

// 1. Criamos um componente interno com a sua lógica atual
function ConteudoSucesso() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [countDown, setCountDown] = useState(5)
  const sessionId = searchParams.get('session_id')
  const listingId = searchParams.get('listing_id')

  useEffect(() => {
    const timer = setInterval(() => {
      setCountDown((c) => {
        if (c <= 1) {
          clearInterval(timer)
          router.push('/dashboard')
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [router])

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 40, textAlign: 'center', maxWidth: 400, width: '100%' }}>
        {/* ... Seu código de UI (SVG, H1, P, etc) continua igual aqui ... */}
        <h1 style={{ color: 'var(--green)' }}>Pagamento confirmado!</h1>
        <p>Redirecionando em {countDown}s...</p>
        {sessionId && <div style={{ fontSize: 12 }}>ID: {sessionId}</div>}
      </div>
    </div>
  )
}

// 2. A página principal agora apenas "protege" o conteúdo com Suspense
export default function PagamentoSucesso() {
  return (
    <>
      <Header />
      <ToastRoot />
      <Suspense fallback={<div style={{ textAlign: 'center', padding: 50 }}>Carregando...</div>}>
        <ConteudoSucesso />
      </Suspense>
    </>
  )
}