import type {
  CalendlyBookingLink,
  CalendlyLinkStore,
  LinkCancelledResult,
  LinkCreatedResult,
} from '@/modules/integrations';
import type { AppointmentService } from './appointment.service';
import type { AppointmentRef, CalendlyLinkRepository } from './calendly-link.repository';

// Adapter that satisfies the calendly service's CalendlyLinkStore port using appointment-domain
// primitives. Creation is a legal CREATE transition (persisted by the repository); cancellation is
// routed through the appointment state machine (cancelByAdmin) so the domain stays the SOLE
// authority on status. Both operations are idempotent (keyed by the unique invitee uri).
export class AppointmentCalendlyLinkStore implements CalendlyLinkStore {
  constructor(
    private readonly repository: CalendlyLinkRepository,
    private readonly appointmentService: AppointmentService,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async recordBookingCreated(link: CalendlyBookingLink): Promise<LinkCreatedResult> {
    const existing = await this.repository.findByInviteeUri(link.inviteeUri);
    if (existing) return { appointmentId: existing.id, created: false }; // idempotent replay

    const created = await this.repository.createFromCalendly({
      inviteeUri: link.inviteeUri,
      eventUri: link.eventUri,
      eventTypeUri: link.eventTypeUri,
      requesterName: link.requesterName,
      requesterEmail: link.requesterEmail,
      scheduledAt: link.scheduledAt,
      meetingUrl: link.meetingUrl,
    });
    return { appointmentId: created.id, created: true };
  }

  async recordBookingCancelled(inviteeUri: string, reason: string | null): Promise<LinkCancelledResult> {
    const existing = await this.repository.findByInviteeUri(inviteeUri);
    return this.applyCancellation(existing, reason, 'calendly:webhook');
  }

  async reconcileCancellation(eventUri: string, reason: string | null): Promise<LinkCancelledResult> {
    const existing = await this.repository.findByEventUri(eventUri);
    return this.applyCancellation(existing, reason, 'calendly:admin-cancel');
  }

  /** Shared cancel-transition logic for both the webhook and admin-cancel-triggered paths. */
  private async applyCancellation(
    existing: AppointmentRef | null,
    reason: string | null,
    actor: string,
  ): Promise<LinkCancelledResult> {
    if (!existing) return { appointmentId: null, cancelled: false };
    // Already terminal → idempotent no-op.
    if (existing.status === 'cancelled' || existing.status === 'declined') {
      return { appointmentId: existing.id, cancelled: false };
    }

    const result = await this.appointmentService.cancelByAdmin(
      existing.id,
      { reason: reason ?? 'Cancelled via Calendly.' },
      actor,
    );
    // Illegal transition (e.g. pending) → treat as no-op rather than corrupt state.
    if (!result.ok) return { appointmentId: existing.id, cancelled: false };

    await this.repository.stampCancelledAt(existing.id, this.clock());
    return { appointmentId: existing.id, cancelled: true };
  }
}
