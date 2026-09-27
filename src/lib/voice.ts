export interface LanguageOption {
  code: string;        // BCP-47 for SpeechRecognition
  voice: string;       // Edge TTS voice name
  label: string;       // Display label
  nativeLabel: string; // Native script label
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'hi-IN', voice: 'hi-IN-SwaraNeural',     label: 'Hindi',     nativeLabel: 'हिंदी' },
  { code: 'mr-IN', voice: 'mr-IN-AarohiNeural',    label: 'Marathi',   nativeLabel: 'मराठी' },
  { code: 'ta-IN', voice: 'ta-IN-PallaviNeural',   label: 'Tamil',     nativeLabel: 'தமிழ்' },
  { code: 'te-IN', voice: 'te-IN-ShrutiNeural',    label: 'Telugu',    nativeLabel: 'తెలుగు' },
  { code: 'bn-IN', voice: 'bn-IN-TanishaaNeural',  label: 'Bengali',   nativeLabel: 'বাংলা' },
  { code: 'gu-IN', voice: 'gu-IN-DhwaniNeural',    label: 'Gujarati',  nativeLabel: 'ગુજરાતી' },
  { code: 'kn-IN', voice: 'kn-IN-SapnaNeural',     label: 'Kannada',   nativeLabel: 'ಕನ್ನಡ' },
  { code: 'ml-IN', voice: 'ml-IN-SobhanaNeural',   label: 'Malayalam', nativeLabel: 'മലയാളം' },
  { code: 'pa-IN', voice: 'pa-IN-OjasNeural',      label: 'Punjabi',   nativeLabel: 'ਪੰਜਾਬੀ' },
  { code: 'en-IN', voice: 'en-IN-NeerjaNeural',    label: 'English',   nativeLabel: 'English' },
];

// ─── Voice State Machine ──────────────────────────────────────────────────────
export type VoiceMode =
  | 'off'                    // voice mode not active
  | 'permission_required'    // waiting for mic permission
  | 'language_selection'     // choosing language (once per session)
  | 'listening'              // mic active, waiting for speech
  | 'processing'             // transcript sent to Aastha API
  | 'speaking'               // Edge TTS playing
  | 'error';                 // error state

// ─── Web Speech API Type Declarations ───────────────────────────────────────
// These are not always included in TypeScript's lib.dom.d.ts.
export interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
export interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
export interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
export interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
export interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

export interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onnomatch: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: {
      new (): ISpeechRecognition;
    };
    webkitSpeechRecognition?: {
      new (): ISpeechRecognition;
    };
  }
}
