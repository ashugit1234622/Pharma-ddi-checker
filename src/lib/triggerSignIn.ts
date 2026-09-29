import { signIn } from 'next-auth/react';

export const triggerSignIn = () => {
  if (typeof window !== 'undefined' && (window as any).triggerGoogleSignIn) {
    (window as any).triggerGoogleSignIn();
  } else {
    signIn('google', { prompt: 'select_account' });
  }
};
