'use client';
import { useEffect, useRef, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';

// Extend window object to include google identity services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (notification?: (notification: any) => void) => void;
          cancel: () => void;
        };
      };
    };
    triggerGoogleSignIn?: () => void;
  }
}

export default function GoogleOneTap({ clientId }: { clientId: string }) {
  const { status } = useSession();
  const scriptLoaded = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Set up global sign in trigger function
    window.triggerGoogleSignIn = () => {
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile && window.google?.accounts?.id) {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            signIn('google');
          }
        });
      } else {
        signIn('google');
      }
    };
    
    return () => {
      delete window.triggerGoogleSignIn;
    };
  }, []);

  useEffect(() => {
    if (!mounted || status !== 'unauthenticated' || !clientId) return;

    if (!scriptLoaded.current) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google?.accounts?.id) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response: any) => {
              if (response.credential) {
                signIn('credentials', {
                  idToken: response.credential,
                  redirect: true,
                  callbackUrl: window.location.href
                });
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
            context: 'signin'
          });
          
          // Auto-prompt on mobile for seamless login
          const isMobile = window.innerWidth <= 768;
          if (isMobile) {
            window.google.accounts.id.prompt();
          }
        }
      };
      document.body.appendChild(script);
      scriptLoaded.current = true;
    }
  }, [mounted, status, clientId]);

  return null;
}
