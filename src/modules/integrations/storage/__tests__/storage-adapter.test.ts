import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NoopStorageAdapter,
  PUBLIC_STORAGE_BUCKETS,
  SupabaseStorageAdapter,
  type StorageBucket,
} from '../storage-adapter';

// env.server.ts is guarded by the `server-only` package, which throws unless the bundler resolves
// the `react-server` export condition — plain Vitest doesn't, so any module importing it must be
// mocked here (values are irrelevant to these tests: SupabaseStorageAdapter takes its URL/key via
// constructor args, not the env singleton).
vi.mock('@/modules/shared/lib/env.server', () => ({
  env: { SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined },
}));

// Mock the Supabase SDK entirely — no real network calls. `createClient` is imported dynamically
// inside the adapter, but vi.mock intercepts the module graph regardless of import style.
const uploadMock = vi.fn();
const removeMock = vi.fn();
const createSignedUrlMock = vi.fn();
const fromMock = vi.fn(() => ({
  upload: uploadMock,
  remove: removeMock,
  createSignedUrl: createSignedUrlMock,
}));
const createClientMock = vi.fn((...args: unknown[]) => {
  void args;
  return { storage: { from: fromMock } };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const SUPABASE_URL = 'https://project-ref.supabase.co';

describe('SupabaseStorageAdapter', () => {
  beforeEach(() => {
    uploadMock.mockReset();
    removeMock.mockReset();
    createSignedUrlMock.mockReset();
    fromMock.mockClear();
    createClientMock.mockClear();
  });

  describe('upload', () => {
    it('returns ok with the path on success, using upsert semantics', async () => {
      uploadMock.mockResolvedValue({ data: { path: 'photo.png' }, error: null });
      const adapter = new SupabaseStorageAdapter(SUPABASE_URL, 'service-role-key');

      const result = await adapter.upload('profile', 'photo.png', Buffer.from('abc'), 'image/png');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toEqual({ path: 'photo.png' });
      expect(fromMock).toHaveBeenCalledWith('profile');
      expect(uploadMock).toHaveBeenCalledWith(
        'photo.png',
        expect.any(Buffer),
        expect.objectContaining({ contentType: 'image/png', upsert: true }),
      );
    });

    it('returns err(IntegrationError) when the SDK reports an error', async () => {
      uploadMock.mockResolvedValue({ data: null, error: new Error('bucket not found') });
      const adapter = new SupabaseStorageAdapter(SUPABASE_URL, 'service-role-key');

      const result = await adapter.upload('research', 'x.png', Buffer.from('abc'), 'image/png');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('integration');
    });

    it('returns err(IntegrationError) when the SDK call throws', async () => {
      uploadMock.mockRejectedValue(new Error('network down'));
      const adapter = new SupabaseStorageAdapter(SUPABASE_URL, 'service-role-key');

      const result = await adapter.upload('publications', 'x.png', Buffer.from('abc'), 'image/png');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('integration');
    });
  });

  describe('remove', () => {
    it('returns ok(undefined) on success', async () => {
      removeMock.mockResolvedValue({ data: [{ name: 'x.pdf' }], error: null });
      const adapter = new SupabaseStorageAdapter(SUPABASE_URL, 'service-role-key');

      const result = await adapter.remove('documents', 'x.pdf');

      expect(result.ok).toBe(true);
      expect(fromMock).toHaveBeenCalledWith('documents');
      expect(removeMock).toHaveBeenCalledWith(['x.pdf']);
    });

    it('returns err(IntegrationError) when the SDK reports an error', async () => {
      removeMock.mockResolvedValue({ data: null, error: new Error('not found') });
      const adapter = new SupabaseStorageAdapter(SUPABASE_URL, 'service-role-key');

      const result = await adapter.remove('events', 'missing.png');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('integration');
    });

    it('returns err(IntegrationError) when the SDK call throws', async () => {
      removeMock.mockRejectedValue(new Error('network down'));
      const adapter = new SupabaseStorageAdapter(SUPABASE_URL, 'service-role-key');

      const result = await adapter.remove('events', 'missing.png');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('integration');
    });
  });

  describe('getPublicUrl', () => {
    const cases: [StorageBucket, string][] = [
      ['profile', 'headshot.jpg'],
      ['research', 'diagram.png'],
      ['publications', 'cover.png'],
      ['events', 'conference.jpg'],
    ];

    it.each(cases)('builds the public URL for the %s bucket', (bucket, path) => {
      const adapter = new SupabaseStorageAdapter(SUPABASE_URL, 'service-role-key');

      const url = adapter.getPublicUrl(bucket, path);

      expect(url).toBe(`${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`);
    });

    it('URL-encodes each path segment', () => {
      const adapter = new SupabaseStorageAdapter(SUPABASE_URL, 'service-role-key');

      const url = adapter.getPublicUrl('profile', 'my folder/my photo.png');

      expect(url).toBe(`${SUPABASE_URL}/storage/v1/object/public/profile/my%20folder/my%20photo.png`);
    });

    it('confirms all four public buckets are covered by PUBLIC_STORAGE_BUCKETS', () => {
      expect(PUBLIC_STORAGE_BUCKETS).toEqual(['profile', 'research', 'publications', 'events']);
    });
  });

  describe('getSignedUrl', () => {
    it('returns ok with the signed URL on success', async () => {
      createSignedUrlMock.mockResolvedValue({ data: { signedUrl: 'https://signed.example/x.pdf' }, error: null });
      const adapter = new SupabaseStorageAdapter(SUPABASE_URL, 'service-role-key');

      const result = await adapter.getSignedUrl('documents', 'x.pdf', 300);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toEqual({ url: 'https://signed.example/x.pdf' });
      expect(createSignedUrlMock).toHaveBeenCalledWith('x.pdf', 300);
    });

    it('returns err(IntegrationError) when the SDK reports an error', async () => {
      createSignedUrlMock.mockResolvedValue({ data: null, error: new Error('object not found') });
      const adapter = new SupabaseStorageAdapter(SUPABASE_URL, 'service-role-key');

      const result = await adapter.getSignedUrl('documents', 'missing.pdf', 300);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('integration');
    });

    it('returns err(IntegrationError) when the SDK call throws', async () => {
      createSignedUrlMock.mockRejectedValue(new Error('network down'));
      const adapter = new SupabaseStorageAdapter(SUPABASE_URL, 'service-role-key');

      const result = await adapter.getSignedUrl('documents', 'x.pdf', 300);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('integration');
    });
  });
});

describe('NoopStorageAdapter', () => {
  it('returns err(IntegrationError) for upload without throwing', async () => {
    const adapter = new NoopStorageAdapter();
    const result = await adapter.upload('profile', 'x.png', Buffer.from('abc'), 'image/png');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('integration');
  });

  it('returns err(IntegrationError) for remove without throwing', async () => {
    const adapter = new NoopStorageAdapter();
    const result = await adapter.remove('profile', 'x.png');
    expect(result.ok).toBe(false);
  });

  it('returns an empty string for getPublicUrl without throwing', () => {
    const adapter = new NoopStorageAdapter();
    expect(adapter.getPublicUrl('profile', 'x.png')).toBe('');
  });

  it('returns err(IntegrationError) for getSignedUrl without throwing', async () => {
    const adapter = new NoopStorageAdapter();
    const result = await adapter.getSignedUrl('documents', 'x.pdf', 300);
    expect(result.ok).toBe(false);
  });
});
