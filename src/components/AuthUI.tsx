'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';
import { User, LogOut, Clock, Bell } from 'lucide-react';

export default function AuthUI() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') {
      if (!sessionStorage.getItem('post_signin_reload')) {
        sessionStorage.setItem('post_signin_reload', 'true');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } else if (status === 'unauthenticated') {
      sessionStorage.removeItem('post_signin_reload');
    }
  }, [status]);

  if (status === 'loading') {
    return <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-hover)' }} className="pulse" />;
  }

  if (session && session.user) {
    return (
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginRight: '0.5rem' }}>
          <Link href="/history" style={{ color: 'var(--text-main)', textDecoration: 'none', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={16} /> <span className="hide-on-mobile">History</span>
          </Link>
          <Link href="/reminders" style={{ color: 'var(--text-main)', textDecoration: 'none', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Bell size={16} /> <span className="hide-on-mobile">Reminders</span>
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {session.user.image ? (
            <img 
              src={session.user.image} 
              alt={session.user.name || 'User'} 
              style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--border)' }}
            />
          ) : (
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--border)' }}>
              <User size={18} />
            </div>
          )}
        </div>
        <button
          onClick={() => signOut()}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-main)',
            padding: '0.4rem 0.75rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'background 0.2s, border-color 0.2s'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--bg-hover)';
            e.currentTarget.style.borderColor = 'var(--text-dim)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--bg-card)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
          <LogOut size={14} />
          <span className="hide-on-mobile">Sign Out</span>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn('google')}
      style={{
        background: 'var(--accent-primary)',
        color: '#fff',
        border: 'none',
        padding: '0.4rem 0.85rem',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.85rem',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        transition: 'transform 0.1s, box-shadow 0.2s'
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'none'}
    >
      <User size={16} />
      Sign In
    </button>
  );
}
