import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from './originCheck';

const ALLOWED = ['http://127.0.0.1:5680'];

describe('isAllowedOrigin', () => {
  it('allows a request with no Origin header', () => {
    expect(isAllowedOrigin(undefined, ALLOWED)).toBe(true);
  });

  it('allows an Origin on the list', () => {
    expect(isAllowedOrigin('http://127.0.0.1:5680', ALLOWED)).toBe(true);
  });

  it('allows a second configured origin, e.g. the Vite dev server', () => {
    expect(isAllowedOrigin('http://localhost:5173', ['http://127.0.0.1:5680', 'http://localhost:5173'])).toBe(true);
  });

  it('rejects an Origin not on the list', () => {
    expect(isAllowedOrigin('https://evil.example', ALLOWED)).toBe(false);
  });

  it('rejects a same-scheme, same-port, different-host Origin', () => {
    expect(isAllowedOrigin('http://evil.example:5680', ALLOWED)).toBe(false);
  });
});
