import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'RedditRadar',
  description: 'High-signal engineering lead discovery',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <header className="border-b bg-white px-6 py-3 flex items-center gap-3">
          <span className="font-bold text-lg tracking-tight">RedditRadar</span>
          <span className="text-xs text-gray-400 mt-0.5">lead discovery for engineers</span>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
