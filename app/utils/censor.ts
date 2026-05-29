export const STOP_WORDS = [
  // Russian profanity / insults (roots)
  'хуй', 'пизд', 'еба', 'бля', 'шлюх', 'пидор', 'гандон', 'говно', 'сука', 'мудак', 'залуп', 'дроч', 'хер', 'хрен',
  // English profanity / insults (roots)
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'nigg', 'fag', 'slut', 'whore', 'bastard', 'cock', 'retard',
  // Specific restrictions
  'hitler', 'nazi', 'admin', 'moderator', 'system', 'support', 'fitmanager'
];

export function containsProfanity(text: string): boolean {
  if (!text) return false;
  
  // Normalize visually similar characters (leetspeak & cyrillic/latin mixing)
  const normalized = text.toLowerCase()
    .replace(/[0134@xypcaeo]/g, match => {
       const replacements: Record<string, string> = {
         '0': 'o', '1': 'i', '3': 'e', '4': 'a', '@': 'a', 
         'x': 'х', 'y': 'у', 'p': 'р', 'c': 'с', 'a': 'а', 'e': 'е', 'o': 'о'
       };
       return replacements[match] || match;
    })
    .replace(/[^а-яa-z]/g, ''); // remove all non-letters to catch spaced-out words

  // Check normalized continuous string
  for (const word of STOP_WORDS) {
    if (normalized.includes(word)) {
      return true;
    }
  }

  // Check original string tokens (in case normalization merges words incorrectly)
  const lowerOrig = text.toLowerCase();
  for (const word of STOP_WORDS) {
    if (lowerOrig.includes(word)) {
      return true;
    }
  }

  return false;
}
