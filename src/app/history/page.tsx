'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { FileText, Clock, ScanBarcode, MessageSquare, AlertCircle } from 'lucide-react';
import CinematicBackground from '@/components/CinematicBackground';

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      setLoading(false);
      return;
    }

    if (status === 'authenticated') {
      fetch('/api/history')
        .then(res => {
          if (!res.ok) throw new Error('Failed to load history');
          return res.json();
        })
        .then(data => {
          setRecords(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setError('Could not load history');
          setLoading(false);
        });
    }
  }, [status]);

  if (status === 'loading' || loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
        <div className="pulse" style={{ width: '40px', height: '40px', margin: '0 auto 1rem', background: 'var(--accent-primary)', borderRadius: '50%' }} />
        Loading your history...
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
        <AlertCircle size={48} style={{ color: 'var(--accent-primary)', margin: '0 auto 1rem' }} />
        <h2 style={{ fontSize: '1.8rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-main)' }}>Sign in to view history</h2>
        <p style={{ color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Please sign in with your Google account to view your saved DDI checks, prescriptions, and AI consultations.
        </p>
      </div>
    );
  }

  return (
    <>
      <CinematicBackground />
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '2rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Clock size={32} style={{ color: 'var(--accent-primary)' }} />
          Patient History
        </h1>

        {error && (
          <div style={{ padding: '1rem', background: 'rgba(255, 60, 60, 0.1)', color: '#ff6b6b', borderRadius: '12px', marginBottom: '2rem', border: '1px solid rgba(255,60,60,0.2)' }}>
            {error}
          </div>
        )}

        {records.length === 0 && !error ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <FileText size={48} style={{ color: 'var(--text-dim)', margin: '0 auto 1rem', opacity: 0.5 }} />
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>No history found</h3>
            <p style={{ color: 'var(--text-dim)' }}>Your saved interaction checks and scanned prescriptions will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {records.map((record) => (
              <div 
                key={record.id} 
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  gap: '1.5rem',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.2)';
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                <div style={{
                  width: '56px', height: '56px', borderRadius: '12px',
                  background: 'rgba(92, 107, 192, 0.1)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {record.record_type === 'ddi_check' && <AlertCircle size={28} style={{ color: 'var(--accent-primary)' }} />}
                  {record.record_type === 'prescription_ocr' && <ScanBarcode size={28} style={{ color: '#4caf50' }} />}
                  {record.record_type === 'ai_chat' && <MessageSquare size={28} style={{ color: '#ff9800' }} />}
                </div>

                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                    {record.title}
                  </h3>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '0.8rem' }}>
                    {record.summary || 'No summary available.'}
                  </p>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', opacity: 0.8 }}>
                    {new Date(record.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
