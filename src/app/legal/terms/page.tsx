import React from 'react';

export default function TermsPage() {
  return (
    <div className="page-container fade-in" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', color: 'var(--text-main)' }}>
      <h1 className="page-title">Terms & Conditions</h1>
      <p style={{ color: 'var(--text-muted)' }}>Last updated: {new Date().toLocaleDateString()}</p>
      
      <div className="card" style={{ marginTop: '2rem' }}>
        <h2 style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }}>1. Educational and Informational Purpose Only</h2>
        <p style={{ fontWeight: 'bold', color: 'var(--warning)' }}>
          DISCLAIMER: Pharma DDI Checker and its AI assistants (including Aastha) are designed for educational, informational, and clinical decision-support purposes ONLY. 
          They do NOT constitute professional medical advice, diagnosis, or treatment.
        </p>
        <p>
          Always seek the advice of your physician, pharmacist, or other qualified health provider with any questions you may have regarding a medical condition or medication. Never disregard professional medical advice or delay in seeking it because of something you have read on this application.
        </p>

        <h2 style={{ color: 'var(--accent-primary)', marginBottom: '1rem', marginTop: '1.5rem' }}>2. Emergency Situations</h2>
        <p>
          If you think you may have a medical emergency, call your doctor, go to the nearest hospital emergency department, or call emergency services (e.g., 911, 112) immediately. 
          Do not rely on this application for urgent medical needs.
        </p>

        <h2 style={{ color: 'var(--accent-primary)', marginBottom: '1rem', marginTop: '1.5rem' }}>3. Limitation of Liability</h2>
        <p>
          The developers, authors, and publishers of Pharma DDI Checker shall not be held legally responsible or liable for any direct, indirect, incidental, or consequential damages resulting from the use of, or inability to use, the application. The reliance on any information provided by the AI or the platform is solely at your own risk.
        </p>

        <h2 style={{ color: 'var(--accent-primary)', marginBottom: '1rem', marginTop: '1.5rem' }}>4. User Conduct</h2>
        <p>
          By using this service, you agree not to use the application in any way that violates applicable laws or regulations, including attempting to reverse engineer the AI models, scraping data, or using the platform to generate illicit or harmful content.
        </p>

        <h2 style={{ color: 'var(--accent-primary)', marginBottom: '1rem', marginTop: '1.5rem' }}>5. Account Suspension</h2>
        <p>
          We reserve the right to suspend or terminate accounts that abuse the platform, exceed reasonable usage limits, or violate these Terms and Conditions.
        </p>
      </div>
    </div>
  );
}
