import { useState, useEffect } from 'react';
import { LanguageOption, LANGUAGES } from '../lib/voice';

export function useVoiceLanguage() {
  const [selectedLang, setSelectedLang] = useState<LanguageOption | null>(null);
  const [isLoadingLang, setIsLoadingLang] = useState(true);

  useEffect(() => {
    fetch('/api/user/language')
      .then(res => res.json())
      .then(data => {
        if (data.language) {
          const matchedLang = LANGUAGES.find((l: LanguageOption) => l.code === data.language);
          if (matchedLang) setSelectedLang(matchedLang);
        }
      })
      .catch(e => console.error(e))
      .finally(() => setIsLoadingLang(false));
  }, []);

  const saveLanguage = async (lang: LanguageOption) => {
    setSelectedLang(lang);
    try {
      await fetch('/api/user/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang.code })
      });
    } catch (e) {
      console.error(e);
    }
  };

  return { selectedLang, saveLanguage, isLoadingLang, setSelectedLang };
}
