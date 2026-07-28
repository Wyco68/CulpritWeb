import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components';

// One shared, brandable layout for every appointment email. Content varies per transition
// (see appointment-notifier). English default; next-intl localization is a follow-up (see index.ts).

export type AppointmentEmailProps = {
  previewText: string;
  heading: string;
  intro: string;
  details: { label: string; value: string }[];
  closing?: string;
};

export function AppointmentEmail({ previewText, heading, intro, details, closing }: AppointmentEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: '#0b0b0c', color: '#e7e7ea', fontFamily: 'ui-monospace, monospace', margin: 0, padding: '24px' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', backgroundColor: '#131316', borderRadius: '8px', padding: '32px' }}>
          <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px' }}>
            {heading}
          </Heading>
          <Text style={{ fontSize: '14px', lineHeight: '22px', margin: '0 0 20px' }}>{intro}</Text>
          {details.length > 0 && (
            <Section style={{ backgroundColor: '#1c1c20', borderRadius: '6px', padding: '16px' }}>
              {details.map((d) => (
                <Text key={d.label} style={{ fontSize: '13px', lineHeight: '20px', margin: '0 0 4px' }}>
                  <strong>{d.label}:</strong> {d.value}
                </Text>
              ))}
            </Section>
          )}
          {closing && (
            <>
              <Hr style={{ borderColor: '#2a2a30', margin: '24px 0' }} />
              <Text style={{ fontSize: '12px', color: '#9a9aa2', margin: 0 }}>{closing}</Text>
            </>
          )}
        </Container>
      </Body>
    </Html>
  );
}

export default AppointmentEmail;
