import { describe, expect, it } from 'vitest';
import { createResearchGroupSchema, updateResearchGroupSchema } from '../research-group.schema';

describe('createResearchGroupSchema', () => {
  it('parses a valid group', () => {
    const result = createResearchGroupSchema.safeParse({
      name: 'Systems Security Lab',
      description: 'Working on OS and hypervisor security.',
    });
    expect(result.success).toBe(true);
  });

  it('requires name and description', () => {
    const result = createResearchGroupSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('strips HTML from free-text fields', () => {
    const result = createResearchGroupSchema.safeParse({
      name: '<b>Systems</b> Security Lab',
      description: '<script>alert(1)</script>Description',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Systems Security Lab');
  });
});

describe('updateResearchGroupSchema', () => {
  it('allows a partial update', () => {
    const result = updateResearchGroupSchema.safeParse({ name: 'New name' });
    expect(result.success).toBe(true);
  });
});
