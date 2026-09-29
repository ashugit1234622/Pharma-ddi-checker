import { signIn } from 'next-auth/react';

export const triggerSignIn = () => {
  if (typeof window !== 'undefined' && window.triggerGoogleSignIn) {
    window.triggerGoogleSignIn();
  } else {
    signIn('google', { prompt: 'select_account' });
  }
};
