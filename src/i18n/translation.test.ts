import { describe, expect, it } from 'vitest';
import en from './en/translation.json';
import fr from './fr/translation.json';

// Both languages must carry every message, in the same order (so a missing one is easy to see in a diff), and with the
// same placeholders: a French message that forgets `{{when}}` shows English-looking gaps in the middle of a sentence.

const placeholders = (text: string) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  const enKeys = Object.keys(en);
  const frKeys = Object.keys(fr);

  it('have the same keys in the same order in English and French', () => {
    expect(frKeys).toEqual(enKeys);
  });

  it.each(enKeys)('%s uses the same placeholders in both languages', (key) => {
    expect(placeholders((fr as Record<string, string>)[key] ?? '')).toEqual(placeholders((en as Record<string, string>)[key]));
  });

  it('have no empty message', () => {
    for (const [key, text] of [...Object.entries(en), ...Object.entries(fr)]) {
      expect(text.trim(), key).not.toBe('');
    }
  });
});
