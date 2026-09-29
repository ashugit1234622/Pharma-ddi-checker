import React from 'react';

export default function RefundPolicyPage() {
  return (
    <div className="page-container fade-in" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', color: 'var(--text-main)' }}>
      <h1 className="page-title">Refund & Cancellation Policy</h1>
      <p style={{ color: 'var(--text-muted)' }}>Last updated: {new Date().toLocaleDateString()}</p>
      
      <div className="card" style={{ marginTop: '2rem' }}>
        <h2 style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }}>1. Subscription Cancellations</h2>
        <p>
          You may cancel your subscription at any time. Upon cancellation, you will continue to have access to the premium features until the end of your current billing cycle. 
          We do not offer prorated refunds for mid-cycle cancellations.
        </p>

        <h2 style={{ color: 'var(--accent-primary)', marginBottom: '1rem', marginTop: '1.5rem' }}>2. Refunds</h2>
        <p>
          As Pharma DDI Checker provides instant access to digital services and AI-generated analysis, all sales are considered final. 
          We generally do not offer refunds once a charge has been successfully processed. 
        </p>
        <p style={{ marginTop: '0.5rem' }}>
          However, exceptions may be made in the following circumstances:
        </p>
        <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem', marginBottom: '1rem', color: 'var(--text-dim)' }}>
          <li>Duplicate charges due to technical errors.</li>
          <li>Inability to access the service due to prolonged platform outages (exceeding 48 hours).</li>
        </ul>

        <h2 style={{ color: 'var(--accent-primary)', marginBottom: '1rem', marginTop: '1.5rem' }}>3. How to Request a Refund</h2>
        <p>
          If you believe you qualify for a refund based on the exceptions above, please contact our support team at <strong>support@pharmaddichecker.com</strong> within 7 days of the charge. 
          Please include your account email and transaction ID.
        </p>
      </div>
    </div>
  );
}
