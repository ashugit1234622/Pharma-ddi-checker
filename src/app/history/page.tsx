'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { FileText, Clock, ScanBarcode, MessageSquare, AlertCircle, Maximize2, X, Trash2 } from 'lucide-react';
import CinematicBackground from '@/components/CinematicBackground';
import CustomDialog from '@/components/CustomDialog';

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'interactions' | 'prescriptions'>('interactions');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const [dialogConfig, setDialogConfig] = useState<{isOpen: boolean, title?: string, message: string, type: 'alert' | 'confirm', onConfirm: () => void}>({
    isOpen: false, message: '', type: 'alert', onConfirm: () => {}
  });

  const closeDialog = () => setDialogConfig(prev => ({ ...prev, isOpen: false }));


  useEffect(() => {
    if (status === 'unauthenticated') {
      setLoading(false);
      return;
    }

    if (status === 'authenticated') {
      fetch('/api/history')
        .then(res => {
          if (!res.ok) throw new Error('Failed to load history');
          return res.json();
        })
        .then(data => {
          setRecords(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setError('Could not load history');
          setLoading(false);
        });
    }
  }, [status]);

  const handleDelete = (id: string) => {
    setDialogConfig({
      isOpen: true,
      title: 'Confirm Deletion',
      message: 'Are you sure you want to delete this record? This action cannot be undone.',
      type: 'confirm',
      onConfirm: async () => {
        closeDialog();
        try {
          const res = await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
          if (res.ok) {
            setRecords(prev => prev.filter(r => r.id !== id));
          } else {
            setTimeout(() => setDialogConfig({ isOpen: true, title: 'Error', message: 'Failed to delete record.', type: 'alert', onConfirm: closeDialog }), 100);
          }
        } catch (e) {
          console.error(e);
          setTimeout(() => setDialogConfig({ isOpen: true, title: 'Error', message: 'Network error.', type: 'alert', onConfirm: closeDialog }), 100);
        }
      }
    });
  };


  if (status === 'loading' || loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
        <div className="pulse" style={{ width: '40px', height: '40px', margin: '0 auto 1rem', background: 'var(--accent-primary)', borderRadius: '50%' }} />
        Loading your history...
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
        <AlertCircle size={48} style={{ color: 'var(--accent-primary)', margin: '0 auto 1rem' }} />
        <h2 style={{ fontSize: '1.8rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-main)' }}>Sign in to view history</h2>
        <p style={{ color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Please sign in with your Google account to view your saved DDI checks, prescriptions, and AI consultations.
        </p>
      </div>
    );
  }

  const interactions = records.filter(r => r.record_type === 'ddi_check' || r.record_type === 'medcheck' || r.record_type === 'ai_chat');
  const prescriptions = records.filter(r => r.record_type === 'prescription_scan' || r.record_type === 'prescription_ocr');

  const displayedRecords = activeTab === 'interactions' ? interactions : prescriptions;

  return (
    <>
      <CinematicBackground />
      <CustomDialog 
        isOpen={dialogConfig.isOpen}
        title={dialogConfig.title}
        message={dialogConfig.message}
        type={dialogConfig.type}
        onConfirm={dialogConfig.onConfirm}
        onCancel={closeDialog}
      />
      <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '2rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Clock size={32} style={{ color: 'var(--accent-primary)' }} />
          Patient History
        </h1>

        {/* Tab Navigation */}
        <div className="tabs-container" style={{ marginBottom: '2rem' }}>
          <button className={`tab-pill ${activeTab === 'interactions' ? 'tab-pill-active' : ''}`} onClick={() => setActiveTab('interactions')}>
            Interactions ({interactions.length})
          </button>
          <button className={`tab-pill ${activeTab === 'prescriptions' ? 'tab-pill-active' : ''}`} onClick={() => setActiveTab('prescriptions')}>
            Prescriptions ({prescriptions.length})
          </button>
        </div>

        {error && (
          <div style={{ padding: '1rem', background: 'rgba(255, 60, 60, 0.1)', color: '#ff6b6b', borderRadius: '12px', marginBottom: '2rem', border: '1px solid rgba(255,60,60,0.2)' }}>
            {error}
          </div>
        )}

        {displayedRecords.length === 0 && !error ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <FileText size={48} style={{ color: 'var(--text-dim)', margin: '0 auto 1rem', opacity: 0.5 }} />
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>No {activeTab} found</h3>
            <p style={{ color: 'var(--text-dim)' }}>Your saved {activeTab} will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {displayedRecords.map((record) => {
              let dataJson: any = {};
              try {
                dataJson = typeof record.data_json === 'string' ? JSON.parse(record.data_json) : record.data_json;
              } catch (e) { }

              return (
                <div 
                  key={record.id} 
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.2)';
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <div style={{
                      width: '56px', height: '56px', borderRadius: '12px',
                      background: 'rgba(92, 107, 192, 0.1)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {activeTab === 'interactions' ? <AlertCircle size={28} style={{ color: 'var(--accent-primary)' }} /> : <ScanBarcode size={28} style={{ color: '#4caf50' }} />}
                    </div>

                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{record.title}</span>
                        <button 
                          className="btn-icon" 
                          style={{ color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem' }} 
                          onClick={(e) => { e.stopPropagation(); handleDelete(record.id); }}
                          title="Delete Record"
                        >
                          <Trash2 size={20} />
                        </button>
                      </h3>
                      <p style={{ color: 'var(--text-dim)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '0.8rem', whiteSpace: 'pre-wrap' }}>
                        {record.summary || 'No summary available.'}
                      </p>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', opacity: 0.8 }}>
                        {new Date(record.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Render Prescriptions specific Data */}
                  {activeTab === 'prescriptions' && dataJson?.medicines && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-hover)', borderRadius: '12px' }}>
                      <h4 style={{ color: 'var(--accent-primary)', marginBottom: '0.75rem', fontSize: '1rem' }}>Extracted Medicines & Doses</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                        {dataJson.medicines.map((med: any, idx: number) => (
                          <div key={idx} style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{med.rawName}</div>
                            {med.strength && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Strength: {med.strength}</div>}
                            {med.dosageForm && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Form: {med.dosageForm}</div>}
                            {med.frequency && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Freq: {med.frequency}</div>}
                          </div>
                        ))}
                      </div>

                      {/* Render Highly Compressed Image if available */}
                      {dataJson.thumbnail && (
                        <div style={{ marginTop: '1.5rem' }}>
                          <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Scanned Prescription Image</h4>
                          <div 
                            style={{ 
                              position: 'relative', 
                              width: '200px', 
                              height: '150px', 
                              borderRadius: '8px', 
                              overflow: 'hidden', 
                              cursor: 'pointer',
                              border: '2px solid transparent',
                              transition: 'border-color 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                            onClick={() => setSelectedImage(dataJson.thumbnail)}
                          >
                            <img src={dataJson.thumbnail} alt="Prescription Scan" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Maximize2 size={24} color="white" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Full Screen Image Modal */}
      {selectedImage && (
        <div 
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
          onClick={() => setSelectedImage(null)}
        >
          <button style={{ position: 'absolute', top: '2rem', right: '2rem', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
            <X size={32} />
          </button>
          <img src={selectedImage} alt="Prescription Scan Full" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '12px' }} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
