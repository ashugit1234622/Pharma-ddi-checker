import React from 'react';
import { Calendar } from 'lucide-react';

export default function MenstruationDetailsForm({ form, setForm }: { form: any, setForm: any }) {
  const handleChange = (phase: string, q: string, value: string) => {
    setForm((f: any) => ({
      ...f,
      menstruation_details: {
        ...(f.menstruation_details || {}),
        [phase]: {
          ...(f.menstruation_details?.[phase] || {}),
          [q]: value
        }
      }
    }));
  };

  const handleFinal = (value: string) => {
    setForm((f: any) => ({
      ...f,
      menstruation_details: {
        ...(f.menstruation_details || {}),
        final_question: value
      }
    }));
  };

  const details = form.menstruation_details || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
      <div className="ob-field">
        <label className="ob-label"><Calendar size={14} /> Date of Last Menstruation</label>
        <input
          className="ob-input"
          type="date"
          value={form.last_menstruation_date || ''}
          onChange={e => setForm((f: any) => ({ ...f, last_menstruation_date: e.target.value }))}
        />
      </div>

      <div className="ob-field">
        <h4 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', marginTop: '1rem' }}>🌑 Menstrual Phase</h4>
        <label className="ob-label">How do you usually feel physically and emotionally during your period?</label>
        <textarea className="ob-input ob-textarea" rows={2} 
          value={details.menstrual_phase?.q1 || ''} 
          onChange={e => handleChange('menstrual_phase', 'q1', e.target.value)} />
        
        <label className="ob-label" style={{ marginTop: '0.75rem' }}>What changes in your energy, appetite, sleep, or daily activities do you usually notice?</label>
        <textarea className="ob-input ob-textarea" rows={2} 
          value={details.menstrual_phase?.q2 || ''} 
          onChange={e => handleChange('menstrual_phase', 'q2', e.target.value)} />
      </div>

      <div className="ob-field">
        <h4 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>🌱 Follicular Phase</h4>
        <label className="ob-label">How do you usually feel after your period ends, physically and emotionally?</label>
        <textarea className="ob-input ob-textarea" rows={2} 
          value={details.follicular_phase?.q1 || ''} 
          onChange={e => handleChange('follicular_phase', 'q1', e.target.value)} />
        
        <label className="ob-label" style={{ marginTop: '0.75rem' }}>Do you notice any changes in your energy, mood, motivation, appetite, or focus?</label>
        <textarea className="ob-input ob-textarea" rows={2} 
          value={details.follicular_phase?.q2 || ''} 
          onChange={e => handleChange('follicular_phase', 'q2', e.target.value)} />
      </div>

      <div className="ob-field">
        <h4 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>🌸 Ovulation Phase</h4>
        <label className="ob-label">What changes do you usually notice around the middle of your cycle?</label>
        <textarea className="ob-input ob-textarea" rows={2} 
          value={details.ovulation_phase?.q1 || ''} 
          onChange={e => handleChange('ovulation_phase', 'q1', e.target.value)} />
        
        <label className="ob-label" style={{ marginTop: '0.75rem' }}>Do you notice any recurring changes in your mood, energy, appetite, body, or social behaviour?</label>
        <textarea className="ob-input ob-textarea" rows={2} 
          value={details.ovulation_phase?.q2 || ''} 
          onChange={e => handleChange('ovulation_phase', 'q2', e.target.value)} />
      </div>

      <div className="ob-field">
        <h4 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>🌙 Luteal / Premenstrual Phase</h4>
        <label className="ob-label">How do you usually feel in the days leading up to your period?</label>
        <textarea className="ob-input ob-textarea" rows={2} 
          value={details.luteal_phase?.q1 || ''} 
          onChange={e => handleChange('luteal_phase', 'q1', e.target.value)} />
        
        <label className="ob-label" style={{ marginTop: '0.75rem' }}>What physical, emotional, or behavioural changes do you usually notice before your next period begins?</label>
        <textarea className="ob-input ob-textarea" rows={2} 
          value={details.luteal_phase?.q2 || ''} 
          onChange={e => handleChange('luteal_phase', 'q2', e.target.value)} />
      </div>

      <div className="ob-field">
        <h4 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Final Overall Question</h4>
        <label className="ob-label">Looking back at your recent cycles, what patterns do you notice repeating from one cycle to another?</label>
        <textarea className="ob-input ob-textarea" rows={3} 
          value={details.final_question || ''} 
          onChange={e => handleFinal(e.target.value)} />
      </div>
    </div>
  );
}
