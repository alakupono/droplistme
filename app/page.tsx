import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs"
import Link from "next/link"

export default function Home() {
  return (
    <main className="container">
      <div className="content">
        <h1>Droplist.me</h1>
        <p className="subtitle">A simple tool for listing items on eBay</p>
        <div className="description">
          <p>Easily create and manage your eBay listings with Droplist.me</p>
        </div>
        
        <div className="auth-buttons">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn btn-primary">Sign In</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="btn btn-secondary">Sign Up</button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <div className="user-section">
              <Link 
                href="/listings" 
                className="btn btn-primary"
                style={{ textDecoration: 'none', display: 'inline-block' }}
              >
                My Listings
              </Link>
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
        </div>
      </div>
    </main>
  )
}

