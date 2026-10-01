'use client';

import React, { useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Microscope, Code, Star, ShieldCheck, 
  Zap, Brain, Users, ArrowRight, PlayCircle, ImageIcon 
} from 'lucide-react';
import { CinematicVisualLayer } from '@/components/CinematicVisualLayer';
import Link from 'next/link';

export default function WelcomeLandingPage() {
  const { status } = useSession();
  const router = useRouter();

  // Redirect if logged in
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [status, router]);

  // If loading or authenticated, show nothing to prevent flicker before redirect
  if (status === 'loading' || status === 'authenticated') {
    return <div className="min-h-screen bg-main" />;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden flex flex-col" style={{ backgroundColor: 'var(--bg-main)' }}>
      {/* Background Layer */}
      <div className="fixed inset-0 z-0">
        <CinematicVisualLayer />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-main)]/80 via-[var(--bg-main)]/95 to-[var(--bg-main)] pointer-events-none" />
      </div>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center justify-center pt-32 pb-20 px-6 text-center min-h-[85vh]">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-soft)] text-[var(--accent-primary)] text-sm font-semibold mb-8 animate-fade-in-up">
          <ShieldCheck size={16} />
          <span>Next-Gen Pharmacovigilance</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold mb-6 max-w-4xl tracking-tight leading-tight animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          Intelligent <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Drug Interaction</span> Analysis
        </h1>
        
        <p className="text-xl md:text-2xl text-[var(--text-muted)] mb-10 max-w-2xl leading-relaxed animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          AI-powered ADME tracking, real-time toxicity profiles, and clinical recommendations built for healthcare professionals and patients.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <button 
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-bold text-lg transition-all shadow-[0_0_20px_var(--accent-glow)] hover:scale-105"
          >
            Get Started For Free <ArrowRight size={20} />
          </button>
          
          <a 
            href="#about"
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/50 hover:bg-[var(--bg-hover)] text-[var(--text-main)] font-semibold text-lg transition-all"
          >
            Learn More
          </a>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="relative z-10 py-24 px-6 bg-[var(--bg-card)]/30 border-y border-[var(--border)]/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Pharma DDI Checker?</h2>
            <p className="text-[var(--text-muted)] text-lg max-w-2xl mx-auto">Our platform combines cutting-edge AI with established pharmacological rules to provide comprehensive safety data.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent-primary)]/50 transition-all group">
              <div className="w-14 h-14 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Brain size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">AI-Powered Insights</h3>
              <p className="text-[var(--text-muted)]">Advanced analysis of multi-drug interactions, identifying complex ADME pathways and toxicity overlaps.</p>
            </div>
            
            <div className="p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent-primary)]/50 transition-all group">
              <div className="w-14 h-14 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">Real-time Checks</h3>
              <p className="text-[var(--text-muted)]">Instant verification of prescriptions and supplements to prevent adverse drug events before they happen.</p>
            </div>
            
            <div className="p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent-primary)]/50 transition-all group">
              <div className="w-14 h-14 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">For Pros & Patients</h3>
              <p className="text-[var(--text-muted)]">Dual-mode interface offering deep clinical data for doctors and simple, actionable advice for patients.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Media Section: Video & Images */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">See It In Action</h2>
            <p className="text-[var(--text-muted)] text-lg">Watch how our intelligent engine analyzes complex interactions.</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Video Placeholder */}
            <div className="relative aspect-video bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] overflow-hidden flex flex-col items-center justify-center group cursor-pointer hover:border-[var(--accent-primary)] transition-all">
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-main)] to-transparent opacity-60 z-10" />
              {/* Fallback poster image if video fails/before load */}
              <img src="/asset/images/video-poster.jpg" alt="Video Review" className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-overlay" />
              
              <PlayCircle size={64} className="text-white/80 z-20 group-hover:scale-110 group-hover:text-white transition-all shadow-lg rounded-full bg-black/20" />
              <p className="relative z-20 mt-4 text-white font-medium">Watch Full Review</p>
              
              {/* Actual Video Tag (Hidden visually by placeholder UI until interacted with, but ready for src) */}
              <video 
                className="hidden absolute inset-0 w-full h-full object-cover" 
                controls 
                preload="none"
              >
                <source src="/asset/video/review.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
            
            {/* Images Grid */}
            <div className="grid grid-cols-2 gap-4 h-full">
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] overflow-hidden relative aspect-square flex items-center justify-center">
                <ImageIcon size={48} className="text-[var(--border-hover)] absolute z-0" />
                <img src="/asset/images/app-preview-1.jpg" alt="App UI 1" className="w-full h-full object-cover relative z-10" />
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity z-20 flex items-center justify-center text-sm font-semibold">Toxicity Profiles</div>
              </div>
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] overflow-hidden relative aspect-square flex items-center justify-center">
                <ImageIcon size={48} className="text-[var(--border-hover)] absolute z-0" />
                <img src="/asset/images/app-preview-2.jpg" alt="App UI 2" className="w-full h-full object-cover relative z-10" />
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity z-20 flex items-center justify-center text-sm font-semibold">ADME Charts</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section className="relative z-10 py-24 px-6 bg-[var(--bg-card)]/30 border-t border-[var(--border)]/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Trusted by Professionals</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Dr. Sarah Jenkins", role: "Clinical Pharmacologist", text: "The ADME tracking capability is phenomenal. It catches competitive inhibition at the CYP450 level perfectly." },
              { name: "Mark T.", role: "Patient", text: "Finally an app that explains drug interactions in plain English but gives my doctor the technical details they need." },
              { name: "Dr. Rajesh K.", role: "General Physician", text: "I use this daily in my clinic. The UI is cinematic, fast, and the AI accurately parses complex multi-drug regimens." }
            ].map((review, i) => (
              <div key={i} className="p-6 rounded-2xl bg-[var(--bg-main)] border border-[var(--border)]">
                <div className="flex gap-1 mb-4 text-yellow-500">
                  <Star size={16} fill="currentColor" />
                  <Star size={16} fill="currentColor" />
                  <Star size={16} fill="currentColor" />
                  <Star size={16} fill="currentColor" />
                  <Star size={16} fill="currentColor" />
                </div>
                <p className="text-[var(--text-main)] italic mb-6">"{review.text}"</p>
                <div>
                  <p className="font-bold">{review.name}</p>
                  <p className="text-sm text-[var(--text-muted)]">{review.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer / Repo Link */}
      <footer className="relative z-10 py-12 px-6 border-t border-[var(--border)] bg-[var(--bg-main)] mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 font-bold text-xl">
            <span>💊</span> Pharma DDI Checker
          </div>
          
          <div className="flex items-center gap-6">
            <a 
              href="https://github.com/ashugit1234622/Pharma-ddi-checker" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[var(--text-muted)] hover:text-white transition-colors"
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
