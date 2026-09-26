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

function SearchInput({
  label,
  value,
  onChange,
  placeholder,
  apiEndpoint
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  apiEndpoint: string;
}) {
  const [query, setQuery] = React.useState(value);
  const [results, setResults] = React.useState<any[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => { setQuery(value); }, [value]);

  const search = async (q: string) => {
    if (q.length < 1) { setResults([]); return; }
    try {
      const res = await fetch(`${apiEndpoint}?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.data || []);
    } catch { /* ignore */ }
  };

  const handleSelect = (name: string) => {
    setQuery(name);
    onChange(name);
    setIsOpen(false);
  };

  return (
    <div className="input-group" style={{ marginBottom: '16px', position: 'relative' }}>
      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{label}</label>
      <input 
        type="text" 
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setIsOpen(true);
          search(e.target.value);
        }}
        onFocus={() => {
          setIsOpen(true);
          if (query) search(query);
        }}
        placeholder={placeholder}
        style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)', outline: 'none' }}
      />
      
      {isOpen && query.trim().length > 0 && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
          backgroundColor: 'var(--bg-card)', marginTop: '0.4rem',
          border: '1px solid var(--border)', borderRadius: '10px',
          maxHeight: '200px', overflowY: 'auto',
          boxShadow: '0 12px 28px rgba(0,0,0,0.5)'
        }}>
          {results.map(d => (
            <div key={d.id || d.name}
              style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              onClick={() => handleSelect(d.name)}>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{d.name}</div>
              {d.drugClass && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.drugClass.join(' · ')}</div>}
              {d.category && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.category}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
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

              <SearchInput 
                label="Medicine Name"
                value={drugName}
                onChange={setDrugName}
                placeholder="e.g. Atorvastatin, Metformin, Synthroid"
                apiEndpoint="/api/drugs"
              />

              <SearchInput 
                label="Food or Supplement"
                value={foodName}
                onChange={setFoodName}
                placeholder="e.g. Grapefruit juice, Dairy, St. John's Wort"
                apiEndpoint="/api/foods"
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
