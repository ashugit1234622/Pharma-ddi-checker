'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, MessageSquare, ShieldAlert, CheckCircle2, User, Clock } from 'lucide-react';
import CinematicBackground from '@/components/CinematicBackground';

const ADMIN_EMAIL = 'ashirwadsingh857@gmail.com';

interface Feedback {
  id: string;
  user_name: string;
  user_tier: string;
  category: string;
  content: string;
  created_at: string;
}

export default function AdminFeedbacksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }

    if (status === 'authenticated') {
      if (session?.user?.email !== ADMIN_EMAIL) {
        router.push('/'); // Redirect non-admins silently
        return;
      }

      fetchFeedbacks();
    }
  }, [status, session, router]);

  const fetchFeedbacks = async () => {
    try {
      const res = await fetch('/api/admin/feedbacks');
      if (!res.ok) throw new Error('Failed to fetch feedbacks');
      const data = await res.json();
      setFeedbacks(data.feedbacks || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (session?.user?.email !== ADMIN_EMAIL) {
    return null;
  }

  return (
    <div className="min-h-screen pt-20 px-4 md:px-6 relative overflow-hidden" style={{ zIndex: 1 }}>
      <CinematicBackground />
      
      <div className="max-w-4xl mx-auto" style={{ zIndex: 10, position: 'relative' }}>
        <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ShieldAlert size={32} style={{ color: 'var(--warning)' }} />
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Admin Feedback Dashboard
          </h1>
        </div>

        {error && (
          <div style={{ color: 'var(--error)', marginBottom: '2rem' }}>Error: {error}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {feedbacks.length === 0 ? (
            <div className="card glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p>No feedback received yet. All caught up!</p>
            </div>
          ) : (
            feedbacks.map(f => (
              <div key={f.id} className="card glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: 'var(--bg-input)', padding: '0.5rem', borderRadius: '50%' }}>
                      <User size={18} style={{ color: 'var(--text-dim)' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {f.user_name}
                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '12px', background: f.user_tier === 'PRO' ? 'var(--pharmacologist-accent)' : 'var(--primary-accent)', color: '#000', fontWeight: 'bold' }}>
                          {f.user_tier}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                        <MessageSquare size={12} /> {f.category}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={14} /> {new Date(f.created_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ color: 'var(--text-main)', lineHeight: 1.6, fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
                  {f.content}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
