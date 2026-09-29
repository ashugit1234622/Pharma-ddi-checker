import GoogleOneTap from './GoogleOneTap';

export default function GoogleOneTapWrapper() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  if (!clientId) return null;
  
  return <GoogleOneTap clientId={clientId} />;
}
