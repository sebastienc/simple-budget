import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { centsToInputValue, formatCents, formatCentsAxis, formatCentsSigned, parseAmountToCents } from './money';

describe('formatCents', () => {
  it('formats English amounts with a leading currency symbol and comma grouping', () => {
    i18next.language = 'en-US';
    expect(formatCents(123_456, 'CAD')).toBe('CA$1,234.56');
  });

  it('formats French amounts with a trailing currency symbol and different grouping', () => {
    i18next.language = 'fr-CA';
    // \u00A0 (non-breaking space) is what Intl actually uses here, not a plain space.
    expect(formatCents(123_456, 'CAD')).toBe('1\u00A0234,56\u00A0$');
  });

  it('rounds negative cents to a signed decimal amount', () => {
    i18next.language = 'en-US';
    expect(formatCents(-500, 'CAD')).toBe('-CA$5.00');
  });
});

describe('formatCentsAxis', () => {
  it('drops decimal places for chart axis ticks', () => {
    i18next.language = 'en-US';
    expect(formatCentsAxis(123_456, 'CAD')).toBe('CA$1,235');
  });
});

describe('formatCentsSigned', () => {
  it('prefixes a positive amount with +', () => {
    i18next.language = 'en-US';
    expect(formatCentsSigned(500, 'CAD')).toBe('+CA$5.00');
  });

  it('prefixes a negative amount with − and formats the absolute value', () => {
    i18next.language = 'en-US';
    expect(formatCentsSigned(-500, 'CAD')).toBe('−CA$5.00');
  });

  it('treats zero as positive', () => {
    i18next.language = 'en-US';
    expect(formatCentsSigned(0, 'CAD')).toBe('+CA$0.00');
  });
});

describe('parseAmountToCents', () => {
  it('converts a decimal string to whole cents', () => {
    expect(parseAmountToCents('12.34')).toBe(1234);
  });

  it('rounds instead of truncating on floating-point noise', () => {
    expect(parseAmountToCents('19.99')).toBe(1999);
  });

  it('treats an empty string as zero', () => {
    expect(parseAmountToCents('')).toBe(0);
  });

  it('handles a bare integer with no decimal point', () => {
    expect(parseAmountToCents('50')).toBe(5000);
  });
});

describe('centsToInputValue', () => {
  it('renders whole dollars with no trailing decimal noise', () => {
    expect(centsToInputValue(5000)).toBe('50');
  });

  it('renders fractional cents as an unformatted decimal, not a localized string', () => {
    expect(centsToInputValue(1234)).toBe('12.34');
  });

  it('renders a negative amount with a leading minus', () => {
    expect(centsToInputValue(-500)).toBe('-5');
  });
});
