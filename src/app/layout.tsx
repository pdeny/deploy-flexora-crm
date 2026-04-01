import type { Metadata } from 'next'
import './globals.css'
import Providers from './Providers'

export const metadata: Metadata = {
  title: 'Flexora — Piattaforma di Gestione del Lavoro',
  description: 'Una potente piattaforma no-code per la gestione del lavoro e CRM. Costruisci app personalizzate, automatizza i flussi di lavoro e collabora in tempo reale.',
  keywords: ['gestione del lavoro', 'CRM', 'no-code', 'automazione', 'collaborazione'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
