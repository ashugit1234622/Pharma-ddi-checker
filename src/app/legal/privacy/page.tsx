import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <div className="page-container fade-in" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', color: 'var(--text-main)' }}>
      <h1 className="page-title">Privacy Policy</h1>
      <p style={{ color: 'var(--text-muted)' }}>Last updated: {new Date().toLocaleDateString()}</p>
      
      <div className="card" style={{ marginTop: '2rem' }}>
        <h2 style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }}>1. Information We Collect</h2>
        <p>
          We collect information that you provide directly to us when you create an account, fill out your health profile, or use our services. This includes:
        </p>
        <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem', marginBottom: '1rem', color: 'var(--text-dim)' }}>
          <li>Account details (Name, Email, Profile Picture via Google OAuth)</li>
          <li>Health and medical data (Age, Gender, Blood Group, Underlying Diseases, Allergies, Current Medications, Menstrual Cycle details if opted in)</li>
          <li>Usage data and interactions with our AI assistant (Aastha)</li>
        </ul>

        <h2 style={{ color: 'var(--accent-primary)', marginBottom: '1rem', marginTop: '1.5rem' }}>2. How We Use Your Information</h2>
        <p>
          Your health data is considered Sensitive Personal Data. We strictly use it to:
        </p>
        <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem', marginBottom: '1rem', color: 'var(--text-dim)' }}>
          <li>Provide personalized drug-drug interaction analysis.</li>
          <li>Deliver tailored health, diet, and skincare recommendations.</li>
          <li>Improve the safety and accuracy of AI-generated insights.</li>
        </ul>
        <p><strong>We do NOT sell your personal or health data to third parties, advertisers, or data brokers.</strong></p>

        <h2 style={{ color: 'var(--accent-primary)', marginBottom: '1rem', marginTop: '1.5rem' }}>3. Data Storage and Security</h2>
        <p>
          Your data is encrypted in transit and at rest. We use secure databases and industry-standard authentication (OAuth 2.0) to protect your account. However, no electronic transmission is 100% secure, and we cannot guarantee absolute security.
        </p>

        <h2 style={{ color: 'var(--accent-primary)', marginBottom: '1rem', marginTop: '1.5rem' }}>4. Data Deletion & DPDP/GDPR Rights</h2>
        <p>
          Under the Digital Personal Data Protection (DPDP) Act and similar privacy frameworks, you have the right to request the deletion of your personal data. 
          You can instantly delete all your health data and profile information by navigating to the <strong>Profile page</strong> and clicking <strong>"Delete My Data"</strong>.
        </p>

        <h2 style={{ color: 'var(--accent-primary)', marginBottom: '1rem', marginTop: '1.5rem' }}>5. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy, please contact us at support@pharmaddichecker.com.
        </p>
      </div>
    </div>
  );
}
