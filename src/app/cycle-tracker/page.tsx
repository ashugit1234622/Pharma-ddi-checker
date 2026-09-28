'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { CalendarDays, AlertCircle, Loader2, Sparkles, Droplets } from 'lucide-react';
import { calculateCycle, CyclePrediction } from '@/lib/cycle-tracker';

export default function CycleTrackerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [prediction, setPrediction] = useState<CyclePrediction | null>(null);
  const [insight, setInsight] = useState<string>('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }

    if (status === 'authenticated') {
      fetch('/api/profile')
        .then(res => res.json())
        .then(data => {
          if (data.profile) {
            setProfile(data.profile);
            if (data.profile.gender !== 'female') {
              router.push('/');
              return;
            }
            if (!data.profile.last_menstruation_date) {
              // Redirect to onboarding if date is missing
              router.push('/onboarding');
              return;
            }

            const calculated = calculateCycle({
              lastPeriodDate: new Date(data.profile.last_menstruation_date),
              age: data.profile.age || 30,
              conditions: data.profile.underlying_diseases || [],
              medications: data.profile.current_medications || []
            });
            setPrediction(calculated);
            setLoading(false);
            generateInsight(data.profile, calculated);
          }
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [status, router]);

  const generateInsight = async (prof: any, pred: CyclePrediction) => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const cacheKey = `cycle_insight_${todayStr}`;
      
      const cachedInsight = localStorage.getItem(cacheKey);
      if (cachedInsight) {
        setInsight(cachedInsight);
        return;
      }

      const res = await fetch('/api/cycle/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: prof, prediction: pred })
      });
      const data = await res.json();
      
      if (data.insight && !data.insight.includes('Stay hydrated')) {
        localStorage.setItem(cacheKey, data.insight);
      }
      setInsight(data.insight);
    } catch (e) {
      console.error(e);
      setInsight("Stay hydrated and listen to your body! Get plenty of rest today.");
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (!prediction) return null;

  const today = new Date();
  const daysUntilNext = Math.ceil((prediction.nextPeriodDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
  const isLate = daysUntilNext < 0;

  // Determine current phase
  let currentPhase = prediction.phases.find(p => today >= p.startDate && today <= p.endDate);
  if (!currentPhase) {
    currentPhase = prediction.phases[3]; // Fallback to luteal if between
  }

  const startOfCycle = prediction.phases[0].startDate;
  const diffTime = today.getTime() - startOfCycle.getTime();
  const diffDays = diffTime / (1000 * 3600 * 24);
  const progressPercent = Math.max(0, Math.min(100, (diffDays / prediction.cycleLength) * 100));

  return (
    <div className="container" style={{ paddingTop: '100px', maxWidth: '800px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <CalendarDays size={32} style={{ color: '#d946ef' }} />
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Cycle Tracker</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Next Period Card */}
        <div className="card" style={{ background: 'linear-gradient(135deg, rgba(217,70,239,0.1), rgba(236,72,153,0.05))', border: '1px solid rgba(217,70,239,0.2)' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--text-dim)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Droplets size={16} color="#d946ef" /> Next Period
          </h2>
          <div style={{ fontSize: '3rem', fontWeight: 800, color: '#d946ef', lineHeight: 1 }}>
            {isLate ? `${Math.abs(daysUntilNext)} Days Late` : `In ${daysUntilNext} Days`}
          </div>
          <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Expected: {prediction.nextPeriodDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        </div>

        {/* Current Phase Card */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Current Phase</h2>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
            {currentPhase.name}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {currentPhase.description}
          </div>
        </div>
      </div>

      {/* AI Insight Card */}
      <div className="card" style={{ marginBottom: '2rem', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
        <h2 style={{ fontSize: '1rem', color: 'var(--accent-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={18} /> Personalized Insight
        </h2>
        <div style={{ fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
          {insight ? insight : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
              <Loader2 className="spinner" size={16} /> Generating personalized insight...
            </div>
          )}
        </div>
      </div>

      {/* AI Adjustments & Medical Notes */}
      {prediction.modifierNotes.length > 0 && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--warning)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} /> Smart Adjustments
          </h2>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: '0.75rem' }}>Your predictions were algorithmically adjusted based on your medical profile:</p>
            <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {prediction.modifierNotes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Visual Journey Chart */}
      <div className="card">
        <h2 style={{ fontSize: '1rem', color: 'var(--text-dim)', marginBottom: '1.5rem' }}>Cycle Journey ({prediction.cycleLength} Days)</h2>
        
        {/* Progress Bar Container */}
        <div style={{ position: 'relative', height: '14px', borderRadius: '7px', background: 'var(--bg-card)', display: 'flex', overflow: 'hidden', marginBottom: '2.5rem' }}>
          {prediction.phases.map((phase, i) => {
            const phaseDays = Math.ceil((phase.endDate.getTime() - phase.startDate.getTime()) / (1000 * 3600 * 24)) + 1;
            const width = `${(phaseDays / prediction.cycleLength) * 100}%`;
            
            // Colors for phases
            let color = '#d946ef'; // Menstruation (Pink)
            if (phase.name === 'Follicular Phase') color = '#a855f7'; // Purple
            if (phase.name === 'Ovulation Window') color = '#3b82f6'; // Blue
            if (phase.name === 'Luteal Phase') color = '#f59e0b'; // Yellow
            
            return (
              <div key={i} style={{ width, background: color, opacity: 0.7 }} title={phase.name} />
            );
          })}
          
          {/* Today Indicator */}
          <div style={{
            position: 'absolute',
            top: '-4px',
            bottom: '-4px',
            width: '6px',
            background: '#ffffff',
            borderRadius: '3px',
            left: `calc(${progressPercent}% - 3px)`,
            boxShadow: '0 0 12px rgba(255,255,255,1)',
            zIndex: 10
          }}>
            <div style={{ position: 'absolute', top: '-22px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.75rem', fontWeight: 'bold', color: 'white', background: 'var(--bg-card)', padding: '2px 8px', borderRadius: '4px' }}>Today</div>
          </div>
        </div>

        {/* Phase Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {prediction.phases.map((phase, i) => {
            const isCurrent = currentPhase.name === phase.name;
            let color = '#d946ef';
            if (phase.name === 'Follicular Phase') color = '#a855f7';
            if (phase.name === 'Ovulation Window') color = '#3b82f6';
            if (phase.name === 'Luteal Phase') color = '#f59e0b';

            return (
              <div key={i} style={{ 
                padding: '1rem', 
                borderRadius: '8px',
                background: isCurrent ? 'rgba(255,255,255,0.03)' : 'transparent',
                border: isCurrent ? `1px solid ${color}` : '1px solid transparent',
                borderLeft: `4px solid ${color}`,
                transition: 'all 0.2s',
                boxShadow: isCurrent ? `0 0 15px ${color}33` : 'none'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, color: isCurrent ? color : 'var(--text-main)' }}>{phase.name}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                  {new Date(phase.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(phase.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{phase.description}</div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
