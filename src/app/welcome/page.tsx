'use client';

import React, { useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Microscope, Code, Star, ShieldCheck, 
  Zap, Brain, Users, ArrowRight, PlayCircle, ImageIcon 
} from 'lucide-react';
import { CinematicVisualLayer } from '@/components/CinematicVisualLayer';

export default function WelcomeLandingPage() {
  const { status } = useSession();
  const router = useRouter();

  // Redirect if logged in
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
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
      fontFamily: 'inherit'
    }}>
      {/* CSS Styles for the landing page */}
      <style dangerouslySetInnerHTML={{__html: `
        .welcome-hero {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 8rem 1.5rem 5rem 1.5rem;
          text-align: center;
          min-height: 85vh;
        }
        .welcome-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 9999px;
          border: 1px solid rgba(14, 165, 233, 0.3);
          background-color: var(--accent-soft);
          color: var(--accent-primary);
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 2rem;
        }
        .welcome-title {
          font-size: clamp(2.5rem, 6vw, 4.5rem);
          font-weight: 800;
          margin-bottom: 1.5rem;
          max-width: 56rem;
          letter-spacing: -0.02em;
          line-height: 1.1;
        }
        .welcome-title span {
          color: transparent;
          background-clip: text;
          -webkit-background-clip: text;
          background-image: linear-gradient(to right, #60a5fa, #6366f1);
        }
        .welcome-subtitle {
          font-size: clamp(1.125rem, 3vw, 1.5rem);
          color: var(--text-muted);
          margin-bottom: 2.5rem;
          max-width: 42rem;
          line-height: 1.625;
        }
        .welcome-actions {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        @media (min-width: 640px) {
          .welcome-actions {
            flex-direction: row;
          }
        }
        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 1rem 2rem;
          border-radius: 0.75rem;
          background-color: var(--accent-primary);
          color: white;
          font-weight: 700;
          font-size: 1.125rem;
          transition: all 0.2s;
          border: none;
          cursor: pointer;
          box-shadow: 0 0 20px var(--accent-glow);
        }
        .btn-primary:hover {
          background-color: var(--accent-hover);
          transform: scale(1.05);
        }
        .btn-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 1rem 2rem;
          border-radius: 0.75rem;
          background-color: rgba(15, 23, 42, 0.5);
          border: 1px solid var(--border);
          color: var(--text-main);
          font-weight: 600;
          font-size: 1.125rem;
          transition: all 0.2s;
          text-decoration: none;
        }
        .btn-secondary:hover {
          background-color: var(--bg-hover);
        }
        .welcome-section {
          position: relative;
          z-index: 10;
          padding: 6rem 1.5rem;
          background-color: rgba(15, 23, 42, 0.3);
          border-top: 1px solid rgba(51, 65, 85, 0.5);
          border-bottom: 1px solid rgba(51, 65, 85, 0.5);
        }
        .welcome-container {
          max-width: 72rem;
          margin: 0 auto;
        }
        .section-header {
          text-align: center;
          margin-bottom: 4rem;
        }
        .section-header h2 {
          font-size: clamp(1.875rem, 4vw, 2.25rem);
          font-weight: 700;
          margin-bottom: 1rem;
        }
        .section-header p {
          color: var(--text-muted);
          font-size: 1.125rem;
          max-width: 42rem;
          margin: 0 auto;
        }
        .grid-3 {
          display: grid;
          gap: 2rem;
          grid-template-columns: 1fr;
        }
        @media (min-width: 768px) {
          .grid-3 { grid-template-columns: repeat(3, 1fr); }
        }
        .grid-2 {
          display: grid;
          gap: 2rem;
          grid-template-columns: 1fr;
          align-items: center;
        }
        @media (min-width: 768px) {
          .grid-2 { grid-template-columns: repeat(2, 1fr); }
        }
        .feature-card {
          padding: 2rem;
          border-radius: 1rem;
          background-color: var(--bg-card);
          border: 1px solid var(--border);
          transition: all 0.3s;
        }
        .feature-card:hover {
          border-color: rgba(14, 165, 233, 0.5);
        }
        .feature-icon-wrapper {
          width: 3.5rem;
          height: 3.5rem;
          border-radius: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.5rem;
          transition: transform 0.3s;
        }
        .feature-card:hover .feature-icon-wrapper {
          transform: scale(1.1);
        }
        .video-wrapper {
          position: relative;
          aspect-ratio: 16 / 9;
          background-color: var(--bg-card);
          border-radius: 1rem;
          border: 1px solid var(--border);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s;
        }
        .video-wrapper:hover {
          border-color: var(--accent-primary);
        }
        .images-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          height: 100%;
        }
        .image-card {
          background-color: var(--bg-card);
          border-radius: 1rem;
          border: 1px solid var(--border);
          overflow: hidden;
          position: relative;
          aspect-ratio: 1 / 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .image-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: relative;
          z-index: 10;
        }
        .review-card {
          padding: 1.5rem;
          border-radius: 1rem;
          background-color: var(--bg-main);
          border: 1px solid var(--border);
        }
        .stars {
          display: flex;
          gap: 0.25rem;
          color: #eab308;
          margin-bottom: 1rem;
        }
        .footer {
          position: relative;
          z-index: 10;
          padding: 3rem 1.5rem;
          border-top: 1px solid var(--border);
          background-color: var(--bg-main);
          margin-top: auto;
        }
        .footer-content {
          max-width: 72rem;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          gap: 1.5rem;
        }
        @media (min-width: 768px) {
          .footer-content { flex-direction: row; }
        }
        .footer-link {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-muted);
          text-decoration: none;
          transition: color 0.2s;
        }
        .footer-link:hover {
          color: white;
        }
      `}} />

      {/* Background Layer */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <CinematicVisualLayer />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(2, 6, 23, 0.8), rgba(2, 6, 23, 0.95), var(--bg-main))',
          pointerEvents: 'none'
        }} />
      </div>

      {/* Hero Section */}
      <section className="welcome-hero">
        <div className="welcome-badge">
          <ShieldCheck size={16} />
          <span>Next-Gen Pharmacovigilance</span>
        </div>
        
        <h1 className="welcome-title">
          Intelligent <span>Drug Interaction</span> Analysis
        </h1>
        
        <p className="welcome-subtitle">
          AI-powered ADME tracking, real-time toxicity profiles, and clinical recommendations built for healthcare professionals and patients.
        </p>
        
        <div className="welcome-actions">
          <button 
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="btn-primary"
          >
            Get Started For Free <ArrowRight size={20} />
          </button>
          
          <a href="#about" className="btn-secondary">
            Learn More
          </a>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="welcome-section">
        <div className="welcome-container">
          <div className="section-header">
            <h2>Why Pharma DDI Checker?</h2>
            <p>Our platform combines cutting-edge AI with established pharmacological rules to provide comprehensive safety data.</p>
          </div>
          
          <div className="grid-3">
            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-primary)' }}>
                <Brain size={28} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>AI-Powered Insights</h3>
              <p style={{ color: 'var(--text-muted)' }}>Advanced analysis of multi-drug interactions, identifying complex ADME pathways and toxicity overlaps.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#c084fc' }}>
                <Zap size={28} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Real-time Checks</h3>
              <p style={{ color: 'var(--text-muted)' }}>Instant verification of prescriptions and supplements to prevent adverse drug events before they happen.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#4ade80' }}>
                <Users size={28} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>For Pros & Patients</h3>
              <p style={{ color: 'var(--text-muted)' }}>Dual-mode interface offering deep clinical data for doctors and simple, actionable advice for patients.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Media Section: Video & Images */}
      <section className="welcome-section" style={{ borderTop: 'none', backgroundColor: 'transparent' }}>
        <div className="welcome-container">
          <div className="section-header">
            <h2>See It In Action</h2>
            <p>Watch how our intelligent engine analyzes complex interactions.</p>
          </div>
          
          <div className="grid-2">
            {/* Video Placeholder */}
            <div className="video-wrapper group" style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--bg-main), transparent)', opacity: 0.6, zIndex: 10 }} />
              <img src="/assets/images/video-poster.jpg" alt="Video Review" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5, mixBlendMode: 'overlay' }} />
              
              <PlayCircle size={64} style={{ color: 'rgba(255,255,255,0.8)', zIndex: 20, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '50%', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
              <p style={{ position: 'relative', zIndex: 20, marginTop: '1rem', color: 'white', fontWeight: 500 }}>Watch Full Review</p>
              
              <video 
                style={{ display: 'none', position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
                controls 
                preload="none"
              >
                <source src="/assets/video/review.mp4" type="video/mp4" />
              </video>
            </div>
            
            {/* Images Grid */}
            <div className="images-grid">
              <div className="image-card">
                <ImageIcon size={48} style={{ color: 'var(--border-hover)', position: 'absolute', zIndex: 0 }} />
                <img src="/assets/images/app-preview-1.jpg" alt="App UI 1" />
              </div>
              <div className="image-card">
                <ImageIcon size={48} style={{ color: 'var(--border-hover)', position: 'absolute', zIndex: 0 }} />
                <img src="/assets/images/app-preview-2.jpg" alt="App UI 2" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section className="welcome-section">
        <div className="welcome-container">
          <div className="section-header">
            <h2>Trusted by Professionals</h2>
          </div>
          
          <div className="grid-3">
            {[
              { name: "Dr. Sarah Jenkins", role: "Clinical Pharmacologist", text: "The ADME tracking capability is phenomenal. It catches competitive inhibition at the CYP450 level perfectly." },
              { name: "Mark T.", role: "Patient", text: "Finally an app that explains drug interactions in plain English but gives my doctor the technical details they need." },
              { name: "Dr. Rajesh K.", role: "General Physician", text: "I use this daily in my clinic. The UI is cinematic, fast, and the AI accurately parses complex multi-drug regimens." }
            ].map((review, i) => (
              <div key={i} className="review-card">
                <div className="stars">
                  <Star size={16} fill="currentColor" />
                  <Star size={16} fill="currentColor" />
                  <Star size={16} fill="currentColor" />
                  <Star size={16} fill="currentColor" />
                  <Star size={16} fill="currentColor" />
                </div>
                <p style={{ fontStyle: 'italic', marginBottom: '1.5rem', lineHeight: 1.6 }}>"{review.text}"</p>
                <div>
                  <p style={{ fontWeight: 700 }}>{review.name}</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{review.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer / Repo Link */}
      <footer className="footer">
        <div className="footer-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.25rem' }}>
            <span>💊</span> Pharma DDI Checker
          </div>
          
          <div>
            <a 
              href="https://github.com/ashugit1234622/Pharma-ddi-checker" 
              target="_blank" 
              rel="noopener noreferrer"
              className="footer-link"
            >
              <Code size={20} />
              <span>View Source on GitHub</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
