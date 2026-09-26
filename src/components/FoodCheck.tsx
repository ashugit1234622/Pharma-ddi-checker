'use client';

import React, { useState } from 'react';
import { Apple, X, Loader2, AlertTriangle, CheckCircle2, Search, Info } from 'lucide-react';

interface FoodCheckResult {
  status: boolean;
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated' | 'unknown' | 'none';
  mechanism: string;
  recommendation: string;
  confidence: 'high' | 'moderate' | 'low';
}

export default function FoodCheck({ onClose }: { onClose: () => void }) {
  const [drugName, setDrugName] = useState('');
  const [foodName, setFoodName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FoodCheckResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCheck = async () => {
    if (!drugName.trim() || !foodName.trim()) {
      setErrorMsg("Please enter both a medicine and a food/supplement name.");
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setResult(null);

    try {
      const res = await fetch('/api/foodcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drugName, foodName })
      });
      
      const data = await res.json();
      
      if (!res.ok || data.error) {
        setErrorMsg(data.error || "Failed to analyze interaction.");
        setIsLoading(false);
        return;
      }

      setResult(data);
    } catch (err) {
      setErrorMsg("Network error occurred while analyzing interaction.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setResult(null);
    setDrugName('');
    setFoodName('');
    setErrorMsg('');
  };

  const getSeverityColor = (sev: string) => {
    switch(sev) {
      case 'major':
      case 'contraindicated': return 'var(--danger)';
      case 'moderate': return 'var(--warning)';
      case 'minor': return 'var(--accent-primary)';
      default: return 'var(--success)';
    }
  };

  const getSeverityLabel = (sev: string) => {
    if (sev === 'none') return 'No Significant Interaction';
    return sev.charAt(0).toUpperCase() + sev.slice(1) + ' Interaction';
  };

  return (
    <div className="medcheck-overlay">
      <div className="medcheck-container">
        {/* Header */}
        <div className="medcheck-header">
          <div className="medcheck-title">
            <Apple size={24} style={{ color: 'var(--accent-primary)' }} />
            <h2>Food & Supplements</h2>
          </div>
          <button className="medcheck-close" onClick={onClose} aria-label="Close">
            <X size={24} />
          </button>
        </div>

        {/* Content Area */}
        <div className="medcheck-content" style={{ padding: '24px' }}>
          
          {!result ? (
            <div className="foodcheck-form">
              <p className="medcheck-instruction" style={{ marginBottom: '24px', textAlign: 'center' }}>
                Check if your medicine interacts with specific foods, beverages, or herbal supplements.
              </p>

              <div className="input-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Medicine Name</label>
                <input 
                  type="text" 
                  value={drugName}
                  onChange={(e) => setDrugName(e.target.value)}
                  placeholder="e.g. Atorvastatin, Metformin, Synthroid"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>

              <div className="input-group" style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Food or Supplement</label>
                <input 
                  type="text" 
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  placeholder="e.g. Grapefruit juice, Dairy, St. John's Wort"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>

              {errorMsg && (
                <div style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '0.9rem', textAlign: 'center' }}>
                  {errorMsg}
                </div>
              )}

              <button 
                onClick={handleCheck}
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'var(--accent-primary)',
                  color: 'white',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.7 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                {isLoading ? <Loader2 className="icon-spin" size={20} /> : <Search size={20} />}
                {isLoading ? 'Analyzing...' : 'Check Interaction'}
              </button>
            </div>
          ) : (
            <div className="foodcheck-result">
              <div 
                style={{
                  padding: '24px',
                  borderRadius: '16px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${getSeverityColor(result.severity)}`,
                  marginBottom: '24px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  {result.severity === 'none' ? (
                    <CheckCircle2 size={32} color={getSeverityColor(result.severity)} />
                  ) : (
                    <AlertTriangle size={32} color={getSeverityColor(result.severity)} />
                  )}
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: getSeverityColor(result.severity) }}>
                      {getSeverityLabel(result.severity)}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Confidence: {result.confidence}
                    </p>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Info size={16} /> Mechanism
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {result.mechanism}
                  </p>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} /> Recommendation
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {result.recommendation}
                  </p>
                </div>
              </div>

              <button 
                onClick={resetForm}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'var(--glass-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--glass-border)',
                  fontWeight: 600,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Check Another
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
