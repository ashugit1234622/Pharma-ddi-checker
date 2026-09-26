'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Salad, ShieldAlert, Stethoscope, Lightbulb, RefreshCw, Loader2, ArrowLeft, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface Tip {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: number;
}

interface GroupedTips {
  random_tip: Tip[];
  diet_plan: Tip[];
  diet_restriction: Tip[];
  medical_tip: Tip[];
}

const CATEGORY_EMOJI: Record<string, string> = {
  nutrition: '🥗',
  exercise: '🏃',
  medication: '💊',
  lifestyle: '🌟',
  hydration: '💧',
  sleep: '😴',
  monitoring: '📊',
  safety: '⚠️',
  general: '💡',
};

export default function HealthTipsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tips, setTips] = useState<GroupedTips | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'diet_plan' | 'diet_restriction' | 'medical_tip'>('diet_plan');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }
    if (status === 'authenticated') {
      fetchTips();
    }
  }, [status]);

  const fetchTips = async (isRetry = false) => {
    try {
      if (!isRetry) setLoading(true);
      const res = await fetch('/api/tips');
      if (!res.ok) throw new Error('Failed to fetch tips');
      const data = await res.json();
      
      const hasAnyTips = data.tips && (
        (data.tips.diet_plan?.length > 0) || 
        (data.tips.diet_restriction?.length > 0) || 
        (data.tips.medical_tip?.length > 0)
      );

      if (!hasAnyTips && !isRetry) {
        // Auto-generate for existing users who haven't got tips yet
        await regenerateTips(true);
      } else {
        setTips(data.tips);
      }
    } catch (e) {
      console.error('Error fetching tips:', e);
    } finally {
      if (!isRetry) setLoading(false);
    }
  };

  const regenerateTips = async (isAuto = false) => {
    try {
      setRegenerating(true);
      const res = await fetch('/api/tips/generate', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to regenerate');
      if (isAuto) {
        await fetchTips(true);
      } else {
        await fetchTips();
      }
    } catch (e) {
      console.error('Error regenerating tips:', e);
    } finally {
      setRegenerating(false);
    }
  };

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (status === 'loading' || loading) {
    return (
      <div className="tips-page">
        <div className="tips-loading">
          <Loader2 size={32} className="tips-spinner" />
          <p>Loading your personalized health tips...</p>
        </div>
      </div>
    );
  }

  const hasTips = tips && (tips.diet_plan.length > 0 || tips.diet_restriction.length > 0 || tips.medical_tip.length > 0);

  const tabConfig = [
    { key: 'diet_plan' as const, label: 'Diet Plan', icon: Salad, color: '#10b981', emoji: '🥗' },
    { key: 'diet_restriction' as const, label: 'Avoid', icon: ShieldAlert, color: '#ef4444', emoji: '🚫' },
    { key: 'medical_tip' as const, label: 'Medical', icon: Stethoscope, color: '#6366f1', emoji: '💊' },
  ];

  const currentTips = tips?.[activeTab] || [];
  const currentConfig = tabConfig.find(t => t.key === activeTab)!;

  return (
    <div className="tips-page">
      {/* Hero header */}
      <div className="tips-hero">
        <button className="tips-back-btn" onClick={() => router.push('/')}>
          <ArrowLeft size={18} /> Back
        </button>
        <div className="tips-hero-content">
          <Sparkles size={28} className="tips-hero-icon" />
          <h1 className="tips-hero-title">Your Health Guide</h1>
          <p className="tips-hero-subtitle">
            Personalized tips based on your profile, medications, and health conditions
          </p>
        </div>
        <button
          className="tips-regenerate-btn"
          onClick={regenerateTips}
          disabled={regenerating}
          title="Regenerate tips with AI"
        >
          {regenerating ? <Loader2 size={16} className="tips-spinner" /> : <RefreshCw size={16} />}
          {regenerating ? 'Generating...' : 'Refresh Tips'}
        </button>
      </div>

      {!hasTips ? (
        <div className="tips-empty">
          <Lightbulb size={48} className="tips-empty-icon" />
          <h2>No Tips Generated Yet</h2>
          <p>Your personalized health tips haven&apos;t been generated yet. Click below to create them based on your profile.</p>
          <button
            className="tips-generate-btn"
            onClick={regenerateTips}
            disabled={regenerating}
          >
            {regenerating ? (
              <><Loader2 size={18} className="tips-spinner" /> Generating with AI...</>
            ) : (
              <><Sparkles size={18} /> Generate My Tips</>
            )}
          </button>
        </div>
      ) : (
        <>
          {/* Tab switcher */}
          <div className="tips-tabs">
            {tabConfig.map(tab => (
              <button
                key={tab.key}
                className={`tips-tab ${activeTab === tab.key ? 'tips-tab-active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
                style={{ '--tab-color': tab.color } as React.CSSProperties}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
                <span className="tips-tab-count">{tips?.[tab.key]?.length || 0}</span>
              </button>
            ))}
          </div>

          {/* Tips cards */}
          <div className="tips-cards-grid">
            {currentTips.map((tip, idx) => {
              const emoji = CATEGORY_EMOJI[tip.category] || '💡';
              const isExpanded = expandedCards.has(tip.id);
              const isLong = tip.content.length > 150;

              return (
                <div
                  key={tip.id}
                  className={`tips-card tips-card-${activeTab}`}
                  style={{ animationDelay: `${idx * 60}ms`, '--card-accent': currentConfig.color } as React.CSSProperties}
                >
                  <div className="tips-card-header">
                    <span className="tips-card-emoji">{emoji}</span>
                    <h3 className="tips-card-title">{tip.title}</h3>
                    {tip.priority >= 3 && <span className="tips-card-priority">Critical</span>}
                  </div>
                  <p className={`tips-card-content ${isLong && !isExpanded ? 'tips-card-truncated' : ''}`}>
                    {tip.content}
                  </p>
                  {isLong && (
                    <button className="tips-card-expand" onClick={() => toggleCard(tip.id)}>
                      {isExpanded ? <><ChevronUp size={14} /> Less</> : <><ChevronDown size={14} /> More</>}
                    </button>
                  )}
                  <div className="tips-card-footer">
                    <span className="tips-card-category">{tip.category}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
