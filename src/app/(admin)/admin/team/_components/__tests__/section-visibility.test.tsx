import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SectionVisibility } from '../section-visibility';

// ADR-020: each switch saves this member's hidden sections on its own, moving at once and moving
// back if the save fails.

const apiSend = vi.hoisted(() => vi.fn());
vi.mock('@/modules/shared/lib/api-client', () => ({
  apiSend: (...args: unknown[]) => apiSend(...args),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const member = { id: 'm1', name: 'Sam Rowe', hiddenSections: ['courses' as const] };

beforeEach(() => {
  apiSend.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
});

describe('SectionVisibility', () => {
  it('shows one switch per section, reflecting what is hidden', () => {
    render(<SectionVisibility member={member} />);
    expect(screen.getAllByRole('switch')).toHaveLength(11);
    expect(screen.getByRole('switch', { name: /^Courses/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('switch', { name: /^Publications/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('hides a section by saving the new list for this member', async () => {
    apiSend.mockResolvedValue({});
    const user = userEvent.setup();
    render(<SectionVisibility member={member} />);

    await user.click(screen.getByRole('switch', { name: /^Publications/ }));

    expect(apiSend).toHaveBeenCalledWith('PUT', '/api/admin/team-members/m1', {
      hiddenSections: ['courses', 'publications'],
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(screen.getByRole('switch', { name: /^Publications/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('shows a section again, and flips back when the save fails', async () => {
    apiSend.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    render(<SectionVisibility member={member} />);

    await user.click(screen.getByRole('switch', { name: /^Courses/ }));

    expect(apiSend).toHaveBeenCalledWith('PUT', '/api/admin/team-members/m1', {
      hiddenSections: [],
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole('switch', { name: /^Courses/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});
