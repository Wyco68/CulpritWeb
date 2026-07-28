import type { ReactElement } from 'react';
import type { EmailClient } from '@/modules/integrations';
import { logger } from '@/modules/shared/lib/logger';
import type { Appointment, AppointmentEmailKind, AppointmentNotifier } from '@/modules/appointments';
import { AppointmentEmail, type AppointmentEmailProps } from './templates/appointment-email';

// Adapter implementing the appointments' AppointmentNotifier port. Owns the status→template
// mapping and copy; integrations only supplies transport. Never throws to the caller.

function formatTime(value: Date | null): string {
  return value ? value.toISOString() : 'To be confirmed';
}

function baseDetails(appointment: Appointment): { label: string; value: string }[] {
  const details = [{ label: 'Name', value: appointment.requesterName }];
  if (appointment.researchGroup) details.push({ label: 'Research group', value: appointment.researchGroup });
  details.push({ label: 'Requested time', value: formatTime(appointment.requestedTime) });
  if (appointment.calendlyEventRef) details.push({ label: 'Calendly reference', value: appointment.calendlyEventRef });
  return details;
}

type EmailContent = { subject: string; props: AppointmentEmailProps };

function contentFor(kind: AppointmentEmailKind, appointment: Appointment): EmailContent {
  const details = baseDetails(appointment);
  const cancelNote =
    'If you did not request this or need to make changes, please reply to this email.';

  switch (kind) {
    case 'received_request':
      return {
        subject: 'We received your meeting request',
        props: {
          previewText: 'Your meeting request is pending review.',
          heading: 'Request received',
          intro: 'Thank you — your meeting request has been received and is now pending review. We will email you once it is approved or declined.',
          details,
          closing: cancelNote,
        },
      };
    case 'received_direct':
      return {
        subject: 'Your meeting is booked',
        props: {
          previewText: 'Your Calendly booking is confirmed.',
          heading: 'Meeting booked',
          intro: 'Your meeting has been booked directly against live availability. The details are below.',
          details,
          closing: cancelNote,
        },
      };
    case 'approved':
      return {
        subject: 'Your meeting request was approved',
        props: {
          previewText: 'Your meeting request has been approved.',
          heading: 'Request approved',
          intro: 'Good news — your meeting request has been approved. You will receive a final confirmation once the meeting is booked.',
          details,
        },
      };
    case 'declined':
      return {
        subject: 'Update on your meeting request',
        props: {
          previewText: 'Your meeting request could not be accommodated.',
          heading: 'Request declined',
          intro: 'Thank you for your interest. Unfortunately your meeting request could not be accommodated at this time.',
          details,
        },
      };
    case 'booked':
      return {
        subject: 'Your meeting is confirmed',
        props: {
          previewText: 'Your meeting is confirmed and booked.',
          heading: 'Meeting confirmed',
          intro: 'Your meeting has been booked. The details are below.',
          details,
          closing: cancelNote,
        },
      };
    case 'cancelled':
      return {
        subject: 'Your meeting was cancelled',
        props: {
          previewText: 'Your meeting has been cancelled.',
          heading: 'Meeting cancelled',
          intro: 'Your meeting has been cancelled. If this was unexpected, please reply to this email.',
          details: appointment.cancelReason
            ? [...details, { label: 'Reason', value: appointment.cancelReason }]
            : details,
        },
      };
  }
}

function toPlainText(props: AppointmentEmailProps): string {
  const lines = [props.heading, '', props.intro, ''];
  for (const d of props.details) lines.push(`${d.label}: ${d.value}`);
  if (props.closing) lines.push('', props.closing);
  return lines.join('\n');
}

/** Build the notifier adapter around any EmailClient (Resend in prod, no-op in dev/test). */
export function createAppointmentNotifier(emailClient: EmailClient): AppointmentNotifier {
  return {
    async sendAppointmentEmail(kind, appointment) {
      const { subject, props } = contentFor(kind, appointment);
      const result = await emailClient.send({
        to: appointment.requesterEmail,
        subject,
        react: AppointmentEmail(props) as ReactElement,
        text: toPlainText(props),
      });
      if (!result.ok) {
        logger.error('appointment_email_send_failed', { kind, appointmentId: appointment.id });
      }
    },
  };
}
