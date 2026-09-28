import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pharmaddi.app',
  appName: 'Pharma DDI Checker',
  webDir: 'public',
  server: {
    // For local development on Android emulator:
    url: 'http://10.0.2.2:3000',
    cleartext: true,
    // When deploying to production, replace with your live URL:
    // url: 'https://your-production-url.com',
  }
};

export default config;
