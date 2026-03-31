import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Flexora — Work Management Platform',
  description: 'A powerful no-code work management and CRM platform. Build custom apps, automate workflows, and collaborate in real time.',
  keywords: ['work management', 'CRM', 'no-code', 'automation', 'collaboration'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
