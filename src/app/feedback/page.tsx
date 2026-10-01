'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { MessageSquare, AlertTriangle, Lightbulb, User, Loader2, CheckCircle2 } from 'lucide-react';
import CinematicBackground from '@/components/CinematicBackground';

export default function FeedbackPage() {
  const { status } = useSession();
  const router = useRouter();

  const [category, setCategory] = useState('Bug Report');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  if (status === 'unauthenticated') {
    router.push('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Please enter your feedback.');
      return;
    }
    
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, content })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      setIsSuccess(true);
      setContent('');
      
      // Reset success state after a few seconds
      setTimeout(() => {
        setIsSuccess(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pt-20 px-4 md:px-6 relative overflow-hidden" style={{ zIndex: 1 }}>
      <CinematicBackground />
      
      <div className="max-w-2xl mx-auto" style={{ zIndex: 10, position: 'relative' }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #fff 0%, #a5b4fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.5rem' }}>
            Your Feedback Matters
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '500px', margin: '0 auto' }}>
            Help us improve Farma. Whether you found a bug or have a feature request, we want to hear from you.
          </p>
        </div>

        <div className="card glass-panel" style={{ padding: '2rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Category Selection */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-main)' }}>Category</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                <CategoryButton 
                  active={category === 'Bug Report'} 
                  onClick={() => setCategory('Bug Report')}
                  icon={<AlertTriangle size={18} />}
                  label="Bug Report"
                />
                <CategoryButton 
                  active={category === 'Feature Request'} 
                  onClick={() => setCategory('Feature Request')}
                  icon={<Lightbulb size={18} />}
                  label="Feature Request"
                />
                <CategoryButton 
                  active={category === 'UI/UX Issue'} 
                  onClick={() => setCategory('UI/UX Issue')}
                  icon={<MessageSquare size={18} />}
                  label="UI/UX Issue"
                />
                <CategoryButton 
                  active={category === 'General'} 
                  onClick={() => setCategory('General')}
                  icon={<User size={18} />}
                  label="General"
                />
              </div>
            </div>

            {/* Feedback Content */}
            <div>
              <label htmlFor="feedback-content" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-main)' }}>Your Feedback</label>
              <textarea
                id="feedback-content"
                rows={6}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Describe the issue you encountered or the feature you'd like to see..."
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '1rem',
                  color: 'var(--text-main)',
                  resize: 'vertical',
                  fontSize: '0.95rem',
                  transition: 'border-color 0.2s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div style={{ color: 'var(--error)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={16} /> {error}
              </div>
            )}

            {/* Success Message */}
            {isSuccess && (
              <div style={{ color: 'var(--success)', fontSize: '0.95rem', background: 'rgba(34, 197, 94, 0.1)', padding: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={18} /> Thank you! Your feedback has been submitted successfully.
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="primary-button"
              style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '1rem' }}
            >
              {isSubmitting ? (
                <><Loader2 size={18} className="animate-spin" /> Submitting...</>
              ) : (
                'Submit Feedback'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function CategoryButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '0.75rem',
        borderRadius: '8px',
        border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
        background: active ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-input)',
        color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
        fontSize: '0.9rem',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {icon}
      {label}
    </button>
  );
}
