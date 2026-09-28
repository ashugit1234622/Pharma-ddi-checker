'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

export default function NativeAppInitializer() {
  useEffect(() => {
    const initNativeApp = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Set status bar to match the dark theme
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#0d1117' });
          
          // Hide splash screen after initialization
          await SplashScreen.hide();
        } catch (error) {
          console.error('Error initializing native plugins:', error);
        }
      }
    };

    initNativeApp();
  }, []);

  return null;
}
