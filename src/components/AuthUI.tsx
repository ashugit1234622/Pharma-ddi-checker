'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { triggerSignIn } from '@/lib/triggerSignIn';
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
        <Link href="/profile" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit' }}>
          {session.user.image ? (
            <img src={session.user.image} alt={session.user.name || 'User'} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--border)' }} />
          ) : (
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-card)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={16} />
            </div>
          )}
        </Link>
        <button onClick={() => signOut()} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', padding: '0.35rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => triggerSignIn()}
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '10px', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.9rem' }}
    >
      <User size={16} /> Sign In
    </button>
  );
}
