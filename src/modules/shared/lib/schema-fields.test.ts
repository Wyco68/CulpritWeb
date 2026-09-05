import { describe, expect, it } from 'vitest';
import { httpUrl, optionalUrl, safeText } from './schema-fields';

// Covers the two boundary defects this vocabulary was fixed for. Both are cheap to reintroduce by
// reordering a Zod chain, and neither is visible from a passing type-check.

describe('safeText', () => {
  it('rejects input that is empty once markup is stripped', () => {
    // `.min(1)` before `.transform(stripHtml)` would pass these and store ''.
    for (const markupOnly of ['<b></b>', '<img src=x onerror=alert(1)>', '<p>   </p>']) {
      expect(safeText(300).safeParse(markupOnly).success).toBe(false);
    }
  });

  it('measures the length limit against the sanitized value', () => {
    const parsed = safeText(10).safeParse('<b>hello</b>');
    expect(parsed).toMatchObject({ success: true, data: 'hello' });
  });

  it('accepts ordinary text', () => {
    expect(safeText(300).safeParse('A Real Title')).toMatchObject({ data: 'A Real Title' });
  });
});

describe('optionalUrl', () => {
  it('rejects non-http(s) schemes', () => {
    // `z.string().url()` alone accepts all of these; they reach an href on the public site.
    for (const dangerous of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
    ]) {
      expect(optionalUrl.safeParse(dangerous).success).toBe(false);
      expect(httpUrl.safeParse(dangerous).success).toBe(false);
    }
  });

  it('accepts http and https', () => {
    expect(optionalUrl.safeParse('https://example.com/x')).toMatchObject({
      data: 'https://example.com/x',
    });
    expect(optionalUrl.safeParse('http://example.com')).toMatchObject({
      data: 'http://example.com',
    });
  });

  it('treats an untouched empty input as "unset"', () => {
    expect(optionalUrl.safeParse('')).toMatchObject({ success: true, data: null });
  });
});
