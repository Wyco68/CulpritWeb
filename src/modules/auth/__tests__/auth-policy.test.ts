// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ADMIN_EMAIL, ADMIN_EMAIL_MASKED, maskEmail } from '../auth-policy';

describe('ADMIN_EMAIL', () => {
  it('is the lab mailbox, and its masked form hides the local part', () => {
    expect(ADMIN_EMAIL).toBe('culpritteam@gmail.com');
    expect(ADMIN_EMAIL_MASKED).toBe('cu•••••••••@gmail.com');
  });
});

describe('maskEmail', () => {
  it.each([
    ['culpritteam@gmail.com', 'cu•••••••••@gmail.com'],
    ['abcd@example.com', 'ab••@example.com'],
    ['abc@example.com', 'a••@example.com'],
    ['ab@example.com', 'a•@example.com'],
    ['a@example.com', '•@example.com'],
  ])('%s → %s', (input, expected) => {
    expect(maskEmail(input)).toBe(expected);
  });

  it('always hides at least one character and never the domain', () => {
    for (const local of ['a', 'ab', 'abc', 'abcd', 'abcdefghij']) {
      const masked = maskEmail(`${local}@lab.example`);
      expect(masked.endsWith('@lab.example')).toBe(true);
      const maskedLocal = masked.slice(0, -'@lab.example'.length);
      expect(maskedLocal).toHaveLength(local.length);
      expect(maskedLocal).toContain('•');
      expect(maskedLocal).not.toBe(local);
    }
  });

  it('splits on the last @ and trims surrounding whitespace', () => {
    expect(maskEmail('  "odd@local"@example.com ')).toBe('"o•••••••••@example.com');
  });

  it('masks a string without a usable @ as a whole', () => {
    expect(maskEmail('nodomain')).toBe('no••••••');
    expect(maskEmail('trailing@')).toBe('tr•••••••');
    expect(maskEmail('@example.com')).toBe('@e••••••••••');
    expect(maskEmail('')).toBe('•');
  });
});
