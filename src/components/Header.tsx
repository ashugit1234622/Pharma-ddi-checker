'use client';

import React, { useState, useEffect } from 'react';
import { Menu, ScanBarcode, X, Clock, Bell, LogOut, User, Home, Apple, Heart, Droplet, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import MedCheck from './MedCheck';
import FoodCheck from './FoodCheck';
import PWAInstallButton from './PWAInstallButton';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMedCheckOpen, setIsMedCheckOpen] = useState(false);
  const [isFoodCheckOpen, setIsFoodCheckOpen] = useState(false);
  const { data: session, status } = useSession();
  const [userGender, setUserGender] = useState<string | null>(null);
  const [showCyclePrompt, setShowCyclePrompt] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/profile')
        .then(res => res.json())
        .then(data => {
          if (data.profile?.gender) {
            setUserGender(data.profile.gender);
            if (data.profile.gender === 'female' && !data.profile.last_menstruation_date) {
              setShowCyclePrompt(true);
            }
          }
        })
        .catch(console.error);
    }
  }, [status]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      GoogleAuth.initialize({
        clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '659970984850-2j84u2v7l47087s2iif7dhlhh804s9k9.apps.googleusercontent.com',
        scopes: ['profile', 'email'],
        grantOfflineAccess: true,
      });
    }
  }, []);

  const handleSignIn = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const user = await GoogleAuth.signIn();
        if (user.authentication.idToken) {
          await signIn('credentials', { idToken: user.authentication.idToken, redirect: true, callbackUrl: '/' });
        }
      } catch (error) {
        console.error('Native Google Sign-In Error:', error);
      }
    } else {
      signIn('google');
    }
  };

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
            <button onClick={handleSignIn} className="btn-signin">
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
                <Link href="/health-tips" className="header-dropdown-item" onClick={() => setIsMenuOpen(false)}>
                  <Heart size={18} style={{ color: 'var(--accent-primary)' }} />
                  Health Tips
                </Link>
                <Link href="/skincare" className="header-dropdown-item" onClick={() => setIsMenuOpen(false)}>
                  <Droplet size={18} style={{ color: '#ec4899' }} />
                  Skincare AI
                </Link>
                {userGender === 'female' && (
                  <Link href="/cycle-tracker" className="header-dropdown-item" onClick={() => setIsMenuOpen(false)}>
                    <CalendarDays size={18} style={{ color: '#d946ef' }} />
                    Menstruation Cycle
                  </Link>
                )}
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
            <button onClick={handleSignIn} className="btn-signin btn-signin-mobile">
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
              <button onClick={() => { handleSignIn(); setIsMenuOpen(false); }} className="mobile-menu-item mobile-signin-full">
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
            <Link href="/health-tips" className="mobile-menu-item" onClick={() => setIsMenuOpen(false)}>
              <Heart size={18} style={{ color: 'var(--accent-primary)' }} /> Health Tips
            </Link>
            <Link href="/skincare" className="mobile-menu-item" onClick={() => setIsMenuOpen(false)}>
              <Droplet size={18} style={{ color: '#ec4899' }} /> Skincare AI
            </Link>
            {userGender === 'female' && (
              <Link href="/cycle-tracker" className="mobile-menu-item" onClick={() => setIsMenuOpen(false)}>
                <CalendarDays size={18} style={{ color: '#d946ef' }} /> Menstruation Cycle
              </Link>
            )}

            <div className="mobile-pwa-row">
              <PWAInstallButton />
            </div>
          </div>
        )}
      </header>

      {/* ── Cycle Tracker Prompt ── */}
      {showCyclePrompt && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
          background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)', border: '1px solid #d946ef',
          maxWidth: '320px', animation: 'slideUp 0.5s ease-out forwards'
        }}>
          <button 
            onClick={() => setShowCyclePrompt(false)}
            style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <CalendarDays size={20} style={{ color: '#d946ef' }} />
            <h4 style={{ margin: 0, color: '#d946ef', fontWeight: 600 }}>New Feature</h4>
          </div>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
            <strong>Menstrual Cycle Tracker</strong><br/>
            Add your last menstruation date to benefit from this feature.
          </p>
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', fontSize: '0.85rem', padding: '0.6rem', background: '#d946ef', color: '#fff', border: 'none' }}
            onClick={() => {
              setShowCyclePrompt(false);
              router.push('/onboarding?step=3');
            }}
          >
            Update Profile
          </button>
        </div>
      )}

      {isMedCheckOpen && <MedCheck onClose={closeMedCheck} />}
      {isFoodCheckOpen && <FoodCheck onClose={closeFoodCheck} />}
    </>
  );
}
