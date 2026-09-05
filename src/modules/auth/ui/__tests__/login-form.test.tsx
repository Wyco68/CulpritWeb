import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../login-form';

const pushMock = vi.fn();
const refreshMock = vi.fn();
const signInEmailMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../../auth-client', () => ({
  signIn: { email: (...args: unknown[]) => signInEmailMock(...args) },
}));

describe('LoginForm', () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    signInEmailMock.mockReset();
  });

  it('shows validation errors and never calls signIn for an empty submit', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(signInEmailMock).not.toHaveBeenCalled();
  });

  it('wires the email input to its label and validates format', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const email = screen.getByLabelText('Email', { exact: false });
    await user.type(email, 'not-an-email');
    await user.type(screen.getByLabelText('Password', { exact: false }), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(signInEmailMock).not.toHaveBeenCalled();
  });

  it('submits credentials and redirects to /admin on success', async () => {
    signInEmailMock.mockResolvedValue({ data: { user: {} }, error: null });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email', { exact: false }), 'admin@example.com');
    await user.type(screen.getByLabelText('Password', { exact: false }), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/admin'));
    expect(signInEmailMock).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: 'correct-password',
    });
    expect(refreshMock).toHaveBeenCalled();
  });

  it('surfaces the server error message without redirecting on failure', async () => {
    signInEmailMock.mockResolvedValue({
      data: null,
      error: { message: 'Invalid email or password.' },
    });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email', { exact: false }), 'admin@example.com');
    await user.type(screen.getByLabelText('Password', { exact: false }), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(pushMock).not.toHaveBeenCalled();
  });
});
