import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer style={{
      marginTop: '4rem',
      padding: '2rem',
      borderTop: '1px solid var(--border)',
      background: 'var(--bg-main)',
      textAlign: 'center',
      fontSize: '0.85rem',
      color: 'var(--text-muted)'
    }}>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '1.5rem',
        marginBottom: '1rem'
      }}>
        <Link href="/legal/terms" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Terms & Conditions</Link>
        <Link href="/legal/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Privacy Policy</Link>
        <Link href="/legal/refund" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Refund Policy</Link>
        <a href="mailto:support@pharmaddichecker.com" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Contact Us</a>
      </div>
      
      <p style={{ margin: '0.5rem 0' }}>
        <strong>Medical Disclaimer:</strong> This application is for educational and informational purposes only. It does not provide medical advice. Always consult a healthcare professional.
      </p>
      
      <p style={{ margin: 0, opacity: 0.7 }}>
        &copy; {new Date().getFullYear()} Pharma DDI Checker. All rights reserved.
      </p>
    </footer>
  );
}
