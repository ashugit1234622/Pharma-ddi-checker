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
  }
}

export default function GoogleOneTap({ clientId }: { clientId: string }) {
  const { status } = useSession();
  const scriptLoaded = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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
                  callbackUrl: '/'
                });
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
            // You can optionally add context: 'signin' | 'signup' | 'use'
            context: 'signin'
          });
          window.google.accounts.id.prompt();
        }
      };
      document.body.appendChild(script);
      scriptLoaded.current = true;
    } else {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.prompt();
      }
    }
  }, [mounted, status, clientId]);

  return null;
}
