'use client';

import React, { useState, useEffect } from 'react';
import { Menu, ScanBarcode, X, Clock, Bell, LogOut, User, Home, Apple } from 'lucide-react';
import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import MedCheck from './MedCheck';
import FoodCheck from './FoodCheck';
import PWAInstallButton from './PWAInstallButton';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMedCheckOpen, setIsMedCheckOpen] = useState(false);
  const [isFoodCheckOpen, setIsFoodCheckOpen] = useState(false);
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // Redirect new users (no profile yet) to onboarding
  useEffect(() => {
    if (
      status === 'authenticated' &&
      session?.user &&
      (session.user as any).profileComplete === false &&
      pathname !== '/onboarding'
    ) {
      router.push('/onboarding');
    }
  }, [session, status, pathname]);

  const toggleMenu = () => setIsMenuOpen(prev => !prev);

  const openMedCheck = () => {
    setIsMedCheckOpen(true);
    setIsMenuOpen(false);
  };

  const closeMedCheck = () => setIsMedCheckOpen(false);

  const openFoodCheck = () => {
    setIsFoodCheckOpen(true);
    setIsMenuOpen(false);
  };

  const closeFoodCheck = () => setIsFoodCheckOpen(false);

  return (
    <>
      <header className="header">
        {/* ── Brand / Logo ── */}
        <Link href="/" className="logo" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span>💊</span>
          <span className="logo-brand">Pharma</span>
          <span className="logo-sub">DDI Checker</span>
        </Link>

        {/* ── Desktop nav (hidden on mobile) ── */}
        <nav className="header-nav-desktop">
          <span className="powered-badge">Powered by Gemini AI</span>

          {status === 'loading' ? (
            <div className="avatar-skeleton pulse" />
          ) : session?.user ? (
            <>
              {pathname !== '/' && (
                <Link href="/" className="nav-link">
                  <Home size={16} /> Home
                </Link>
              )}
              <Link href="/history" className="nav-link">
                <Clock size={16} /> History
              </Link>
              <Link href="/reminders" className="nav-link">
                <Bell size={16} /> Reminders
              </Link>
              <Link href="/profile" className="nav-link">
                {session.user.image ? (
                  <img src={session.user.image} alt={session.user.name || 'User'} className="user-avatar" />
                ) : (
                  <div className="user-avatar-placeholder"><User size={16} /></div>
                )}
              </Link>
              <button onClick={() => signOut()} className="btn-signout">
                <LogOut size={14} /> Sign Out
              </button>
            </>
          ) : (
            <button onClick={() => signIn('google')} className="btn-signin">
              <User size={16} /> Sign In
            </button>
          )}

          <PWAInstallButton />

          {/* Hamburger */}
          <div className="hamburger-container">
            <button onClick={toggleMenu} className="hamburger-btn" aria-label="Menu">
              {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            {isMenuOpen && (
              <div className="header-dropdown-menu">
                <button onClick={openMedCheck} className="header-dropdown-item">
                  <ScanBarcode size={18} style={{ color: 'var(--accent-primary)' }} />
                  MedCheck
                </button>
                <button onClick={openFoodCheck} className="header-dropdown-item">
                  <Apple size={18} style={{ color: 'var(--accent-primary)' }} />
                  Food & Supplements
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* ── Mobile right side ── */}
        <div className="header-nav-mobile">
          {status === 'loading' ? (
            <div className="avatar-skeleton pulse" />
          ) : session?.user ? (
            <Link href="/profile" className="nav-link">
              <img
                src={session.user.image || ''}
                alt={session.user.name || 'User'}
                className="user-avatar"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </Link>
          ) : (
            <button onClick={() => signIn('google')} className="btn-signin btn-signin-mobile">
              <User size={14} /> Sign In
            </button>
          )}

          <button onClick={toggleMenu} className="hamburger-btn" aria-label="Menu">
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* ── Mobile dropdown (full) ── */}
        {isMenuOpen && (
          <div className="mobile-dropdown">
            <div className="mobile-dropdown-header">
              <span className="powered-badge">Powered by Gemini AI</span>
            </div>

            {session?.user ? (
              <>
                <div className="mobile-user-row">
                  {session.user.image && (
                    <img src={session.user.image} alt={session.user.name || ''} className="user-avatar" />
                  )}
                  <span className="mobile-user-name">{session.user.name || session.user.email}</span>
                </div>
                {pathname !== '/' && (
                  <Link href="/" className="mobile-menu-item" onClick={() => setIsMenuOpen(false)}>
                    <Home size={18} style={{ color: 'var(--accent-primary)' }} /> Home
                  </Link>
                )}
                <Link href="/history" className="mobile-menu-item" onClick={() => setIsMenuOpen(false)}>
                  <Clock size={18} style={{ color: 'var(--accent-primary)' }} /> History
                </Link>
                <Link href="/reminders" className="mobile-menu-item" onClick={() => setIsMenuOpen(false)}>
                  <Bell size={18} style={{ color: 'var(--accent-primary)' }} /> Reminders
                </Link>
                <button onClick={() => { signOut(); setIsMenuOpen(false); }} className="mobile-menu-item mobile-signout">
                  <LogOut size={18} /> Sign Out
                </button>
              </>
            ) : (
              <button onClick={() => { signIn('google'); setIsMenuOpen(false); }} className="mobile-menu-item mobile-signin-full">
                <User size={18} /> Sign In with Google
              </button>
            )}

            <div className="mobile-menu-divider" />

            <button onClick={openMedCheck} className="mobile-menu-item">
              <ScanBarcode size={18} style={{ color: 'var(--accent-primary)' }} /> MedCheck
            </button>
            <button onClick={openFoodCheck} className="mobile-menu-item">
              <Apple size={18} style={{ color: 'var(--accent-primary)' }} /> Food & Supplements
            </button>

            <div className="mobile-pwa-row">
              <PWAInstallButton />
            </div>
          </div>
        )}
      </header>

      {isMedCheckOpen && <MedCheck onClose={closeMedCheck} />}
      {isFoodCheckOpen && <FoodCheck onClose={closeFoodCheck} />}
    </>
  );
}
