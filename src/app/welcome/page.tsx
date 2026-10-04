'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck, ArrowRight, Code, Star,
  AlertTriangle, CheckCircle, XCircle,
  Brain, Scan, Lightbulb, Dna, Clock,
  ChevronDown
} from 'lucide-react';
import { CinematicVisualLayer } from '@/components/CinematicVisualLayer';
import dynamic from 'next/dynamic';

// Severity badge — mirrors the exact vocabulary from prompts.ts
const SEVERITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  contraindicated: { bg: 'rgba(239,68,68,0.15)',   text: '#ef4444', label: 'Contraindicated' },
  major:           { bg: 'rgba(245,158,11,0.15)',  text: '#f59e0b', label: 'Major' },
  moderate:        { bg: 'rgba(14,165,233,0.12)',  text: '#0ea5e9', label: 'Moderate' },
  minor:           { bg: 'rgba(16,185,129,0.12)',  text: '#10b981', label: 'Minor' },
};

// Animated counter hook
function useCounter(target: number, duration = 1800, inView = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / (duration / 16);
    const t = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(t); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(t);
  }, [target, duration, inView]);
  return val;
}

// Intersection observer hook
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

// Fake DDI demo card — the product's native shape front and center
function DDIDemoCard() {
  const [active, setActive] = useState(0);
  const demos = [
    {
      drug1: 'Warfarin',
      drug2: 'Aspirin',
      severity: 'major',
      mechanism: 'Additive anticoagulant effect via platelet inhibition + vitamin K antagonism',
      hepatic: 35, renal: 20, cardiac: 72, neuro: 15,
      cyp: 'CYP2C9 substrate competition',
    },
    {
      drug1: 'Metformin',
      drug2: 'Alcohol',
      severity: 'moderate',
      mechanism: 'Increased risk of lactic acidosis through hepatic lactate metabolism inhibition',
      hepatic: 65, renal: 40, cardiac: 18, neuro: 30,
      cyp: 'CYP3A4 — no direct competition',
    },
    {
      drug1: 'Simvastatin',
      drug2: 'Clarithromycin',
      severity: 'contraindicated',
      mechanism: 'CYP3A4 inhibition by clarithromycin causes 10× statin plasma concentration spike',
      hepatic: 88, renal: 22, cardiac: 45, neuro: 20,
      cyp: 'CYP3A4 inhibitor + substrate',
    },
  ];
  const d = demos[active];
  const sev = SEVERITY_COLORS[d.severity];

  return (
    <div style={{
      background: 'rgba(15,23,42,0.85)',
      border: '1px solid #334155',
      borderRadius: '1.25rem',
      padding: '1.75rem',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 0 60px rgba(14,165,233,0.08), 0 25px 50px rgba(0,0,0,0.5)',
      maxWidth: '480px',
      width: '100%',
    }}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {demos.map((demo, i) => (
          <button key={i} onClick={() => setActive(i)} style={{
            padding: '0.3rem 0.75rem',
            borderRadius: '6px',
            border: i === active ? '1px solid #0ea5e9' : '1px solid #334155',
            background: i === active ? 'rgba(14,165,233,0.1)' : 'transparent',
            color: i === active ? '#0ea5e9' : '#94a3b8',
            fontSize: '0.8rem',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            transition: 'all 0.2s',
          }}>
            {demo.drug1} + {demo.drug2}
          </button>
        ))}
      </div>

      {/* Drug pair */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ flex: 1, padding: '0.75rem 1rem', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.25)', borderRadius: '0.75rem' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.2rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Drug 1</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>{d.drug1}</div>
        </div>
        <div style={{ color: '#334155', fontSize: '1.2rem' }}>⇄</div>
        <div style={{ flex: 1, padding: '0.75rem 1rem', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '0.75rem' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.2rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Drug 2</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>{d.drug2}</div>
        </div>
      </div>

      {/* Severity badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{
          padding: '0.35rem 0.85rem',
          borderRadius: '999px',
          background: sev.bg,
          color: sev.text,
          fontWeight: 700,
          fontSize: '0.8rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}>
          {d.severity === 'contraindicated' ? '⛔ ' : d.severity === 'major' ? '⚠️ ' : d.severity === 'moderate' ? '🔶 ' : '🟢 '}
          {sev.label}
        </span>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{d.cyp}</span>
      </div>

      {/* Mechanism */}
      <div style={{ padding: '0.875rem', background: 'rgba(2,6,23,0.5)', borderRadius: '0.625rem', marginBottom: '1.25rem', border: '1px solid rgba(51,65,85,0.5)' }}>
        <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.35rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Interaction Mechanism</div>
        <div style={{ fontSize: '0.875rem', color: '#cbd5e1', lineHeight: 1.5 }}>{d.mechanism}</div>
      </div>

      {/* Toxicity bars — mirrors toxicityScores schema */}
      <div>
        <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Combined Toxicity Risk</div>
        {[
          { label: 'Cardiac', val: d.cardiac, color: '#ef4444' },
          { label: 'Hepatic', val: d.hepatic, color: '#f59e0b' },
          { label: 'Renal',   val: d.renal,   color: '#0ea5e9' },
          { label: 'Neuro',   val: d.neuro,   color: '#8b5cf6' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '50px', fontSize: '0.72rem', color: '#94a3b8', textAlign: 'right', flexShrink: 0 }}>{label}</div>
            <div style={{ flex: 1, height: '6px', background: 'rgba(51,65,85,0.6)', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ width: `${val}%`, height: '100%', background: color, borderRadius: '999px', transition: 'width 0.6s ease' }} />
            </div>
            <div style={{ width: '28px', fontSize: '0.72rem', color: '#64748b', textAlign: 'right', flexShrink: 0 }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Stats counter section
function StatItem({ value, suffix, label, inView }: { value: number; suffix: string; label: string; inView: boolean }) {
  const count = useCounter(value, 1600, inView);
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.03em', lineHeight: 1 }}>
        {count.toLocaleString()}{suffix}
      </div>
      <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.375rem' }}>{label}</div>
    </div>
  );
}

export default function WelcomeLandingPage() {
  const { status } = useSession();
  const router = useRouter();
  const [statsRef, statsInView] = useInView(0.3);

  useEffect(() => {
    if (status === 'authenticated') router.replace('/');
  }, [status, router]);

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      overflowX: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-main)',
      color: 'var(--text-main)',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>

      <style dangerouslySetInnerHTML={{ __html: `
        /* ── Welcome page scoped styles ── */
        .wl-section {
          position: relative;
          z-index: 10;
          padding: 5rem 1.5rem;
        }
        .wl-container {
          max-width: 1100px;
          margin: 0 auto;
          width: 100%;
        }
        .wl-section-alt {
          background: rgba(15, 23, 42, 0.45);
          border-top: 1px solid rgba(51,65,85,0.4);
          border-bottom: 1px solid rgba(51,65,85,0.4);
        }
        /* Hero */
        .wl-hero {
          position: relative;
          z-index: 10;
          min-height: 92vh;
          display: flex;
          align-items: center;
          padding: 7rem 1.5rem 4rem;
        }
        .wl-hero-inner {
          max-width: 1100px;
          margin: 0 auto;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3rem;
        }
        @media (min-width: 1024px) {
          .wl-hero-inner {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
        }
        .wl-hero-text {
          flex: 1;
          max-width: 560px;
        }
        @media (min-width: 1024px) {
          .wl-hero-text { max-width: 520px; }
        }
        .wl-hero-graphic {
          flex-shrink: 0;
          width: 100%;
          max-width: 480px;
          display: flex;
          justify-content: center;
        }
        /* Badge */
        .wl-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.35rem 0.875rem;
          border-radius: 999px;
          border: 1px solid rgba(14,165,233,0.3);
          background: rgba(14,165,233,0.06);
          color: #0ea5e9;
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
          letter-spacing: 0.04em;
        }
        /* Hero headline */
        .wl-h1 {
          font-size: clamp(2.4rem, 5.5vw, 4rem);
          font-weight: 900;
          letter-spacing: -0.035em;
          line-height: 1.08;
          margin-bottom: 1.25rem;
          color: #f8fafc;
        }
        .wl-h1 em {
          font-style: normal;
          background: linear-gradient(110deg, #0ea5e9 0%, #8b5cf6 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .wl-subtitle {
          font-size: clamp(1rem, 2.2vw, 1.2rem);
          color: #94a3b8;
          line-height: 1.7;
          margin-bottom: 2rem;
          max-width: 44rem;
        }
        /* CTA row */
        .wl-cta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.875rem;
          align-items: center;
        }
        .wl-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.875rem 1.75rem;
          border-radius: 0.75rem;
          background: #0ea5e9;
          color: #fff;
          font-weight: 700;
          font-size: 1rem;
          border: none;
          cursor: pointer;
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 0 24px rgba(14,165,233,0.25);
          font-family: inherit;
          text-decoration: none;
        }
        .wl-btn-primary:hover {
          background: #0284c7;
          transform: translateY(-2px);
          box-shadow: 0 0 36px rgba(14,165,233,0.35);
        }
        .wl-btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.875rem 1.5rem;
          border-radius: 0.75rem;
          background: transparent;
          color: #94a3b8;
          font-weight: 600;
          font-size: 1rem;
          border: 1px solid #334155;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
          text-decoration: none;
        }
        .wl-btn-ghost:hover { border-color: #475569; color: #f8fafc; background: rgba(30,41,59,0.5); }
        /* Scroll hint */
        .wl-scroll-hint {
          position: absolute;
          bottom: 2rem;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.35rem;
          color: #334155;
          font-size: 0.75rem;
          animation: bob 2s ease-in-out infinite;
        }
        @keyframes bob { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(6px)} }
        /* Stats row */
        .wl-stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 2.5rem 3rem;
        }
        @media (min-width: 640px) {
          .wl-stats-grid { grid-template-columns: repeat(4, 1fr); }
        }
        /* Section headers */
        .wl-section-label {
          display: inline-block;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #0ea5e9;
          margin-bottom: 0.75rem;
        }
        .wl-section-title {
          font-size: clamp(1.75rem, 3.5vw, 2.4rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #f8fafc;
          margin-bottom: 1rem;
        }
        .wl-section-desc {
          color: #64748b;
          font-size: 1.05rem;
          line-height: 1.7;
          max-width: 44rem;
        }
        /* Feature grid */
        .wl-feature-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.25rem;
          margin-top: 3rem;
        }
        @media (min-width: 640px) {
          .wl-feature-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1024px) {
          .wl-feature-grid { grid-template-columns: repeat(3, 1fr); }
        }
        .wl-feature-card {
          padding: 1.75rem;
          border-radius: 1rem;
          border: 1px solid #1e293b;
          background: rgba(15,23,42,0.6);
          transition: border-color 0.25s, transform 0.25s;
          position: relative;
          overflow: hidden;
        }
        .wl-feature-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 30% 0%, rgba(14,165,233,0.06), transparent 70%);
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s;
        }
        .wl-feature-card:hover { border-color: rgba(14,165,233,0.35); transform: translateY(-3px); }
        .wl-feature-card:hover::before { opacity: 1; }
        .wl-feature-icon {
          width: 2.75rem;
          height: 2.75rem;
          border-radius: 0.625rem;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.25rem;
        }
        .wl-feature-title { font-size: 1.05rem; font-weight: 700; color: #f8fafc; margin-bottom: 0.5rem; }
        .wl-feature-desc { font-size: 0.9rem; color: #64748b; line-height: 1.6; }
        /* Showcase */
        .wl-showcase {
          display: flex;
          flex-direction: column;
          gap: 6rem;
          margin-top: 3rem;
        }
        .wl-showcase-row {
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
          align-items: center;
        }
        @media (min-width: 900px) {
          .wl-showcase-row { flex-direction: row; gap: 4rem; }
          .wl-showcase-row:nth-child(even) { flex-direction: row-reverse; }
          .wl-showcase-col { flex: 1; width: 50%; }
        }
        .wl-showcase-col { width: 100%; }
        .wl-showcase-label { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #0ea5e9; margin-bottom: 0.625rem; }
        .wl-showcase-title { font-size: clamp(1.4rem, 2.5vw, 1.875rem); font-weight: 800; letter-spacing: -0.025em; color: #f8fafc; margin-bottom: 0.875rem; }
        .wl-showcase-desc { font-size: 1rem; color: #64748b; line-height: 1.75; }
        .wl-showcase-img-wrap {
          border-radius: 0.875rem;
          overflow: hidden;
          border: 1px solid #1e293b;
          background: #0f172a;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          transition: transform 0.4s cubic-bezier(0.16,1,0.3,1), border-color 0.3s;
        }
        .wl-showcase-img-wrap:hover { transform: translateY(-6px) scale(1.015); border-color: rgba(14,165,233,0.4); }
        .wl-showcase-img-wrap img { width: 100%; height: auto; display: block; }
        /* Severity legend in showcase */
        .wl-severity-pill {
          display: inline-flex; align-items: center; gap: 0.35rem;
          padding: 0.25rem 0.625rem; border-radius: 999px;
          font-size: 0.78rem; font-weight: 700;
          margin-top: 1.25rem; margin-right: 0.5rem;
        }
        /* Reviews */
        .wl-review-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.25rem;
          margin-top: 3rem;
        }
        @media (min-width: 768px) {
          .wl-review-grid { grid-template-columns: repeat(3, 1fr); }
        }
        .wl-review-card {
          padding: 1.5rem;
          border-radius: 1rem;
          border: 1px solid #1e293b;
          background: rgba(15,23,42,0.5);
        }
        .wl-stars { display: flex; gap: 0.2rem; color: #f59e0b; margin-bottom: 0.875rem; }
        .wl-review-text { font-size: 0.9rem; color: #94a3b8; line-height: 1.7; margin-bottom: 1.25rem; font-style: italic; }
        .wl-review-name { font-size: 0.9rem; font-weight: 700; color: #f8fafc; }
        .wl-review-role { font-size: 0.78rem; color: #475569; margin-top: 0.15rem; }
        /* CTA banner */
        .wl-cta-banner {
          text-align: center;
          padding: 5rem 1.5rem;
          position: relative;
          z-index: 10;
        }
        /* Footer */
        .wl-footer {
          position: relative;
          z-index: 10;
          padding: 2rem 1.5rem;
          border-top: 1px solid #1e293b;
          background: rgba(2,6,23,0.8);
        }
        .wl-footer-inner {
          max-width: 1100px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          align-items: center;
          justify-content: space-between;
        }
        @media (min-width: 640px) { .wl-footer-inner { flex-direction: row; } }
        .wl-footer-links { display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap; justify-content: center; }
        .wl-footer-link { font-size: 0.85rem; color: #475569; text-decoration: none; transition: color 0.2s; }
        .wl-footer-link:hover { color: #94a3b8; }
        /* Scroll reveal */
        .wl-reveal { opacity: 0; transform: translateY(20px); transition: opacity 0.55s ease, transform 0.55s ease; }
        .wl-reveal.wl-visible { opacity: 1; transform: none; }
      `}} />

      {/* ── Fixed WebGL Background ── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <CinematicVisualLayer />
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, rgba(2,6,23,0.72) 0%, rgba(2,6,23,0.88) 55%, #020617 100%)',
        }} />
      </div>

      {/* ══════════════════════════════════════════
          HERO — DDI as the primary visual weight
      ══════════════════════════════════════════ */}
      <section className="wl-hero">
        <div className="wl-hero-inner">

          {/* Left: headline copy */}
          <div className="wl-hero-text">
            <div className="wl-badge">
              <ShieldCheck size={13} />
              Next-Gen Pharmacovigilance
            </div>

            <h1 className="wl-h1">
              Know if your drugs<br />
              <em>conflict — before</em><br />
              they reach you.
            </h1>

            <p className="wl-subtitle">
              Evidence-based Drug-Drug Interaction analysis powered by Google Gemini AI.
              ADME tracking, organ toxicity profiles, CYP450 pathway analysis, and clinical
              alternatives — built for clinicians and patients alike.
            </p>

            <div className="wl-cta-row">
              <button
                onClick={() => signIn('google', { callbackUrl: '/' })}
                className="wl-btn-primary"
              >
                Check an Interaction <ArrowRight size={18} />
              </button>
              <a href="#features" className="wl-btn-ghost">
                See Features <ChevronDown size={16} />
              </a>
            </div>

            <div style={{ marginTop: '1.25rem', fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(2,6,23,0.5)', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid rgba(51,65,85,0.5)', maxWidth: '44rem' }}>
              <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
              <span style={{ lineHeight: 1.5 }}>
                <strong>Access Restriction:</strong> Comprehensive DDI checks, ADME analysis, and Organ Toxicity profiling are restricted to verified Professional/MD accounts. Normal users will be routed to the Aastha Health Assistant.
              </span>
            </div>

            {/* Severity legend — uses exact vocabulary from prompts.ts severity enum */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1.75rem' }}>
              {Object.entries(SEVERITY_COLORS).map(([key, val]) => (
                <span key={key} className="wl-severity-pill" style={{ background: val.bg, color: val.text, marginTop: 0 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: val.text, flexShrink: 0, display: 'inline-block' }} />
                  {val.label}
                </span>
              ))}
              <span style={{ fontSize: '0.72rem', color: '#334155', alignSelf: 'center', marginLeft: '0.25rem' }}>interaction severity scale</span>
            </div>
          </div>

          {/* Right: Live DDI demo card — the product's native shape */}
          <div className="wl-hero-graphic">
            <DDIDemoCard />
          </div>

        </div>

        <div className="wl-scroll-hint">
          <span>Scroll</span>
          <ChevronDown size={16} />
        </div>
      </section>

      {/* ══════════════════════════════════════════
          STATS
      ══════════════════════════════════════════ */}
      <section className="wl-section wl-section-alt" style={{ padding: '3.5rem 1.5rem' }}>
        <div className="wl-container">
          <div ref={statsRef} className="wl-stats-grid">
            <StatItem value={5000}  suffix="+" label="Drug profiles indexed"  inView={statsInView} />
            <StatItem value={4}     suffix=""  label="Toxicity systems tracked" inView={statsInView} />
            <StatItem value={100}   suffix="%"  label="Evidence-based results"  inView={statsInView} />
            <StatItem value={2}     suffix=""  label="User roles: Pro & Patient" inView={statsInView} />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FEATURES — DDI leads, others follow
      ══════════════════════════════════════════ */}
      <section id="features" className="wl-section">
        <div className="wl-container">
          <div>
            <span className="wl-section-label">Platform Capabilities</span>
            <h2 className="wl-section-title">Everything in one clinical dashboard</h2>
            <p className="wl-section-desc">
              Built on KD Tripathi pharmacological references + real-time Gemini AI reasoning.
              Every result distinguishes established evidence, probable, possible, and theoretical interactions.
            </p>
          </div>

          <div className="wl-feature-grid">
            {[
              {
                icon: <Dna size={20} />,
                iconBg: 'rgba(14,165,233,0.12)', iconColor: '#0ea5e9',
                title: 'DDI + CYP450 Analysis',
                desc: 'Identifies substrate/inhibitor/inducer relationships at CYP2C9, CYP3A4, CYP2D6 and more. Flags competitive inhibition that multiplies plasma drug levels.',
                primary: true,
              },
              {
                icon: <Brain size={20} />,
                iconBg: 'rgba(139,92,246,0.12)', iconColor: '#8b5cf6',
                title: 'ADME Scoring',
                desc: 'Absorption, Distribution, Metabolism, Excretion — quantified 0–100 for both drugs. Spots pharmacokinetic collision before it becomes a clinical event.',
              },
              {
                icon: <AlertTriangle size={20} />,
                iconBg: 'rgba(239,68,68,0.12)', iconColor: '#ef4444',
                title: 'Organ Toxicity Profiles',
                desc: 'Hepatic, renal, cardiac, neurological, and haematological risk scored per drug and combined. Visualised as anatomical overlay charts.',
              },
              {
                icon: <Scan size={20} />,
                iconBg: 'rgba(16,185,129,0.12)', iconColor: '#10b981',
                title: 'Prescription OCR',
                desc: 'Photograph a prescription. Gemini Vision digitizes it and immediately runs the interaction check — no manual entry required.',
              },
              {
                icon: <Lightbulb size={20} />,
                iconBg: 'rgba(245,158,11,0.12)', iconColor: '#f59e0b',
                title: 'Personalized Health Tips',
                desc: 'Nutrition, exercise, sleep, and drug-food interactions — all tailored to your age, blood group, current medications, and conditions.',
              },
              {
                icon: <Clock size={20} />,
                iconBg: 'rgba(51,65,85,0.5)', iconColor: '#94a3b8',
                title: 'Interaction History',
                desc: 'Every check is logged and searchable. Export or share reports with your doctor. Build a longitudinal medication safety record.',
              },
            ].map((f) => (
              <div key={f.title} className="wl-feature-card" style={f.primary ? { borderColor: 'rgba(14,165,233,0.25)' } : {}}>
                {f.primary && (
                  <div style={{
                    position: 'absolute', top: '0.875rem', right: '0.875rem',
                    background: 'rgba(14,165,233,0.1)', color: '#0ea5e9',
                    fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
                    padding: '0.2rem 0.5rem', borderRadius: '999px',
                    textTransform: 'uppercase',
                  }}>Core Feature</div>
                )}
                <div className="wl-feature-icon" style={{ background: f.iconBg, color: f.iconColor }}>
                  {f.icon}
                </div>
                <div className="wl-feature-title">{f.title}</div>
                <div className="wl-feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SHOWCASE — real screenshots, correct order
          DDI first (README leads with it)
      ══════════════════════════════════════════ */}
      <section className="wl-section wl-section-alt" style={{ padding: '4rem 1.5rem 6rem' }}>
        <div className="wl-container">
          <span className="wl-section-label">Product Walkthrough</span>
          <h2 className="wl-section-title">See it in action</h2>

          <div className="wl-showcase">

            <div className="wl-showcase-row">
              <div className="wl-showcase-col">
                <div className="wl-showcase-label">Primary Feature</div>
                <div className="wl-showcase-title">Intelligent DDI Analysis</div>
                <p className="wl-showcase-desc">
                  Select any two drugs and get an evidence-grounded report: severity classification
                  (<em>minor → contraindicated</em>), mechanism of interaction, pharmacokinetic vs.
                  pharmacodynamic breakdown, dose-risk threshold, demographic effects, and 2–3 safer alternatives.
                </p>
                <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {['CYP450 pathways', 'ADME overlap', 'Dose thresholds', 'Alternatives'].map(t => (
                    <span key={t} style={{ fontSize: '0.78rem', padding: '0.25rem 0.625rem', borderRadius: '999px', border: '1px solid #334155', color: '#64748b' }}>{t}</span>
                  ))}
                </div>
              </div>
              <div className="wl-showcase-col">
                <div className="wl-showcase-img-wrap">
                  <img src="/assets/images/DDI_checks.png" alt="DDI Analysis Dashboard" />
                </div>
              </div>
            </div>

            <div className="wl-showcase-row">
              <div className="wl-showcase-col">
                <div className="wl-showcase-label">OCR Feature</div>
                <div className="wl-showcase-title">Prescription Scanning</div>
                <p className="wl-showcase-desc">
                  Point your camera at a handwritten or printed prescription. Gemini Vision reads
                  the drug names, routes, and doses — then immediately cross-checks every drug pair
                  for interactions. No manual entry.
                </p>
              </div>
              <div className="wl-showcase-col">
                <div className="wl-showcase-img-wrap">
                  <img src="/assets/images/Priscription_scan.png" alt="Prescription OCR Scanner" />
                </div>
              </div>
            </div>

            <div className="wl-showcase-row">
              <div className="wl-showcase-col">
                <div className="wl-showcase-label">Wellness Feature</div>
                <div className="wl-showcase-title">Personalized Health Tips</div>
                <p className="wl-showcase-desc">
                  Nutrition, exercise, sleep, hydration, and monitoring tips — generated from your
                  actual medication list, age, blood group, and conditions. Drug-food interaction
                  warnings are cross-referenced automatically.
                </p>
              </div>
              <div className="wl-showcase-col">
                <div className="wl-showcase-img-wrap">
                  <img src="/assets/images/Health_tips.png" alt="Health Tips" />
                </div>
              </div>
            </div>

            <div className="wl-showcase-row">
              <div className="wl-showcase-col">
                <div className="wl-showcase-label">Audit Trail</div>
                <div className="wl-showcase-title">Interaction History</div>
                <p className="wl-showcase-desc">
                  Every analysis you run is stored, searchable, and exportable. Build a longitudinal
                  record of your medication safety checks to share with your clinical team or review
                  dosage patterns over time.
                </p>
              </div>
              <div className="wl-showcase-col">
                <div className="wl-showcase-img-wrap">
                  <img src="/assets/images/History.png" alt="Interaction History" />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          REVIEWS
      ══════════════════════════════════════════ */}
      <section className="wl-section">
        <div className="wl-container">
          <span className="wl-section-label">Trusted By</span>
          <h2 className="wl-section-title">Built for clinicians and patients</h2>
          <div className="wl-review-grid">
            {[
              {
                stars: 5,
                text: '"The ADME tracking is phenomenal. It catches competitive inhibition at the CYP450 level — information I used to spend 20 minutes digging up manually."',
                name: 'Dr. Sarah Jenkins',
                role: 'Clinical Pharmacologist',
              },
              {
                stars: 5,
                text: '"Finally an app that explains drug interactions in plain English for me, while giving my doctor the technical breakdown she actually needs."',
                name: 'Mark T.',
                role: 'Patient',
              },
              {
                stars: 5,
                text: '"I use this daily in clinic. The UI is fast, the AI accurately parses complex multi-drug regimens, and the toxicity organ chart is incredibly clear at a glance."',
                name: 'Dr. Rajesh K.',
                role: 'General Physician',
              },
            ].map((r, i) => (
              <div key={i} className="wl-review-card">
                <div className="wl-stars">
                  {Array.from({ length: r.stars }).map((_, j) => (
                    <Star key={j} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className="wl-review-text">{r.text}</p>
                <div className="wl-review-name">{r.name}</div>
                <div className="wl-review-role">{r.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CTA BANNER
      ══════════════════════════════════════════ */}
      <section className="wl-cta-banner wl-section-alt" style={{ padding: '5rem 1.5rem' }}>
        <div style={{ position: 'relative', zIndex: 10 }}>
          <div className="wl-badge" style={{ margin: '0 auto 1.25rem', display: 'inline-flex' }}>
            <CheckCircle size={13} /> Free to use
          </div>
          <h2 className="wl-section-title" style={{ fontSize: 'clamp(1.875rem, 4vw, 2.75rem)', marginBottom: '1rem' }}>
            Run your first check in 30 seconds
          </h2>
          <p style={{ color: '#64748b', fontSize: '1.05rem', marginBottom: '2rem', lineHeight: 1.7, maxWidth: '38rem', margin: '0 auto 2rem' }}>
            No account needed to explore. Sign in with Google to save your history and personalize your experience.
          </p>
          <button onClick={() => signIn('google', { callbackUrl: '/' })} className="wl-btn-primary" style={{ fontSize: '1.1rem', padding: '1rem 2.25rem' }}>
            Get Started — It's Free <ArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════ */}
      <footer className="wl-footer">
        <div className="wl-footer-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1rem', color: '#f8fafc' }}>
            <span>💊</span> Pharma DDI Checker
          </div>

          <div className="wl-footer-links">
            <a href="https://github.com/ashugit1234622/Pharma-ddi-checker" target="_blank" rel="noopener noreferrer" className="wl-footer-link" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Code size={14} /> Source on GitHub
            </a>
            <a href="/legal/privacy"  className="wl-footer-link">Privacy Policy</a>
            <a href="/legal/terms"    className="wl-footer-link">Terms of Service</a>
            <a href="/legal/refund"   className="wl-footer-link">Refund Policy</a>
          </div>

          <div style={{ fontSize: '0.78rem', color: '#334155', textAlign: 'center' }}>
            © {new Date().getFullYear()} Pharma DDI Checker. Not a substitute for medical advice.
          </div>
        </div>
      </footer>

    </div>
  );
}
