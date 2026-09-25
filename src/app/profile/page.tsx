'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { User, Activity, AlertTriangle, Droplets, Calendar, ShieldAlert, FileText, Phone } from 'lucide-react';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }
    
    if (status === 'authenticated') {
      fetch('/api/profile')
        .then(res => res.json())
        .then(data => {
          if (data.profile) setProfile(data.profile);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [status, router]);

  if (loading || status === 'loading') {
    return <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><div className="spinner" /></div>;
  }

  if (!profile) {
    return (
      <div className="page-container fade-in">
        <h1 className="page-title">User Profile</h1>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No profile details found.</p>
          <button className="btn btn-primary" onClick={() => router.push('/onboarding')}>Complete Onboarding</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container fade-in">
      <div className="card" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem', background: 'linear-gradient(to right, rgba(99, 102, 241, 0.1), transparent)' }}>
        {session?.user?.image ? (
          <img src={session.user.image} alt="Profile" style={{ width: 80, height: 80, borderRadius: '50%', border: '2px solid var(--accent-primary)' }} />
        ) : (
          <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={40} style={{ color: 'var(--text-muted)' }} />
          </div>
        )}
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--text-main)' }}>{profile.display_name || session?.user?.name || 'User'}</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>{session?.user?.email}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <div className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: 'var(--accent-primary)' }}>
            <User size={20} /> Personal Information
          </h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div><span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Age</span><div style={{ fontWeight: 500 }}>{profile.age || 'Not provided'}</div></div>
            <div><span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Gender</span><div style={{ fontWeight: 500, textTransform: 'capitalize' }}>{profile.gender || 'Not provided'}</div></div>
            <div><span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Blood Group</span><div style={{ fontWeight: 500 }}>{profile.blood_group || 'Not provided'}</div></div>
            <div><span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Emergency Contact</span><div style={{ fontWeight: 500 }}>{profile.emergency_contact || 'Not provided'}</div></div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: 'var(--accent-primary)' }}>
            <Activity size={20} /> Medical Profile
          </h3>
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            <div>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <ShieldAlert size={14} /> Allergies
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                {profile.allergies && profile.allergies.length > 0 ? profile.allergies.map((a: string, i: number) => (
                  <span key={i} style={{ padding: '0.25rem 0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '20px', fontSize: '0.85rem' }}>{a}</span>
                )) : <span style={{ color: 'var(--text-muted)' }}>None</span>}
              </div>
            </div>
            
            <div>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <AlertTriangle size={14} /> Underlying Diseases
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                {profile.underlying_diseases && profile.underlying_diseases.length > 0 ? profile.underlying_diseases.map((d: string, i: number) => (
                  <span key={i} style={{ padding: '0.25rem 0.75rem', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', borderRadius: '20px', fontSize: '0.85rem' }}>{d}</span>
                )) : <span style={{ color: 'var(--text-muted)' }}>None</span>}
              </div>
            </div>

            <div>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Droplets size={14} /> Current Medications
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                {profile.current_medications && profile.current_medications.length > 0 ? profile.current_medications.map((m: string, i: number) => (
                  <span key={i} style={{ padding: '0.25rem 0.75rem', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: '20px', fontSize: '0.85rem' }}>{m}</span>
                )) : <span style={{ color: 'var(--text-muted)' }}>None</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <button className="btn btn-outline" onClick={() => router.push('/onboarding')} style={{ padding: '0.75rem 2rem' }}>
          Edit Profile
        </button>
      </div>
    </div>
  );
}
