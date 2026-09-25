'use client';

import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Suspense } from 'react';

function ErrorContent() {
  const params = useSearchParams();
  const error = params.get('error');

  const messages: Record<string, string> = {
    Configuration: 'Server configuration error. Please contact support.',
    AccessDenied: 'Access was denied.',
    Verification: 'The verification link may have expired.',
    Default: 'An unexpected error occurred during sign-in.',
  };

  const msg = messages[error || 'Default'] || messages.Default;

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-main)', fontFamily: 'inherit',
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '2.5rem 2rem', maxWidth: '400px', width: '90%',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
        <h2 style={{ color: 'var(--text-main)', marginBottom: '0.75rem' }}>Sign-in Error</h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>{msg}</p>
        <button
          onClick={() => signIn('google')}
          style={{
            background: 'var(--accent-primary)', color: '#fff', border: 'none',
            padding: '0.65rem 1.5rem', borderRadius: '8px', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.95rem',
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: 'var(--bg-main)' }} />}>
      <ErrorContent />
    </Suspense>
  );
}
