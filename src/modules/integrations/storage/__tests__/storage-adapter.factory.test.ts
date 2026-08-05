import { describe, expect, it, vi } from 'vitest';

// getStorageAdapter() reads env.server at call time; mock it per-test so we can exercise both
// the unconfigured (Noop) and configured (real) branches without touching process.env directly.
describe('getStorageAdapter', () => {
  it('returns the Noop adapter when SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are unset', async () => {
    vi.resetModules();
    vi.doMock('@/modules/shared/lib/env.server', () => ({
      env: { SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined },
    }));

    const { getStorageAdapter, NoopStorageAdapter } = await import('../storage-adapter');
    const adapter = getStorageAdapter();

    expect(adapter).toBeInstanceOf(NoopStorageAdapter);

    vi.doUnmock('@/modules/shared/lib/env.server');
  });

  it('returns the Supabase adapter when both env vars are set', async () => {
    vi.resetModules();
    vi.doMock('@/modules/shared/lib/env.server', () => ({
      env: {
        SUPABASE_URL: 'https://project-ref.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      },
    }));

    const { getStorageAdapter, SupabaseStorageAdapter } = await import('../storage-adapter');
    const adapter = getStorageAdapter();

    expect(adapter).toBeInstanceOf(SupabaseStorageAdapter);

    vi.doUnmock('@/modules/shared/lib/env.server');
  });

  it('caches the instance across calls within the same module load', async () => {
    vi.resetModules();
    vi.doMock('@/modules/shared/lib/env.server', () => ({
      env: { SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined },
    }));

    const { getStorageAdapter } = await import('../storage-adapter');

    expect(getStorageAdapter()).toBe(getStorageAdapter());

    vi.doUnmock('@/modules/shared/lib/env.server');
  });
});
