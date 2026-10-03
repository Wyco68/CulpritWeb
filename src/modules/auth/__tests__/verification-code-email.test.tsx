// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { render } from '@react-email/components';
import {
  VerificationCodeEmail,
  verificationCodeSubject,
  verificationCodeText,
  type VerificationCodePurpose,
} from '../emails/verification-code-email';

const PURPOSES: VerificationCodePurpose[] = ['sign-in', 'enable-two-factor', 'password-reset'];

describe('VerificationCodeEmail', () => {
  it.each(PURPOSES)('renders the code and its expiry (%s)', async (purpose) => {
    const html = await render(
      <VerificationCodeEmail code="12345678" purpose={purpose} expiresInMinutes={5} />,
    );

    expect(html).toContain('12345678');
    expect(html).toContain('This code expires in 5 minutes.');
    expect(html).toContain('monospace');
  });

  it('keeps the code out of the inbox preview line', async () => {
    const html = await render(
      <VerificationCodeEmail code="12345678" purpose="sign-in" expiresInMinutes={5} />,
    );

    // React Email renders <Preview> as the hidden block marked data-skip-in-text.
    const preview = /data-skip-in-text="true">([^<]*)/.exec(html)?.[1];
    expect(preview).toBe('Your sign-in code for The Culprit');
  });

  it('words each purpose for what it is', async () => {
    const signIn = await render(
      <VerificationCodeEmail code="11112222" purpose="sign-in" expiresInMinutes={5} />,
    );
    const reset = await render(
      <VerificationCodeEmail code="11112222" purpose="password-reset" expiresInMinutes={5} />,
    );

    expect(signIn).toContain('change your password');
    expect(reset).toContain('Your password reset code');
    expect(reset).toContain('Your password won&#x27;t change.');
  });
});

describe('verificationCodeSubject', () => {
  it('names the purpose and the lab', () => {
    expect(verificationCodeSubject('sign-in')).toBe('Your sign-in code — The Culprit');
    expect(verificationCodeSubject('password-reset')).toBe(
      'Your password reset code — The Culprit',
    );
    expect(verificationCodeSubject('enable-two-factor')).toBe(
      'Confirm two-step verification — The Culprit',
    );
  });
});

describe('verificationCodeText', () => {
  it('carries the code, the expiry and what to do if it was not you', () => {
    const text = verificationCodeText({
      code: '87654321',
      purpose: 'password-reset',
      expiresInMinutes: 5,
    });

    expect(text).toContain('87654321');
    expect(text).toContain('This code expires in 5 minutes.');
    expect(text).toContain("If you didn't ask to reset your password, ignore this email.");
  });

  it('uses the singular for one minute', () => {
    expect(verificationCodeText({ code: '1', purpose: 'sign-in', expiresInMinutes: 1 })).toContain(
      'expires in 1 minute.',
    );
  });
});
