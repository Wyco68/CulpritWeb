import { describe, expect, it } from 'vitest';
import { createResearchSchema, updateResearchSchema } from '../research.schema';

describe('createResearchSchema', () => {
  it('parses a valid research work', () => {
    const result = createResearchSchema.safeParse({
      title: 'Malware Analysis',
      summary: 'Studying evasive malware.',
      area: 'malware analysis',
      sortOrder: 2,
    });
    expect(result.success).toBe(true);
  });

  it('strips HTML from free-text fields', () => {
    const result = createResearchSchema.safeParse({
      title: '<b>Malware</b> Analysis',
      summary: '<script>alert(1)</script>Studying evasive malware.',
      area: 'malware',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe('Malware Analysis');
    expect(result.data.summary).toBe('alert(1)Studying evasive malware.');
  });

  it('requires title, summary, and area', () => {
    const result = createResearchSchema.safeParse({});
    expect(result.success).toBe(false);
    if (result.success) return;
    const fieldErrors = result.error.flatten().fieldErrors;
    expect(fieldErrors.title).toBeDefined();
    expect(fieldErrors.summary).toBeDefined();
    expect(fieldErrors.area).toBeDefined();
  });

  it('defaults sortOrder to undefined when omitted (service applies 0)', () => {
    const result = createResearchSchema.safeParse({
      title: 'X',
      summary: 'Y',
      area: 'Z',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sortOrder).toBeUndefined();
  });

  it('rejects a negative sortOrder', () => {
    const result = createResearchSchema.safeParse({
      title: 'X',
      summary: 'Y',
      area: 'Z',
      sortOrder: -1,
    });
    expect(result.success).toBe(false);
  });
  it('accepts an empty contributor list', () => {
    const result = createResearchSchema.safeParse({
      title: 'Malware Analysis',
      summary: 'Studying evasive malware.',
      area: 'malware analysis',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.contributors).toEqual([]);
  });

  it('keeps only the name of each contributor', () => {
    const result = createResearchSchema.safeParse({
      title: 'Malware Analysis',
      summary: 'Studying evasive malware.',
      area: 'malware analysis',
      contributors: [{ name: 'R. Lindqvist', teamMemberId: 'tm_1', isProfileOwner: false }],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.contributors).toEqual([{ name: 'R. Lindqvist' }]);
  });

  it('rejects more than 20 contributors', () => {
    const result = createResearchSchema.safeParse({
      title: 'Malware Analysis',
      summary: 'Studying evasive malware.',
      area: 'malware analysis',
      contributors: Array.from({ length: 21 }, (_, i) => ({ name: `C${i}` })),
    });
    expect(result.success).toBe(false);
  });

  it('rejects an over-length contributor name', () => {
    const result = createResearchSchema.safeParse({
      title: 'Malware Analysis',
      summary: 'Studying evasive malware.',
      area: 'malware analysis',
      contributors: [{ name: 'a'.repeat(201) }],
    });
    expect(result.success).toBe(false);
  });
});

describe('updateResearchSchema', () => {
  it('allows a partial update', () => {
    const result = updateResearchSchema.safeParse({ title: 'New title' });
    expect(result.success).toBe(true);
  });

  it('allows an empty object (no-op update rejected later by the service, not the schema)', () => {
    const result = updateResearchSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  // Regression: identical defect to `updatePublicationSchema` — `.partial()` keeps `.default([])`
  // in Zod 4, so an update that never mentioned contributors arrived as `[]` and the repository
  // wiped the byline.
  it('leaves `contributors` absent when the key is omitted', () => {
    const result = updateResearchSchema.parse({ title: 'New title' });
    expect('contributors' in result).toBe(false);
    expect(result.contributors).toBeUndefined();
  });

  it('keeps an explicit empty `contributors` array, which clears the byline', () => {
    const result = updateResearchSchema.parse({ contributors: [] });
    expect(result.contributors).toEqual([]);
  });
});

describe('research cover and gallery', () => {
  const base = { title: 'X', summary: 'Y', area: 'Z' };

  it('accepts a cover, a crop and a gallery', () => {
    const parsed = createResearchSchema.parse({
      ...base,
      coverPhotoUrl: 'https://r2.example/cover.jpg',
      coverCrop: { url: 'https://r2.example/cover.jpg', x: 0.1, y: 0, width: 0.8, height: 1 },
      photoUrls: ['https://r2.example/a.jpg', 'https://r2.example/b.jpg'],
    });
    expect(parsed.photoUrls).toHaveLength(2);
    expect(parsed.coverCrop?.width).toBe(0.8);
  });

  it('rejects a non-http gallery photo', () => {
    expect(
      createResearchSchema.safeParse({ ...base, photoUrls: ['javascript:alert(1)'] }).success,
    ).toBe(false);
  });

  it('caps the gallery at 20 photos', () => {
    const photoUrls = Array.from({ length: 21 }, (_, i) => `https://r2.example/${i}.jpg`);
    expect(createResearchSchema.safeParse({ ...base, photoUrls }).success).toBe(false);
  });
});
