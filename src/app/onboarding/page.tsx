'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Calendar, Heart, AlertTriangle, Pill, FileText, Phone, ChevronRight, Check, Plus, X, Stethoscope } from 'lucide-react';
import CustomDialog from '@/components/CustomDialog';
import MenstruationDetailsForm from '@/components/MenstruationDetailsForm';

const COMMON_DISEASES = ['Diabetes', 'Hypertension', 'Asthma', 'Heart Disease', 'COPD', 'Thyroid', 'Kidney Disease', 'Liver Disease', 'Epilepsy', 'Arthritis'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function OnboardingContent() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(() => {
    const s = searchParams.get('step');
    return s ? parseInt(s, 10) : 0; // Starts at 0 for role selection
  });
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [allergyInput, setAllergyInput] = useState('');
  const [medInput, setMedInput] = useState('');

  const [form, setForm] = useState({
    display_name: '',
    age: '',
    gender: '',
    blood_group: '',
    underlying_diseases: [] as string[],
    allergies: [] as string[],
    current_medications: [] as string[],
    medical_history: '',
    emergency_contact: '',
    last_menstruation_date: '',
    user_role: null as 'user' | 'pharmacologist' | null,
    consent_accepted: false,
    menstruation_details: null as any,
  });

  const [showMenstruationModal, setShowMenstruationModal] = useState(false);

  const [dialogConfig, setDialogConfig] = useState<{isOpen: boolean, title?: string, message: string, type: 'alert', onConfirm: () => void}>({
    isOpen: false, message: '', type: 'alert', onConfirm: () => {}
  });

  const closeDialog = () => setDialogConfig(prev => ({ ...prev, isOpen: false }));

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }
    
    // Fetch existing profile data so the form is pre-filled when editing
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setForm({
              display_name: data.profile.display_name || session?.user?.name || '',
              age: data.profile.age ? data.profile.age.toString() : '',
              gender: data.profile.gender || '',
              blood_group: data.profile.blood_group || '',
              underlying_diseases: data.profile.underlying_diseases || [],
              allergies: data.profile.allergies || [],
              current_medications: data.profile.current_medications || [],
              medical_history: data.profile.medical_history || '',
              emergency_contact: data.profile.emergency_contact || '',
              last_menstruation_date: data.profile.last_menstruation_date || '',
              user_role: data.profile.user_role || null,
              consent_accepted: data.profile.consent_accepted || false,
              menstruation_details: data.profile.menstruation_details || null,
            });
            // If they already have a role, start at step 1 instead of 0
            if (data.profile.user_role && step === 0 && !searchParams.has('step')) {
               setStep(1);
            }
            return;
          }
        }
      } catch (err) {
        console.error("Failed to fetch profile", err);
      }
      
      // Fallback if no profile exists
      if (session?.user?.name) {
        setForm(f => ({ ...f, display_name: f.display_name || session.user!.name! }));
      }
    };
    
    if (status === 'authenticated') {
      fetchProfile();
    }
  }, [session, status, router, step, searchParams]);

  const addTag = (list: keyof typeof form, value: string, setter: (v: string) => void) => {
    const items = value.split(',').map(s => s.trim()).filter(s => s);
    if (items.length === 0) return;
    
    setForm(f => {
      const arr = f[list] as string[];
      // Deduplicate the items from the input and remove ones already in the array
      const uniqueItems = Array.from(new Set(items));
      const newItems = uniqueItems.filter(v => !arr.includes(v));
      if (newItems.length === 0) return f;
      return { ...f, [list]: [...arr, ...newItems] };
    });
    setter('');
  };

  const removeTag = (list: keyof typeof form, value: string) => {
    setForm(f => ({ ...f, [list]: (f[list] as string[]).filter(x => x !== value) }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, age: form.age ? parseInt(form.age) : null }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Refetch session so profileComplete AND userRole become available
        await update({ profileComplete: true, userRole: form.user_role }); 
        
        // Fire-and-forget: generate personalized tips in the background if they are a user
        if (form.user_role === 'user') {
          fetch('/api/tips/generate', { method: 'POST' }).catch(() => {});
        }
        router.push('/?welcome=1');
      } else {
        const errMsg = data.error || 'Unknown error';
        const stp = data.step ? ` [${data.step}]` : '';
        setDialogConfig({ isOpen: true, title: 'Profile Error', message: `Failed to save profile${stp}: ${errMsg}`, type: 'alert', onConfirm: closeDialog });
      }
    } catch (err: any) {
      setDialogConfig({ isOpen: true, title: 'Network Error', message: `Network error: ${err.message}`, type: 'alert', onConfirm: closeDialog });
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="onboarding-loading">
        <div className="onboarding-spinner" />
      </div>
    );
  }

  const isPharmacologist = form.user_role === 'pharmacologist';
  const totalSteps = isPharmacologist ? (form.gender === 'female' ? 2 : 1) : 3;
  const progress = step === 0 ? 0 : (step / totalSteps) * 100;

  return (
    <div className="onboarding-root">
      <CustomDialog 
        isOpen={dialogConfig.isOpen}
        title={dialogConfig.title}
        message={dialogConfig.message}
        type={dialogConfig.type}
        onConfirm={dialogConfig.onConfirm}
        onCancel={closeDialog}
      />
      {/* Background glow based on role */}
      <div className={`onboarding-glow ${isPharmacologist ? 'glow-pharm' : 'glow-user'}`} />

      <div className="onboarding-card">
        {/* Header */}
        <div className="onboarding-hero">
          <div className="onboarding-icon">💊</div>
          <h1 className="onboarding-title">Welcome to Pharma DDI</h1>
          <p className="onboarding-subtitle">
            {session?.user?.name ? `Hi ${session.user.name.split(' ')[0]}! ` : ''}
            {step === 0 ? "Let's personalize your experience." : "Let's set up your profile."}
          </p>
        </div>

        {/* Progress bar */}
        {step > 0 && (
          <div className="onboarding-progress-wrap">
            <div className="onboarding-progress-bar">
              <div className="onboarding-progress-fill" style={{ width: `${progress}%`, backgroundColor: isPharmacologist ? 'var(--pharmacologist-accent)' : 'var(--primary-accent)' }} />
            </div>
            <span className="onboarding-step-label">Step {step} of {totalSteps}</span>
          </div>
        )}

        {/* ── Step 0: Role Selection ── */}
        {step === 0 && (
          <div className="onboarding-step">
            <div className="role-selection-grid">
              <button 
                type="button"
                className={`role-card ${form.user_role === 'user' ? 'active user-active' : ''}`}
                onClick={() => setForm(f => ({ ...f, user_role: 'user' }))}
              >
                <div className="role-card-icon">👤</div>
                <h3>Patient / User</h3>
                <p>Simple answers, health tracking, and easy-to-understand chats.</p>
              </button>

              <button 
                type="button"
                className={`role-card ${form.user_role === 'pharmacologist' ? 'active pharm-active' : ''}`}
                onClick={() => setForm(f => ({ ...f, user_role: 'pharmacologist' }))}
              >
                <div className="role-card-icon"><Stethoscope size={32} /></div>
                <h3>Pharmacologist / MD</h3>
                <p>Advanced drug interaction checker and detailed clinical terminology.</p>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: Basic Info (Both Roles) ── */}
        {step === 1 && (
          <div className="onboarding-step">
            <div className="onboarding-step-title"><User size={20} /> Basic Information</div>

            <div className="ob-field">
              <label className="ob-label">Full Name *</label>
              <input
                className="ob-input"
                placeholder="Your name"
                value={form.display_name}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
              />
            </div>

            <div className="ob-row">
              <div className="ob-field">
                <label className="ob-label"><Calendar size={14} /> Age</label>
                <input
                  className="ob-input"
                  type="number"
                  placeholder="e.g. 32"
                  value={form.age}
                  min={1} max={120}
                  onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                />
              </div>
              <div className="ob-field">
                <label className="ob-label">Gender</label>
                <select className="ob-input ob-select" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <div className="ob-field">
              <label className="ob-label">Blood Group</label>
              <div className="ob-blood-grid">
                {BLOOD_GROUPS.map(bg => (
                  <button
                    key={bg}
                    type="button"
                    className={`ob-blood-btn ${form.blood_group === bg ? 'active' : ''}`}
                    onClick={() => setForm(f => ({ ...f, blood_group: bg }))}
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </div>

            {/* If Pharmacologist, show consent here as this is their last step */}
            {isPharmacologist && (
              <div className="ob-consent-box">
                <label className="ob-consent-label">
                  <input 
                    type="checkbox" 
                    checked={form.consent_accepted} 
                    onChange={e => setForm(f => ({...f, consent_accepted: e.target.checked}))}
                  />
                  <span>
                    <strong>Professional Consent:</strong> I confirm I am a licensed healthcare professional. I understand this tool provides supplementary analysis and does not replace clinical judgment.
                  </span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Pharmacologist Menstruation Details ── */}
        {step === 2 && isPharmacologist && form.gender === 'female' && (
          <div className="onboarding-step">
            <div className="onboarding-step-title"><Calendar size={20} /> Menstruation Details</div>
            <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <MenstruationDetailsForm form={form} setForm={setForm} />
            </div>
            
            <div className="ob-consent-box" style={{ marginTop: '1.5rem' }}>
              <label className="ob-consent-label">
                <input 
                  type="checkbox" 
                  checked={form.consent_accepted} 
                  onChange={e => setForm(f => ({...f, consent_accepted: e.target.checked}))}
                />
                <span>
                  <strong>Data Consent:</strong> I agree to allow Pharma DDI to use my health profile for personalized insights. This data is kept private and local.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* ── Step 2: Medical Background (User Only) ── */}
        {step === 2 && !isPharmacologist && (
          <div className="onboarding-step">
            <div className="onboarding-step-title"><Heart size={20} /> Medical Background</div>

            <div className="ob-field">
              <label className="ob-label"><AlertTriangle size={14} /> Underlying Diseases</label>
              <div className="ob-quick-tags">
                {COMMON_DISEASES.map(d => (
                  <button
                    key={d}
                    type="button"
                    className={`ob-quick-tag ${form.underlying_diseases.includes(d) ? 'active' : ''}`}
                    onClick={() => form.underlying_diseases.includes(d) ? removeTag('underlying_diseases', d) : setForm(f => ({ ...f, underlying_diseases: [...f.underlying_diseases, d] }))}
                  >
                    {form.underlying_diseases.includes(d) && <Check size={12} />} {d}
                  </button>
                ))}
              </div>
              <div className="ob-tag-input-row">
                <input
                  className="ob-input"
                  placeholder="Type another condition & press Enter"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTag('underlying_diseases', tagInput, setTagInput)}
                />
                <button type="button" className="ob-add-btn" onClick={() => addTag('underlying_diseases', tagInput, setTagInput)}><Plus size={16} /></button>
              </div>
              <div className="ob-tags">
                {form.underlying_diseases.filter(d => !COMMON_DISEASES.includes(d)).map(d => (
                  <span key={d} className="ob-tag">{d} <button type="button" onClick={() => removeTag('underlying_diseases', d)}><X size={12} /></button></span>
                ))}
              </div>
            </div>

            <div className="ob-field">
              <label className="ob-label"><AlertTriangle size={14} /> Drug / Food Allergies</label>
              <div className="ob-tag-input-row">
                <input
                  className="ob-input"
                  placeholder="e.g. Penicillin, Sulfa, Shellfish"
                  value={allergyInput}
                  onChange={e => setAllergyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTag('allergies', allergyInput, setAllergyInput)}
                />
                <button type="button" className="ob-add-btn" onClick={() => addTag('allergies', allergyInput, setAllergyInput)}><Plus size={16} /></button>
              </div>
              <div className="ob-tags">
                {form.allergies.map(a => (
                  <span key={a} className="ob-tag ob-tag-red">{a} <button type="button" onClick={() => removeTag('allergies', a)}><X size={12} /></button></span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Medications & History (User Only) ── */}
        {step === 3 && !isPharmacologist && (
          <div className="onboarding-step">
            <div className="onboarding-step-title"><Pill size={20} /> Current Medications & History</div>

            <div className="ob-field">
              <label className="ob-label"><Pill size={14} /> Current Medications</label>
              <div className="ob-tag-input-row">
                <input
                  className="ob-input"
                  placeholder="e.g. Metformin 500mg, Lisinopril 10mg"
                  value={medInput}
                  onChange={e => setMedInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTag('current_medications', medInput, setMedInput)}
                />
                <button type="button" className="ob-add-btn" onClick={() => addTag('current_medications', medInput, setMedInput)}><Plus size={16} /></button>
              </div>
              <div className="ob-tags">
                {form.current_medications.map(m => (
                  <span key={m} className="ob-tag ob-tag-blue">{m} <button type="button" onClick={() => removeTag('current_medications', m)}><X size={12} /></button></span>
                ))}
              </div>
            </div>

            <div className="ob-field">
              <label className="ob-label"><FileText size={14} /> Medical History (optional)</label>
              <textarea
                className="ob-input ob-textarea"
                placeholder="e.g. Past surgeries, hospitalizations, major illnesses..."
                value={form.medical_history}
                onChange={e => setForm(f => ({ ...f, medical_history: e.target.value }))}
                rows={4}
              />
            </div>

            {form.gender === 'female' && (
              <div className="ob-field">
                <label className="ob-label"><Calendar size={14} /> Menstruation Details</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowMenstruationModal(true)}>
                    <Calendar size={16} style={{ marginRight: '6px' }} />
                    {form.last_menstruation_date || form.menstruation_details ? 'Edit Menstruation Details' : 'Add Menstruation Details'}
                  </button>
                </div>
              </div>
            )}

            <div className="ob-field">
              <label className="ob-label"><Phone size={14} /> Emergency Contact (optional)</label>
              <input
                className="ob-input"
                placeholder="e.g. +91 9876543210 (Guardian)"
                value={form.emergency_contact}
                onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))}
              />
            </div>

            <div className="ob-consent-box">
              <label className="ob-consent-label">
                <input 
                  type="checkbox" 
                  checked={form.consent_accepted} 
                  onChange={e => setForm(f => ({...f, consent_accepted: e.target.checked}))}
                />
                <span>
                  <strong>Data Consent:</strong> I agree to allow Pharma DDI to use my health profile for personalized insights. This data is kept private and local.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="onboarding-actions">
          {step > 0 && (
            <button className="ob-btn-secondary" onClick={() => setStep(s => s - 1)}>
              Back
            </button>
          )}
          
          {step === 0 && (
            <button
              className="ob-btn-primary"
              onClick={() => setStep(s => s + 1)}
              disabled={!form.user_role}
            >
              Continue <ChevronRight size={18} />
            </button>
          )}

          {step > 0 && step < totalSteps && (
            <button
              className="ob-btn-primary"
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && !form.display_name.trim()}
            >
              Continue <ChevronRight size={18} />
            </button>
          )}

          {step === totalSteps && (
            <button className={`ob-btn-primary ${isPharmacologist ? 'btn-pharm' : ''}`} onClick={handleSubmit} disabled={saving || !form.consent_accepted}>
              {saving ? 'Saving...' : <>Save Profile & Enter <Check size={18} /></>}
            </button>
          )}
        </div>

        {step > 0 && !isPharmacologist && (
          <button className="ob-skip" onClick={() => router.push('/')}>
            Skip for now
          </button>
        )}
      </div>

      {showMenstruationModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-main)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '2rem', maxWidth: '600px', width: '100%',
            maxHeight: '85vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Calendar size={20} /> Menstruation Details</h3>
              <button onClick={() => setShowMenstruationModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <MenstruationDetailsForm form={form} setForm={setForm} />
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '2rem' }} onClick={() => setShowMenstruationModal(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>Loading...</div>}>
      <OnboardingContent />
    </Suspense>
  );
}
