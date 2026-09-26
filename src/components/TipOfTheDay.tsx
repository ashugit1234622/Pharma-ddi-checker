'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { X, Lightbulb, Sparkles } from 'lucide-react';

interface Tip {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: number;
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

export default function TipOfTheDay() {
  const { data: session, status } = useSession();
  const [tip, setTip] = useState<Tip | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;

    // Check if we already showed a tip this session
    const lastShown = sessionStorage.getItem('tip_of_day_shown');
    if (lastShown) return;

    const fetchTip = async () => {
      try {
        const res = await fetch('/api/tips?type=random_tip');
        if (!res.ok) return;
        const data = await res.json();
        const tips = data.tips?.random_tip;
        if (!tips || tips.length === 0) {
          // For existing users: auto-trigger background generation if no tips exist
          fetch('/api/tips/generate', { method: 'POST' }).catch(() => {});
          return;
        }

        // Pick a random tip
        const randomIndex = Math.floor(Math.random() * tips.length);
        setTip(tips[randomIndex]);
        
        // Delay showing for a smooth entrance
        setTimeout(() => setVisible(true), 1500);
        sessionStorage.setItem('tip_of_day_shown', 'true');
      } catch {
        // Silently fail — tips are non-critical
      }
    };

    fetchTip();
  }, [status, session]);

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => setDismissed(true), 400);
  };

  if (dismissed || !tip) return null;

  const emoji = CATEGORY_EMOJI[tip.category] || '💡';

  return (
    <div className={`tip-of-day-overlay ${visible ? 'tip-visible' : ''}`}>
      <div className={`tip-of-day-card ${visible ? 'tip-card-visible' : ''}`}>
        <button className="tip-close-btn" onClick={dismiss} aria-label="Close tip">
          <X size={18} />
        </button>
        
        <div className="tip-header">
          <div className="tip-icon-wrap">
            <Sparkles size={20} className="tip-sparkle" />
            <span className="tip-emoji">{emoji}</span>
          </div>
          <div className="tip-label">
            <span className="tip-label-text">Tip of the Day</span>
            <span className="tip-category-badge">{tip.category}</span>
          </div>
        </div>

        <h3 className="tip-title">{tip.title}</h3>
        <p className="tip-content">{tip.content}</p>

        <button className="tip-dismiss-btn" onClick={dismiss}>
          Got it! <Lightbulb size={14} />
        </button>
      </div>
    </div>
  );
}
