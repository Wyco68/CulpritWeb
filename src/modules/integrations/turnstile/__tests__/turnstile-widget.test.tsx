import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

const apiSendMock = vi.fn();

// The Cloudflare script never loads in jsdom; `window.turnstile` below stands in for it.
vi.mock('next/script', () => ({ default: () => null }));
vi.mock('@/modules/shared/lib/api-client', () => ({
  apiSend: (...args: unknown[]) => apiSendMock(...args),
}));
vi.mock('@/modules/shared/lib/env', () => ({
  publicEnv: { turnstileSiteKey: 'site-key', appUrl: '', calendlyUrl: '' },
}));

type Options = {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback'?: () => void;
};

const renderMock = vi.fn<(container: HTMLElement, options: Options) => string>();
const removeMock = vi.fn<(widgetId: string) => void>();

function lastOptions(): Options {
  return renderMock.mock.calls.at(-1)![1];
}

beforeEach(() => {
  let id = 0;
  renderMock.mockReset().mockImplementation(() => `widget-${++id}`);
  removeMock.mockReset();
  apiSendMock.mockReset();
  window.turnstile = { render: renderMock, remove: removeMock };
});

afterEach(() => {
  delete window.turnstile;
});

describe('TurnstileWidget', () => {
  it('renders once with the site key and hands each token to the caller', async () => {
    const { TurnstileWidget } = await import('../turnstile-widget');
    const onToken = vi.fn();
    const onExpire = vi.fn();
    render(<TurnstileWidget siteKey="site-key" onToken={onToken} onExpire={onExpire} />);

    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(lastOptions().sitekey).toBe('site-key');
    act(() => lastOptions().callback('token-1'));
    expect(onToken).toHaveBeenCalledWith('token-1');
    act(() => lastOptions()['expired-callback']?.());
    expect(onExpire).toHaveBeenCalled();
  });

  it('removes the widget on unmount, so a new key starts a fresh challenge', async () => {
    const { TurnstileWidget } = await import('../turnstile-widget');
    const { rerender, unmount } = render(
      <TurnstileWidget key={1} siteKey="site-key" onToken={vi.fn()} />,
    );
    rerender(<TurnstileWidget key={2} siteKey="site-key" onToken={vi.fn()} />);

    expect(removeMock).toHaveBeenCalledWith('widget-1');
    expect(renderMock).toHaveBeenCalledTimes(2);
    unmount();
    expect(removeMock).toHaveBeenCalledWith('widget-2');
  });
});

describe('TurnstileChallenge (the Calendly gate) on top of the widget', () => {
  it('verifies the token with the server before revealing', async () => {
    apiSendMock.mockResolvedValue({ ok: true });
    const { TurnstileChallenge } = await import('../turnstile-challenge');
    const onVerified = vi.fn();
    render(<TurnstileChallenge onVerified={onVerified} />);

    act(() => lastOptions().callback('token-1'));

    await waitFor(() => expect(onVerified).toHaveBeenCalled());
    expect(apiSendMock).toHaveBeenCalledWith('POST', '/api/turnstile/verify', { token: 'token-1' });
  });

  it('reports a rejected token', async () => {
    apiSendMock.mockRejectedValue(new Error('rejected'));
    const { TurnstileChallenge } = await import('../turnstile-challenge');
    const onVerified = vi.fn();
    render(<TurnstileChallenge onVerified={onVerified} />);

    act(() => lastOptions().callback('token-1'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Verification failed.');
    expect(onVerified).not.toHaveBeenCalled();
  });
});
