'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Send, Sparkles, Loader2, User as UserIcon, ShieldAlert, ArrowLeft, Droplet } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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
    document.body.style.overscrollBehaviorY = 'none';
    return () => {
      document.body.style.overflow = '';
      document.body.style.overscrollBehaviorY = '';
    };
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text };
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    
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
    } catch (e) {
      setMessages(prev => [
        ...prev.filter(m => m.id !== 'temp'),
        { id: Date.now().toString() + 1, role: 'assistant', content: "I'm having trouble connecting to the network. Please try again." }
      ]);
    } finally {
      setLoading(false);
    }
  };

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

      <div className="derma-chat-container">
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

      <div className="derma-input-container">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask about your skin..."
          disabled={loading}
        />
        <button onClick={() => handleSend()} disabled={!input.trim() || loading} className="derma-send-btn">
          {loading ? <Loader2 size={18} className="spinner" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
