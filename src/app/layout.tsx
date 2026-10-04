import type { Metadata, Viewport } from 'next';
import './globals.css';
import './medcheck.css';
import './pwa.css';
import Script from 'next/script';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import GlobalReminder from '@/components/GlobalReminder';
import TipOfTheDay from '@/components/TipOfTheDay';
import NextAuthProvider from '@/components/NextAuthProvider';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import GoogleOneTapWrapper from '@/components/GoogleOneTapWrapper';

export const viewport: Viewport = {
  themeColor: '#0d1117',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: 'Pharma DDI Checker | AI-Powered Drug Interaction Analysis',
  description:
    'Check drug-drug interactions with AI-powered analysis, ADME comparison charts, toxicity profiles, and clinical recommendations based on KD Tripathi pharmacology.',
  keywords: ['DDI', 'Drug-Drug Interaction', 'Pharmacology', 'Healthcare AI', 'Medication Safety', 'ADME', 'Toxicity Tracker'],
  authors: [{ name: 'Ashirwad' }],
  metadataBase: new URL('https://pharma-ddi-checker-1.onrender.com'),
  openGraph: {
    title: 'Pharma DDI Checker | Next-Gen Pharmacovigilance',
    description: 'AI-powered ADME tracking, real-time toxicity profiles, and clinical recommendations built for healthcare professionals and patients.',
    url: 'https://pharma-ddi-checker-1.onrender.com',
    siteName: 'Pharma DDI Checker',
    images: [
      {
        url: '/assets/images/DDI_checks.png',
        width: 1200,
        height: 630,
        alt: 'Pharma DDI Checker Dashboard preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pharma DDI Checker',
    description: 'AI-powered ADME tracking and real-time toxicity profiles.',
    images: ['/assets/images/DDI_checks.png'],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Pharma DDI',
  },
  icons: {
    icon: '/icon-512.jpg',
    apple: '/icon-512.jpg',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.userRole || 'user';
  const themeClass = userRole === 'pharmacologist' ? 'theme-pharmacologist' : 'theme-user';

  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-512.jpg" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Pharma DDI" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#0d1117" />
        <meta name="msapplication-TileImage" content="/icon-512.jpg" />
      </head>
      <body className={themeClass}>
        <NextAuthProvider>
          <GoogleOneTapWrapper />
          {/* Service Worker Registration */}
          <Script
            id="sw-register"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js', { scope: '/' })
                      .then(function(reg) { console.log('[SW] Registered:', reg.scope); })
                      .catch(function(err) { console.warn('[SW] Registration failed:', err); });
                  });
                }
              `,
            }}
          />
          <Header />
          <GlobalReminder />
          <TipOfTheDay />
          <main className="container">{children}</main>
          <Footer />
        </NextAuthProvider>
      </body>
    </html>
  );
}
