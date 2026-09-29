'use client';

import React, { useState, useEffect } from 'react';
import { Menu, ScanBarcode, X, Clock, Bell, LogOut, User, Home, Apple, Heart, Droplet, CalendarDays, Microscope, MessageCircle } from 'lucide-react';
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
  const [userGender, setUserGender] = useState<string | null>(null);
  const [showCyclePrompt, setShowCyclePrompt] = useState(false);
  
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authDialogMsg, setAuthDialogMsg] = useState("");
  
  const router = useRouter();
  const pathname = usePathname();

  // ── Role from session (zero extra network call) ──
  const userRole = (session?.user as any)?.userRole || 'user';
  const isPharmacologist = userRole === 'pharmacologist';

  const requireAuth = (e: React.MouseEvent, featureName: string, onValid: () => void) => {
    if (status !== 'authenticated') {
      e.preventDefault();
      setAuthDialogMsg(`Please sign in to access ${featureName}.`);
      setShowAuthDialog(true);
      return;
    }
    onValid();
  };

  // ── Profile: try localStorage first (instant), refresh silently ──
  useEffect(() => {
    if (status !== 'authenticated') return;

    // Instant load from cache
    try {
      const cached = localStorage.getItem('pharma_profile_cache');
      if (cached) {
        const prof = JSON.parse(cached);
        if (prof.gender) {
          setUserGender(prof.gender);
          if (prof.gender === 'female' && !prof.last_menstruation_date) {
            setShowCyclePrompt(true);
          }
        }
      }
    } catch (_) {}

    // Background refresh
    fetch('/api/profile')
      .then(res => res.json())
      .then(data => {
        if (data.profile) {
          localStorage.setItem('pharma_profile_cache', JSON.stringify(data.profile));
          if (data.profile.gender) {
            setUserGender(data.profile.gender);
            if (data.profile.gender === 'female' && !data.profile.last_menstruation_date) {
              setShowCyclePrompt(true);
            }
          }
        }
      })
      .catch(console.error);
  }, [status]);

  const handleSignIn = () => signIn('google', { prompt: 'select_account' });

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

  // ── Shared menu item builders ──
  const commonMenuItems = (closeMenu: () => void) => (
    <>
      <button onClick={(e) => requireAuth(e, 'MedCheck', () => { openMedCheck(); closeMenu(); })} className="header-dropdown-item">
        <ScanBarcode size={18} style={{ color: 'var(--accent-primary)' }} />
        MedCheck
      </button>
      <button onClick={(e) => requireAuth(e, 'Food & Supplements', () => { openFoodCheck(); closeMenu(); })} className="header-dropdown-item">
        <Apple size={18} style={{ color: 'var(--accent-primary)' }} />
        Food & Supplements
      </button>
      <Link href="/health-tips" className="header-dropdown-item" onClick={(e) => requireAuth(e, 'Health Tips', closeMenu)}>
        <Heart size={18} style={{ color: 'var(--accent-primary)' }} />
        Health Tips
      </Link>
      <Link href="/skincare" className="header-dropdown-item" onClick={(e) => requireAuth(e, 'Skincare AI', closeMenu)}>
        <Droplet size={18} style={{ color: '#ec4899' }} />
        Skincare AI
      </Link>
      {userGender === 'female' && (
        <Link href="/cycle-tracker" className="header-dropdown-item" onClick={(e) => requireAuth(e, 'Menstruation Cycle', closeMenu)}>
          <CalendarDays size={18} style={{ color: '#d946ef' }} />
          Menstruation Cycle
        </Link>
      )}
    </>
  );

  const roleMenuItems = (closeMenu: () => void) => (
    <>
      {isPharmacologist ? (
        <>
          <Link href="/" className="header-dropdown-item" onClick={closeMenu}>
            <Microscope size={18} style={{ color: 'var(--pharmacologist-accent)' }} />
            DDI Checker
          </Link>
        </>
      ) : (
        <Link href="/" className="header-dropdown-item" onClick={closeMenu}>
          <MessageCircle size={18} style={{ color: 'var(--primary-accent)' }} />
          Chat with Aastha
        </Link>
      )}
    </>
  );

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
          {/* Role badge */}
          {isPharmacologist ? (
            <span className="pro-badge">PRO</span>
          ) : (
            <span className="powered-badge">Powered by Gemini AI</span>
          )}

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

          {/* Hamburger Desktop */}
          <div className="hamburger-container">
            <button onClick={toggleMenu} className="hamburger-btn" aria-label="Menu">
              {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            {isMenuOpen && (
              <div className="header-dropdown-menu">
                {roleMenuItems(() => setIsMenuOpen(false))}
                <div className="dropdown-divider" />
                {commonMenuItems(() => setIsMenuOpen(false))}
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
              {isPharmacologist ? (
                <span className="pro-badge">PRO — Pharmacologist Mode</span>
              ) : (
                <span className="powered-badge">Powered by Gemini AI</span>
              )}
            </div>

            {session?.user ? (
              <>
                <div className="mobile-user-row">
                  {session.user.image && (
                    <img src={session.user.image} alt={session.user.name || ''} className="user-avatar" />
                  )}
                  <span className="mobile-user-name">{session.user.name || session.user.email}</span>
                  {isPharmacologist && <span className="pro-badge-sm">PRO</span>}
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

            {/* Role-specific entry point */}
            {isPharmacologist ? (
              <Link href="/" className="mobile-menu-item" onClick={() => setIsMenuOpen(false)}
                style={{ color: 'var(--pharmacologist-accent)' }}>
                <Microscope size={18} style={{ color: 'var(--pharmacologist-accent)' }} /> DDI Checker
              </Link>
            ) : (
              <Link href="/" className="mobile-menu-item" onClick={() => setIsMenuOpen(false)}>
                <MessageCircle size={18} style={{ color: 'var(--primary-accent)' }} /> Chat with Aastha
              </Link>
            )}

            <div className="mobile-menu-divider" />

            {/* Common features */}
            <button onClick={(e) => requireAuth(e, 'MedCheck', openMedCheck)} className="mobile-menu-item">
              <ScanBarcode size={18} style={{ color: 'var(--accent-primary)' }} /> MedCheck
            </button>
            <button onClick={(e) => requireAuth(e, 'Food & Supplements', openFoodCheck)} className="mobile-menu-item">
              <Apple size={18} style={{ color: 'var(--accent-primary)' }} /> Food & Supplements
            </button>
            <Link href="/health-tips" className="mobile-menu-item" onClick={(e) => requireAuth(e, 'Health Tips', () => setIsMenuOpen(false))}>
              <Heart size={18} style={{ color: 'var(--accent-primary)' }} /> Health Tips
            </Link>
            <Link href="/skincare" className="mobile-menu-item" onClick={(e) => requireAuth(e, 'Skincare AI', () => setIsMenuOpen(false))}>
              <Droplet size={18} style={{ color: '#ec4899' }} /> Skincare AI
            </Link>
            {userGender === 'female' && (
              <Link href="/cycle-tracker" className="mobile-menu-item" onClick={(e) => requireAuth(e, 'Menstruation Cycle', () => setIsMenuOpen(false))}>
                <CalendarDays size={18} style={{ color: '#d946ef' }} /> Menstruation Cycle
              </Link>
            )}

            <div className="mobile-pwa-row">
              <PWAInstallButton />
            </div>
          </div>
        )}
      </header>

      {/* ── Cycle Tracker Prompt (only for users, not pharmacologists) ── */}
      {showCyclePrompt && !isPharmacologist && (
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
            <strong>Menstrual Cycle Tracker</strong><br />
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

      {/* ── Auth Required Dialog (Negotiable) ── */}
      {showAuthDialog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center', position: 'relative' }}>
            <button
              onClick={() => setShowAuthDialog(false)}
              style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            <User size={48} style={{ color: 'var(--accent-primary)', margin: '0 auto 1rem auto' }} />
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', fontSize: '1.25rem' }}>Sign In Required</h3>
            <p style={{ color: 'var(--text-dim)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              {authDialogMsg}
            </p>
            <button className="btn btn-primary" style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }} onClick={() => {
              setShowAuthDialog(false);
              signIn('google', { prompt: 'select_account' });
            }}>
              Sign in with Google
            </button>
          </div>
        </div>
      )}

      {isMedCheckOpen && <MedCheck onClose={closeMedCheck} />}
      {isFoodCheckOpen && <FoodCheck onClose={closeFoodCheck} />}
    </>
  );
}
