import { describe, expect, it } from 'vitest';
import { createPublicationSchema, updatePublicationSchema } from '../publication.schema';

describe('createPublicationSchema', () => {
  it('parses a valid publication', () => {
    const result = createPublicationSchema.safeParse({
      title: 'Evasive Malware Detection',
      authors: 'A. Author, B. Author',
      venue: 'USENIX Security',
      year: 2024,
      link: 'https://doi.org/10.1234/abcd',
    });
    expect(result.success).toBe(true);
  });

  it('coerces a numeric-string year', () => {
    const result = createPublicationSchema.safeParse({
      title: 'X',
      authors: 'Y',
      venue: 'Z',
      year: '2024',
      link: 'https://example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.year).toBe(2024);
  });

  it('rejects an out-of-range year', () => {
    const result = createPublicationSchema.safeParse({
      title: 'X',
      authors: 'Y',
      venue: 'Z',
      year: 1899,
      link: 'https://example.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-URL link', () => {
    const result = createPublicationSchema.safeParse({
      title: 'X',
      authors: 'Y',
      venue: 'Z',
      year: 2024,
      link: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('strips HTML from free-text fields', () => {
    const result = createPublicationSchema.safeParse({
      title: '<b>Evasive</b> Malware',
      authors: 'A. Author',
      venue: 'USENIX',
      year: 2024,
      link: 'https://example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe('Evasive Malware');
  });
});

describe('updatePublicationSchema', () => {
  it('allows a partial update', () => {
    const result = updatePublicationSchema.safeParse({ year: 2025 });
    expect(result.success).toBe(true);
  });
});
