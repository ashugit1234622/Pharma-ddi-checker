'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Bell, Clock, AlertCircle, Plus, Pill, CheckCircle2, X, Trash2 } from 'lucide-react';
import CinematicBackground from '@/components/CinematicBackground';
import CustomDialog from '@/components/CustomDialog';

export default function RemindersPage() {
  const { data: session, status } = useSession();
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const [dialogConfig, setDialogConfig] = useState<{isOpen: boolean, title?: string, message: string, type: 'alert' | 'confirm', confirmText?: string, onConfirm: () => void}>({
    isOpen: false, message: '', type: 'alert', onConfirm: () => {}
  });
  const closeDialog = () => setDialogConfig(prev => ({ ...prev, isOpen: false }));

  // Form State
  const [drugName, setDrugName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('Daily');
  const [times, setTimes] = useState('08:00');
  const [times2, setTimes2] = useState('20:00');
  const [instructions, setInstructions] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      setLoading(false);
      return;
    }

    if (status === 'authenticated') {
      fetchReminders();
      checkNotificationStatus();
    }
  }, [status]);



  const checkNotificationStatus = () => {
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  };

  const requestNotifications = async () => {
    if (!('Notification' in window)) {
      setDialogConfig({
        isOpen: true,
        title: 'Unsupported Browser',
        message: "Your browser doesn't support notifications.",
        type: 'alert',
        onConfirm: closeDialog
      });
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === 'granted');
    if (permission === 'granted') {
      new Notification('Reminders Enabled', {
        body: 'You will now receive medication reminders when you have this app open.',
      });
    }
  };

  const fetchReminders = async () => {
    try {
      const res = await fetch('/api/reminders');
      if (res.ok) {
        const data = await res.json();
        setReminders(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let times_json = [times];
      if (frequency === 'Twice Daily') {
        times_json = [times, times2];
      }

      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drug_name: drugName,
          dosage,
          frequency,
          times_json,
          instructions
        })
      });

      if (res.ok) {
        setIsAdding(false);
        setDrugName('');
        setDosage('');
        setTimes('08:00');
        setTimes2('20:00');
        setFrequency('Daily');
        setInstructions('');
        fetchReminders();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      const res = await fetch(`/api/reminders?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDialogConfig({
          isOpen: true,
          title: 'Could Not Delete',
          message: data.error || 'Something went wrong while deleting this reminder.',
          type: 'alert',
          onConfirm: closeDialog
        });
        return;
      }

      // Drop it locally so the list updates immediately.
      setReminders(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      console.error(e);
      setDialogConfig({
        isOpen: true,
        title: 'Network Error',
        message: 'Could not reach the server. Please check your connection and try again.',
        type: 'alert',
        onConfirm: closeDialog
      });
    }
  };

  const confirmDeleteReminder = (reminder: any) => {
    setDialogConfig({
      isOpen: true,
      title: 'Delete Reminder',
      message: `Remove the ${reminder.drug_name} ${reminder.dosage} reminder? This cannot be undone.`,
      type: 'confirm',
      confirmText: 'Delete',
      onConfirm: () => {
        closeDialog();
        handleDeleteReminder(reminder.id);
      }
    });
  };

  if (status === 'loading' || loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
        <div className="pulse" style={{ width: '40px', height: '40px', margin: '0 auto 1rem', background: 'var(--accent-primary)', borderRadius: '50%' }} />
        Loading your schedule...
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
        <Bell size={48} style={{ color: 'var(--accent-primary)', margin: '0 auto 1rem' }} />
        <h2 style={{ fontSize: '1.8rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-main)' }}>Sign in to set reminders</h2>
        <p style={{ color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Please sign in with your Google account to create and manage medication schedules.
        </p>
      </div>
    );
  }

  return (
    <>
      <CinematicBackground />
      <CustomDialog 
        isOpen={dialogConfig.isOpen}
        title={dialogConfig.title}
        message={dialogConfig.message}
        type={dialogConfig.type}
        confirmText={dialogConfig.confirmText}
        onConfirm={dialogConfig.onConfirm}
        onCancel={closeDialog}
      />
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Bell size={32} style={{ color: 'var(--accent-primary)' }} />
            Dose Reminders
          </h1>

          <div style={{ display: 'flex', gap: '1rem' }}>
            {!notificationsEnabled && (
              <button
                onClick={requestNotifications}
                style={{
                  background: 'rgba(255, 152, 0, 0.1)', color: '#ff9800',
                  border: '1px solid rgba(255,152,0,0.3)', padding: '0.6rem 1rem',
                  borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem',
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 152, 0, 0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 152, 0, 0.1)'}
              >
                <AlertCircle size={16} /> Enable Notifications
              </button>
            )}
            
            <button
              onClick={() => setIsAdding(!isAdding)}
              style={{
                background: 'var(--accent-primary)', color: '#fff',
                border: 'none', padding: '0.6rem 1rem',
                borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                transition: 'transform 0.1s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              {isAdding ? <X size={16} /> : <Plus size={16} />} 
              {isAdding ? 'Cancel' : 'Add Medication'}
            </button>
          </div>
        </div>

        {isAdding && (
          <form 
            onSubmit={handleAddReminder}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem',
              animation: 'fadeIn 0.3s ease'
            }}
          >
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Add New Schedule</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-dim)' }}>Drug Name</label>
                <input required value={drugName} onChange={e => setDrugName(e.target.value)} type="text" placeholder="e.g. Lisinopril" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-dim)' }}>Dosage</label>
                <input required value={dosage} onChange={e => setDosage(e.target.value)} type="text" placeholder="e.g. 10mg" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-dim)' }}>Frequency</label>
                <select value={frequency} onChange={e => setFrequency(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }}>
                  <option>Daily</option>
                  <option>Twice Daily</option>
                  <option>As Needed</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-dim)' }}>Time {frequency === 'Twice Daily' ? '1' : ''}</label>
                <input required value={times} onChange={e => setTimes(e.target.value)} type="time" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
              </div>
              {frequency === 'Twice Daily' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-dim)' }}>Time 2</label>
                  <input required value={times2} onChange={e => setTimes2(e.target.value)} type="time" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                </div>
              )}
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-dim)' }}>Instructions</label>
              <input value={instructions} onChange={e => setInstructions(e.target.value)} type="text" placeholder="e.g. Take after food" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
            </div>

            <button type="submit" style={{ width: '100%', background: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
              Save Reminder
            </button>
          </form>
        )}

        {reminders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <Pill size={48} style={{ color: 'var(--text-dim)', margin: '0 auto 1rem', opacity: 0.5 }} />
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>No reminders set</h3>
            <p style={{ color: 'var(--text-dim)' }}>Keep track of your medication schedule easily.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {reminders.map((r) => {
              const timesArr = JSON.parse(r.times_json || '[]');
              return (
                <div key={r.id} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px',
                  padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <div style={{
                      width: '56px', height: '56px', borderRadius: '12px',
                      background: 'rgba(92, 107, 192, 0.1)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Pill size={28} style={{ color: 'var(--accent-primary)' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                        {r.drug_name} <span style={{ color: 'var(--text-dim)', fontSize: '1rem', fontWeight: 400 }}>{r.dosage}</span>
                      </h3>
                      <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '0.2rem' }}>
                        <Clock size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                        {timesArr.join(', ')} • {r.frequency}
                      </p>
                      {r.instructions && (
                        <p style={{ color: '#4caf50', fontSize: '0.85rem' }}>{r.instructions}</p>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                    <button style={{
                      background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)',
                      padding: '0.6rem 1rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(76, 175, 80, 0.1)';
                      e.currentTarget.style.borderColor = '#4caf50';
                      e.currentTarget.style.color = '#4caf50';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.color = 'var(--text-main)';
                    }}
                    >
                      <CheckCircle2 size={18} /> Take Now
                    </button>

                    <button
                      onClick={() => confirmDeleteReminder(r)}
                      aria-label={`Delete ${r.drug_name} reminder`}
                      title="Delete reminder"
                      style={{
                        background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)',
                        padding: '0.6rem', borderRadius: '8px', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(244, 67, 54, 0.12)';
                        e.currentTarget.style.borderColor = '#f44336';
                        e.currentTarget.style.color = '#f44336';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.color = 'var(--text-dim)';
                      }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
