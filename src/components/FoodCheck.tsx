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

function AutocompleteSearchBox({
  label,
  value,
  onSelect,
  onClear,
  placeholder,
  apiEndpoint,
  accentColor = 'var(--accent-primary)'
}: {
  label: string;
  value: any | null;
  onSelect: (item: any) => void;
  onClear: () => void;
  placeholder: string;
  apiEndpoint: string;
  accentColor?: string;
}) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<any[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);

  const search = async (q: string) => {
    if (q.length < 1) { setResults([]); return; }
    try {
      const res = await fetch(`${apiEndpoint}?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.data || []);
    } catch { /* ignore */ }
  };

  const handleSelectCustom = (customName: string) => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    const capitalized = trimmed
      .split(/[\s-]+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    onSelect({
      id: trimmed.toLowerCase().replace(/\s+/g, '-'),
      name: capitalized,
      genericName: 'Custom Entry',
      drugClass: [],
      category: 'Custom Entry'
    });
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div className="card" style={{ marginBottom: '16px', zIndex: isOpen ? 50 : 1, position: 'relative' }}>
      <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 500 }}>{label}</h3>
      
      {!value ? (
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              className="input"
              placeholder={placeholder}
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setIsOpen(true);
                search(e.target.value);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={e => {
                if (e.key === 'Enter' && query.trim().length > 0) {
                  e.preventDefault();
                  if (results.length > 0 && results[0].name.toLowerCase() === query.trim().toLowerCase()) {
                    onSelect(results[0]);
                    setQuery('');
                    setResults([]);
                    setIsOpen(false);
                  } else {
                    handleSelectCustom(query);
                  }
                }
              }}
            />
            {query.trim().length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', flexShrink: 0, whiteSpace: 'nowrap' }}
                onClick={() => handleSelectCustom(query)}
              >
                Select
              </button>
            )}
          </div>

          {isOpen && query.trim().length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
              backgroundColor: 'var(--bg-card)', marginTop: '0.4rem',
              border: '1px solid var(--border)', borderRadius: '10px',
              maxHeight: '280px', overflowY: 'auto',
              boxShadow: '0 12px 28px rgba(0,0,0,0.5)'
            }}>
              {results.map(d => (
                <div key={d.id || d.name}
                  style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  onClick={() => { onSelect(d); setQuery(''); setResults([]); setIsOpen(false); }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{d.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {d.drugClass ? d.drugClass.join(' · ') : d.category}
                  </div>
                </div>
              ))}
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderTop: results.length > 0 ? '1px dashed var(--border)' : 'none',
                  cursor: 'pointer',
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  color: 'var(--accent-primary)',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.16)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.08)')}
                onClick={() => handleSelectCustom(query)}
              >
                <span>➕ Use <strong>"{query.trim()}"</strong> as custom entry</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Press Enter ↵</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--bg-hover)', borderRadius: '10px', marginBottom: '0.75rem', borderLeft: `3px solid ${accentColor}` }}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: accentColor }}>{value.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{value.genericName || value.category}</div>
            {(value.drugClass && value.drugClass.length > 0) && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.3rem' }}>{value.drugClass.join(' · ')}</div>
            )}
          </div>
          <button className="btn btn-outline" style={{ width: '100%', fontSize: '0.85rem', padding: '0.5rem' }} onClick={onClear}>
            Change
          </button>
        </div>
      )}
    </div>
  );
}

export default function FoodCheck({ onClose }: { onClose: () => void }) {
  const [drug, setDrug] = useState<any | null>(null);
  const [food, setFood] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FoodCheckResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCheck = async () => {
    if (!drug || !food) {
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
        body: JSON.stringify({ drugName: drug.name, foodName: food.name })
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
    setDrug(null);
    setFood(null);
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

              <AutocompleteSearchBox 
                label="Medicine Name"
                value={drug}
                onSelect={setDrug}
                onClear={() => setDrug(null)}
                placeholder="e.g. Atorvastatin, Metformin, Synthroid"
                apiEndpoint="/api/drugs"
              />

              <AutocompleteSearchBox 
                label="Food or Supplement"
                value={food}
                onSelect={setFood}
                onClear={() => setFood(null)}
                placeholder="e.g. Grapefruit juice, Dairy, St. John's Wort"
                apiEndpoint="/api/foods"
                accentColor="var(--warning)"
              />

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
