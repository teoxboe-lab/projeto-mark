import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Framework — Marketplace de Itens Digitais',
  description: 'Compre e venda contas, itens e produtos digitais com segurança.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
