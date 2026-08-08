import { describe, expect, it, vi } from 'vitest';

// getStorageAdapter() reads env.server at call time; mock it per-test so we can exercise both
// the unconfigured (Noop) and configured (real) branches without touching process.env directly.
describe('getStorageAdapter', () => {
  it('returns the Noop adapter when R2 env is unset', async () => {
    vi.resetModules();
    vi.doMock('@/modules/shared/lib/env.server', () => ({
      env: {
        R2_ACCOUNT_ID: undefined,
        R2_ACCESS_KEY_ID: undefined,
        R2_SECRET_ACCESS_KEY: undefined,
        R2_BUCKET_NAME: undefined,
        R2_PUBLIC_URL: undefined,
      },
    }));

    const { getStorageAdapter, NoopStorageAdapter } = await import('../storage-adapter');
    const adapter = getStorageAdapter();

    expect(adapter).toBeInstanceOf(NoopStorageAdapter);

    vi.doUnmock('@/modules/shared/lib/env.server');
  });

  it('returns the Noop adapter when only some R2 env vars are set', async () => {
    vi.resetModules();
    vi.doMock('@/modules/shared/lib/env.server', () => ({
      env: {
        R2_ACCOUNT_ID: 'acct123',
        R2_ACCESS_KEY_ID: 'access-key',
        R2_SECRET_ACCESS_KEY: undefined,
        R2_BUCKET_NAME: 'culprit-files',
        R2_PUBLIC_URL: 'https://pub-abc123.r2.dev',
      },
    }));

    const { getStorageAdapter, NoopStorageAdapter } = await import('../storage-adapter');
    const adapter = getStorageAdapter();

    expect(adapter).toBeInstanceOf(NoopStorageAdapter);

    vi.doUnmock('@/modules/shared/lib/env.server');
  });

  it('returns the R2 adapter when every env var is set', async () => {
    vi.resetModules();
    vi.doMock('@/modules/shared/lib/env.server', () => ({
      env: {
        R2_ACCOUNT_ID: 'acct123',
        R2_ACCESS_KEY_ID: 'access-key',
        R2_SECRET_ACCESS_KEY: 'secret-key',
        R2_BUCKET_NAME: 'culprit-files',
        R2_PUBLIC_URL: 'https://pub-abc123.r2.dev',
      },
    }));

    const { getStorageAdapter, R2StorageAdapter } = await import('../storage-adapter');
    const adapter = getStorageAdapter();

    expect(adapter).toBeInstanceOf(R2StorageAdapter);

    vi.doUnmock('@/modules/shared/lib/env.server');
  });

  it('caches the instance across calls within the same module load', async () => {
    vi.resetModules();
    vi.doMock('@/modules/shared/lib/env.server', () => ({
      env: {
        R2_ACCOUNT_ID: undefined,
        R2_ACCESS_KEY_ID: undefined,
        R2_SECRET_ACCESS_KEY: undefined,
        R2_BUCKET_NAME: undefined,
        R2_PUBLIC_URL: undefined,
      },
    }));

    const { getStorageAdapter } = await import('../storage-adapter');

    expect(getStorageAdapter()).toBe(getStorageAdapter());

    vi.doUnmock('@/modules/shared/lib/env.server');
  });
});
