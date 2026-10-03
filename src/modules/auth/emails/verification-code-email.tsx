import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

// The one email the admin app sends: an 8-digit code, for a sign-in, for confirming that two-step
// verification should be switched on, or for a password reset (ADR-022). Literal English strings —
// the site has no i18n. Inline styles only: mail clients ignore stylesheets.

export type VerificationCodePurpose = 'sign-in' | 'enable-two-factor' | 'password-reset';

export type VerificationCodeEmailProps = {
  code: string;
  purpose: VerificationCodePurpose;
  expiresInMinutes: number;
};

type PurposeCopy = {
  subject: string;
  heading: string;
  lead: string;
  notYou: string;
};

const LAB_NAME = 'The Culprit';

const COPY: Record<VerificationCodePurpose, PurposeCopy> = {
  'sign-in': {
    subject: 'Your sign-in code',
    heading: 'Your sign-in code',
    lead: `Enter this code to finish signing in to ${LAB_NAME}.`,
    notYou:
      "If you didn't just sign in, ignore this email and change your password — someone else knows it.",
  },
  'enable-two-factor': {
    subject: 'Confirm two-step verification',
    heading: 'Confirm two-step verification',
    lead: `Enter this code to turn on two-step verification for your ${LAB_NAME} account.`,
    notYou:
      "If you didn't ask to turn on two-step verification, ignore this email and change your password.",
  },
  'password-reset': {
    subject: 'Your password reset code',
    heading: 'Your password reset code',
    lead: `Enter this code to choose a new password for your ${LAB_NAME} account.`,
    notYou:
      "If you didn't ask to reset your password, ignore this email. Your password won't change.",
  },
};

/** Subject line for a code email — kept beside the template so the two can't drift. */
export function verificationCodeSubject(purpose: VerificationCodePurpose): string {
  return `${COPY[purpose].subject} — ${LAB_NAME}`;
}

function expiryLine(expiresInMinutes: number): string {
  return `This code expires in ${expiresInMinutes} ${expiresInMinutes === 1 ? 'minute' : 'minutes'}.`;
}

/** Plain-text alternative, required alongside the HTML by `SendEmailInput.text`. */
export function verificationCodeText({
  code,
  purpose,
  expiresInMinutes,
}: VerificationCodeEmailProps): string {
  const copy = COPY[purpose];
  return [
    copy.heading,
    '',
    copy.lead,
    '',
    code,
    '',
    expiryLine(expiresInMinutes),
    '',
    copy.notYou,
    '',
    `— ${LAB_NAME}`,
  ].join('\n');
}

const styles = {
  body: {
    backgroundColor: '#f6f5f2',
    fontFamily: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    margin: 0,
    padding: '32px 0',
  },
  container: {
    backgroundColor: '#ffffff',
    border: '1px solid #e4e2dc',
    borderRadius: '8px',
    margin: '0 auto',
    maxWidth: '480px',
    padding: '32px',
  },
  heading: { color: '#1c1b19', fontSize: '22px', fontWeight: 600, margin: '0 0 16px' },
  text: { color: '#3d3b36', fontSize: '15px', lineHeight: '24px', margin: '0 0 16px' },
  codeBox: {
    backgroundColor: '#f6f5f2',
    borderRadius: '6px',
    margin: '8px 0 16px',
    padding: '16px',
    textAlign: 'center' as const,
  },
  code: {
    color: '#1c1b19',
    fontFamily: "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace",
    fontSize: '34px',
    fontWeight: 700,
    letterSpacing: '6px',
    lineHeight: '40px',
    margin: 0,
  },
  muted: { color: '#6b6860', fontSize: '13px', lineHeight: '20px', margin: '0 0 8px' },
  hr: { borderColor: '#e4e2dc', margin: '24px 0 16px' },
};

export function VerificationCodeEmail({
  code,
  purpose,
  expiresInMinutes,
}: VerificationCodeEmailProps) {
  const copy = COPY[purpose];
  return (
    <Html lang="en">
      <Head />
      {/* The preview line shows in inbox lists and lock screens — so it never carries the code. */}
      <Preview>{`${copy.heading} for ${LAB_NAME}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading as="h1" style={styles.heading}>
            {copy.heading}
          </Heading>
          <Text style={styles.text}>{copy.lead}</Text>
          <Section style={styles.codeBox}>
            <Text style={styles.code}>{code}</Text>
          </Section>
          <Text style={styles.text}>{expiryLine(expiresInMinutes)}</Text>
          <Hr style={styles.hr} />
          <Text style={styles.muted}>{copy.notYou}</Text>
          <Text style={styles.muted}>{LAB_NAME}</Text>
        </Container>
      </Body>
    </Html>
  );
}
