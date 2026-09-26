'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { User, Calendar, Heart, AlertTriangle, Pill, FileText, Phone, ChevronRight, Check, Plus, X } from 'lucide-react';
import CustomDialog from '@/components/CustomDialog';

const COMMON_DISEASES = ['Diabetes', 'Hypertension', 'Asthma', 'Heart Disease', 'COPD', 'Thyroid', 'Kidney Disease', 'Liver Disease', 'Epilepsy', 'Arthritis'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function OnboardingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [step, setStep] = useState(1);
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
  });

  const [dialogConfig, setDialogConfig] = useState<{isOpen: boolean, title?: string, message: string, type: 'alert', onConfirm: () => void}>({
    isOpen: false, message: '', type: 'alert', onConfirm: () => {}
  });

  const closeDialog = () => setDialogConfig(prev => ({ ...prev, isOpen: false }));

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
    if (session?.user?.name) {
      setForm(f => ({ ...f, display_name: f.display_name || session.user!.name! }));
    }
  }, [session, status]);

  const addTag = (list: keyof typeof form, value: string, setter: (v: string) => void) => {
    const v = value.trim();
    if (!v) return;
    const arr = form[list] as string[];
    if (!arr.includes(v)) setForm(f => ({ ...f, [list]: [...arr, v] }));
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
        await update({ profileComplete: true }); // Refetch session so profileComplete becomes true
        // Fire-and-forget: generate personalized tips in the background
        fetch('/api/tips/generate', { method: 'POST' }).catch(() => {});
        router.push('/?welcome=1');
      } else {
        const errMsg = data.error || 'Unknown error';
        const step = data.step ? ` [${data.step}]` : '';
        setDialogConfig({ isOpen: true, title: 'Profile Error', message: `Failed to save profile${step}: ${errMsg}`, type: 'alert', onConfirm: closeDialog });
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

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

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
      {/* Background glow */}
      <div className="onboarding-glow" />

      <div className="onboarding-card">
        {/* Header */}
        <div className="onboarding-hero">
          <div className="onboarding-icon">💊</div>
          <h1 className="onboarding-title">Welcome to Pharma DDI</h1>
          <p className="onboarding-subtitle">
            {session?.user?.name ? `Hi ${session.user.name.split(' ')[0]}! ` : ''}
            Let's set up your health profile to personalize your experience.
          </p>
        </div>

        {/* Progress bar */}
        <div className="onboarding-progress-wrap">
          <div className="onboarding-progress-bar">
            <div className="onboarding-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="onboarding-step-label">Step {step} of {totalSteps}</span>
        </div>

        {/* ── Step 1: Basic Info ── */}
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
          </div>
        )}

        {/* ── Step 2: Medical Background ── */}
        {step === 2 && (
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

        {/* ── Step 3: Medications & History ── */}
        {step === 3 && (
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

            <div className="ob-field">
              <label className="ob-label"><Phone size={14} /> Emergency Contact (optional)</label>
              <input
                className="ob-input"
                placeholder="e.g. +91 9876543210 (Guardian)"
                value={form.emergency_contact}
                onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))}
              />
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="onboarding-actions">
          {step > 1 && (
            <button className="ob-btn-secondary" onClick={() => setStep(s => s - 1)}>
              Back
            </button>
          )}
          {step < totalSteps ? (
            <button
              className="ob-btn-primary"
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && !form.display_name.trim()}
            >
              Continue <ChevronRight size={18} />
            </button>
          ) : (
            <button className="ob-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : <>Save Profile <Check size={18} /></>}
            </button>
          )}
        </div>

        <button className="ob-skip" onClick={() => router.push('/')}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
