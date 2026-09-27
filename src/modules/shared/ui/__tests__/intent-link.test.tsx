import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// Prefetch on intent, never on sight (see intent-link.tsx for the cost it avoids).

const prefetch = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ prefetch }) }));

const { IntentLink } = await import('../intent-link');

describe('IntentLink', () => {
  it('prefetches on hover and on keyboard focus, not on render', () => {
    render(<IntentLink href="/team">Team</IntentLink>);
    expect(prefetch).not.toHaveBeenCalled();

    const link = screen.getByRole('link', { name: 'Team' });
    fireEvent.pointerEnter(link);
    fireEvent.focus(link);

    expect(prefetch).toHaveBeenCalledTimes(2);
    expect(prefetch).toHaveBeenCalledWith('/team');
    expect(link).toHaveAttribute('href', '/team');
  });
});
