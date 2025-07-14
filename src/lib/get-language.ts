import { cookies } from 'next/headers';
import { translations, Translation } from './locales';

type Language = keyof typeof translations;

export function getLanguage(): Translation {
  // In a real app, you might get the language from cookies or headers
  // For this app, we'll default to Korean ('ko') on the server
  const lang: Language = 'ko'; 
  return translations[lang];
}
