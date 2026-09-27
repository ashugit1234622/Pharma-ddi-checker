'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Send, Sparkles, Loader2, User as UserIcon, ShieldAlert, ArrowLeft, Droplet } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import OrbitalAnimation, { VoiceState } from '@/components/OrbitalAnimation';
import { LanguageOption, LANGUAGES, VoiceMode, ISpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from '@/lib/voice';
import { useVoiceLanguage } from '@/hooks/useVoiceLanguage';
import { useVisualViewport } from '@/hooks/useVisualViewport';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  safetyWarning?: string | null;
  recommendedProducts?: string[];
  isThinking?: boolean;
}

export default function SkincareChatPage() {
  const { status } = useSession();
  const router = useRouter();
  const viewportHeight = useVisualViewport();
  
  // Lock body scroll for the entire skincare chat route
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehaviorY = 'none';
    document.documentElement.style.overscrollBehaviorY = 'none';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.overscrollBehaviorY = '';
      document.documentElement.style.overscrollBehaviorY = '';
    };
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // ── Voice state ──────────────────────────────────────────────────────────
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('off');
  const [voiceError, setVoiceError] = useState('');
  const [speakingAmplitude, setSpeakingAmplitude] = useState(0);

  const { selectedLang, saveLanguage } = useVoiceLanguage();

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const animFrameRef = useRef<number>(0);
  const isSpeakingRef = useRef(false);

  const cleanupVoice = React.useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;
    setSpeakingAmplitude(0);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    return () => cleanupVoice();
  }, [cleanupVoice]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || loading) return;

    const trimmed = text.trim();
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: trimmed };
    // Sliding window: keep only the last 5 messages to prevent exponential token cost
    const history = messages.slice(-5).map(m => ({ role: m.role, content: m.content }));
    
    // ─── Phase 4 Token Optimization: Client-Side Heuristics ───
    const greetingRegex = /^(hi|hello|hey|how are you|good morning|good evening)[.!?]?\s*$/i;
    if (greetingRegex.test(trimmed)) {
      setMessages(prev => [...prev, userMsg]);
      setInput('');
      const answer = "Hello! How can I assist you with your skincare today?";
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: answer
        }]);
      }, 500);
      return answer;
    }

    setMessages(prev => [...prev, userMsg, { id: 'temp', role: 'assistant', content: '', isThinking: true }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/derma/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });

      if (!res.ok) throw new Error('API Error');
      const data = await res.json();

      setMessages(prev => [
        ...prev.filter(m => m.id !== 'temp'),
        {
          id: Date.now().toString() + 1,
          role: 'assistant',
          content: data.answer,
          safetyWarning: data.safetyWarning,
          recommendedProducts: data.recommendedProducts
        }
      ]);
      return data.answer;
    } catch (e) {
      setMessages(prev => [
        ...prev.filter(m => m.id !== 'temp'),
        { id: Date.now().toString() + 1, role: 'assistant', content: "I'm having trouble connecting to the network. Please try again." }
      ]);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceSend = React.useCallback(async (transcript: string, lang: LanguageOption) => {
    if (!transcript.trim()) {
      setVoiceMode('listening');
      return;
    }
    const answerText = await handleSend(transcript);
    
    if (answerText) {
      setVoiceMode('speaking');
      isSpeakingRef.current = true;
      const utterance = new SpeechSynthesisUtterance(answerText);
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = voices.find(v => v.name === lang.voice) || voices.find(v => v.lang === lang.code);
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      const updateAmplitude = () => {
        if (!isSpeakingRef.current) return;
        setSpeakingAmplitude(0.3 + Math.random() * 0.7);
        animFrameRef.current = requestAnimationFrame(updateAmplitude);
      };
      updateAmplitude();

      return new Promise<void>((resolve) => {
        utterance.onend = () => {
          isSpeakingRef.current = false;
          cancelAnimationFrame(animFrameRef.current);
          setSpeakingAmplitude(0);
          setVoiceMode(currentMode => {
            if (currentMode !== 'off' && currentMode !== 'error') {
               if (selectedLang) {
                  setTimeout(() => startListening(selectedLang), 50);
                  return 'listening';
               }
            }
            return currentMode;
          });
          resolve();
        };
        utterance.onerror = (e) => {
          if (e.error !== 'canceled' && e.error !== 'interrupted') {
            console.error('[TTS] Error:', e);
            setVoiceError('Voice playback interrupted.');
            setTimeout(() => setVoiceError(''), 3000);
          }
          isSpeakingRef.current = false;
          cancelAnimationFrame(animFrameRef.current);
          setSpeakingAmplitude(0);
          resolve();
        };
        window.speechSynthesis.speak(utterance);
      });
    } else {
      setVoiceMode('listening');
      startListening(lang);
    }
  }, [handleSend, selectedLang]);

  const startListening = React.useCallback((lang: LanguageOption) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setVoiceMode('error');
      setVoiceError('Speech recognition is not supported in this browser.');
      return;
    }
    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = lang.code;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setVoiceMode('listening');
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      if (recognitionRef.current !== recognition) return;
      const transcript = e.results[0]?.[0]?.transcript || '';
      if (transcript.trim()) {
        setVoiceMode('processing');
        handleVoiceSend(transcript, lang);
      } else {
        setVoiceMode('listening');
        startListening(lang);
      }
    };
    recognition.onnomatch = () => {
      if (recognitionRef.current !== recognition) return;
      setVoiceError("I couldn't understand that. Please try again.");
      setVoiceMode('error');
      setTimeout(() => {
        setVoiceError('');
        setVoiceMode('listening');
        startListening(lang);
      }, 2000);
    };
    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (recognitionRef.current !== recognition) return;
      if (e.error === 'no-speech') {
        setVoiceMode('listening');
        startListening(lang);
        return;
      }
      if (e.error === 'aborted') return;
      setVoiceError(`Recognition error: ${e.error}`);
      setVoiceMode('error');
      setTimeout(() => {
        setVoiceError('');
        setVoiceMode('listening');
        startListening(lang);
      }, 2500);
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      if (voiceMode === 'listening' && !isSpeakingRef.current) {
        startListening(lang);
      }
    };
    try { recognition.start(); } catch (err) {}
  }, [handleVoiceSend, voiceMode]);

  const openVoiceMode = React.useCallback(async () => {
    setVoiceMode('permission_required');
    setVoiceError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch (err: any) {
      setVoiceMode('error');
      setVoiceError('Microphone access is required.');
      return;
    }
    if (selectedLang) {
      setVoiceMode('listening');
      startListening(selectedLang);
    } else {
      setVoiceMode('language_selection');
    }
  }, [startListening, selectedLang]);

  const handleLanguageSelect = React.useCallback((lang: LanguageOption) => {
    saveLanguage(lang);
    setVoiceMode('listening');
    startListening(lang);
  }, [startListening, saveLanguage]);

  const closeVoiceMode = React.useCallback(() => {
    cleanupVoice();
    setVoiceMode('off');
    setVoiceError('');
  }, [cleanupVoice]);

  function getOrbitalState(): VoiceState {
    if (voiceMode === 'permission_required' || voiceMode === 'language_selection') return 'ready';
    if (voiceMode === 'error') return 'ready';
    if (voiceMode === 'processing') return 'processing';
    if (voiceMode === 'speaking') return 'speaking';
    if (voiceMode === 'listening') return 'listening';
    return 'ready';
  }

  function getStatusLabel(mode: VoiceMode, errorMsg: string): string {
    switch (mode) {
      case 'permission_required': return 'Microphone access required';
      case 'language_selection': return 'Choose your language';
      case 'listening': return 'Listening...';
      case 'processing': return 'Thinking...';
      case 'speaking': return 'Speaking...';
      case 'error': return errorMsg || 'Something went wrong';
      default: return '';
    }
  }

  const suggestions = [
    "Build a morning routine for my skin type",
    "How to deal with sudden acne breakouts?",
    "What SPF should I use with my medications?",
    "Tips for glowing skin and anti-aging"
  ];

  if (status === 'loading') return <div className="derma-loading"><Loader2 className="spinner" /></div>;

  return (
    <div className="derma-page">
      <div className="derma-header-bar">
        <button className="derma-back-btn" onClick={() => router.push('/')}>
          <ArrowLeft size={18} /> Dashboard
        </button>
        <div className="derma-title">
          <Droplet className="derma-icon-pink" size={24} />
          <h1>Skincare AI</h1>
        </div>
      </div>

      <div className="derma-chat-container" ref={chatContainerRef}>
        {messages.length === 0 ? (
          <div className="derma-welcome">
            <div className="derma-welcome-icon">
              <Sparkles size={40} className="derma-icon-pink" />
            </div>
            <h2>Your Personal Dermatologist</h2>
            <p>I analyze your profile to give safe, personalized skincare advice. What's on your mind today?</p>
            
            <div className="derma-suggestions">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => handleSend(s)} className="derma-suggestion-btn">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="derma-message-list">
            {messages.map((msg) => (
              <div key={msg.id} className={`derma-msg-wrapper ${msg.role === 'user' ? 'msg-user' : 'msg-ai'}`}>
                <div className="derma-avatar">
                  {msg.role === 'user' ? <UserIcon size={16} /> : <Droplet size={16} className="derma-icon-pink" />}
                </div>
                <div className="derma-msg-bubble">
                  {msg.isThinking ? (
                    <div className="derma-thinking">
                      <span className="dot"></span><span className="dot"></span><span className="dot"></span>
                    </div>
                  ) : (
                    <>
                      <div className="derma-markdown">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      
                      {msg.safetyWarning && (
                        <div className="derma-warning">
                          <ShieldAlert size={14} />
                          <span>{msg.safetyWarning}</span>
                        </div>
                      )}
                      
                      {msg.recommendedProducts && msg.recommendedProducts.length > 0 && (
                        <div className="derma-products">
                          <strong>Suggested Ingredients:</strong>
                          <div className="derma-tags">
                            {msg.recommendedProducts.map((p, i) => (
                              <span key={i} className="derma-tag">{p}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {voiceMode !== 'off' && (
        <div className="derma-voice-fullscreen">
          <div className="aastha-voice-container">
            {/* Header / close button for the overlay */}
            <div className="derma-voice-header">
              <button className="aastha-voice-exit-btn" onClick={closeVoiceMode} aria-label="Close voice chat" style={{ margin: '1rem' }}>
                × Close
              </button>
            </div>

            {/* Language Selection */}
            {voiceMode === 'language_selection' && (
              <div className="aastha-lang-select" role="dialog" aria-label="Choose voice language">
                <div className="aastha-lang-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                  </svg>
                  Choose your language
                </div>
                <p className="aastha-lang-subtitle">Select once for this session</p>
                <div className="aastha-lang-grid" role="radiogroup" aria-label="Language options">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      className="aastha-lang-btn"
                      onClick={() => handleLanguageSelect(lang)}
                      aria-label={`Select ${lang.label}`}
                      role="radio"
                      aria-checked="false"
                    >
                      <span className="lang-native">{lang.nativeLabel}</span>
                      <span className="lang-en">{lang.label}</span>
                    </button>
                  ))}
                </div>
                <button className="aastha-voice-exit-btn" onClick={closeVoiceMode} aria-label="Close voice mode">
                  Back to text chat
                </button>
              </div>
            )}

            {/* Permission Request */}
            {voiceMode === 'permission_required' && (
              <div className="aastha-voice-status-center">
                <div className="aastha-voice-permission-icon">🎙</div>
                <p className="aastha-voice-status-text">Requesting microphone access...</p>
              </div>
            )}

            {/* Orbital Animation + Status (active voice states) */}
            {(voiceMode === 'listening' || voiceMode === 'processing' || voiceMode === 'speaking') && (
              <div className="aastha-voice-orbital-area">
                <div className="aastha-orbital-wrap" aria-hidden="true">
                  <OrbitalAnimation state={getOrbitalState()} amplitude={speakingAmplitude} />
                </div>

                <div className="aastha-voice-state-label" role="status" aria-live="polite">
                  {getStatusLabel(voiceMode, voiceError)}
                </div>

                {voiceError && (
                  <div className="aastha-voice-error-inline" role="alert">
                    {voiceError}
                  </div>
                )}
              </div>
            )}

            {/* Error State */}
            {voiceMode === 'error' && (
              <div className="aastha-voice-status-center">
                <div className="aastha-voice-error-icon">⚠</div>
                <p className="aastha-voice-status-text" role="alert">{voiceError}</p>
                <button className="aastha-voice-retry-btn" onClick={() => openVoiceMode()} aria-label="Try again">
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="derma-input-container">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask about your skin..."
          disabled={loading || voiceMode !== 'off'}
        />
        <button onClick={() => handleSend()} disabled={!input.trim() || loading} className="derma-send-btn">
          {loading ? <Loader2 size={18} className="spinner" /> : <Send size={18} />}
        </button>
        <button 
          className="derma-voice-btn"
          onClick={openVoiceMode}
          disabled={loading}
          title="Talk to Skincare AI"
          aria-label="Talk to Skincare AI using voice"
          style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', marginLeft: '8px', padding: '8px' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
        </button>
      </div>
    </div>
  );
}
