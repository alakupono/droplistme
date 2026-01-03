import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Droplist.me - eBay Listing Tool',
  description: 'A simple tool for listing items on eBay',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

