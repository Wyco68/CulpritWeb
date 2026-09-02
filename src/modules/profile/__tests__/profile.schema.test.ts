import { describe, expect, it } from 'vitest';
import { updateProfileSchema } from '../profile.schema';

describe('updateProfileSchema', () => {
  it('parses a full valid profile', () => {
    const result = updateProfileSchema.safeParse({
      fullName: 'Dr. Cavallaro',
      title: 'Professor of Information Security',
      photoUrl: 'https://example.com/photo.jpg',
      bio: 'Short overview.',
      positionAffiliation: 'Professor, University College London',
      education: [{ title: 'PhD, Computer Science', subtitle: 'MIT', year: '2010' }],
      researchInterests: [{ title: 'Malware analysis' }],
      researchStatement: 'My research statement.',
      invitedTalks: [{ title: 'Keynote', year: '2024' }],
    });
    expect(result.success).toBe(true);
  });

  it('strips HTML from free-text fields', () => {
    const result = updateProfileSchema.safeParse({
      fullName: 'Dr. <b>Cavallaro</b>',
      title: 'Professor',
      bio: '<script>alert(1)</script>Bio text',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.fullName).toBe('Dr. Cavallaro');
    expect(result.data.bio).toBe('alert(1)Bio text');
  });

  it('requires fullName and title', () => {
    const result = updateProfileSchema.safeParse({ bio: 'x' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const fieldErrors = result.error.flatten().fieldErrors;
    expect(fieldErrors.fullName).toBeDefined();
    expect(fieldErrors.title).toBeDefined();
  });

  it('rejects a non-URL photoUrl', () => {
    const result = updateProfileSchema.safeParse({
      fullName: 'Dr. Cavallaro',
      title: 'Professor',
      photoUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('allows photoUrl to be explicitly null (clear the photo)', () => {
    const result = updateProfileSchema.safeParse({
      fullName: 'Dr. Cavallaro',
      title: 'Professor',
      photoUrl: null,
    });
    expect(result.success).toBe(true);
  });

  // The CV list fields left this schema in ADR-012 — Zod now strips them as unknown keys, so
  // asserting on them here would only test Zod. Their validation lives in the teaching module's
  // `teaching.schema.test.ts` instead.
  it('ignores CV list fields, which are no longer part of the profile document', () => {
    const result = updateProfileSchema.safeParse({
      fullName: 'Dr. Cavallaro',
      title: 'Professor',
      education: [{ subtitle: 'MIT' }],
    });

    expect(result.success).toBe(true);
    expect(result.success && 'education' in result.data).toBe(false);
  });
});
