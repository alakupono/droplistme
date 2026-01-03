import type { Metadata } from 'next'
import { ClerkProvider } from "@clerk/nextjs"
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
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}

