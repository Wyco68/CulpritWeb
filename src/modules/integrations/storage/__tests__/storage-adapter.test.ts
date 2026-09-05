import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NoopStorageAdapter,
  PUBLIC_STORAGE_BUCKETS,
  R2StorageAdapter,
  type StorageBucket,
} from '../storage-adapter';

// env.server.ts is guarded by the `server-only` package, which throws unless the bundler resolves
// the `react-server` export condition — plain Vitest doesn't, so any module importing it must be
// mocked here (values are irrelevant to these tests: R2StorageAdapter takes its config via
// constructor args, not the env singleton).
vi.mock('@/modules/shared/lib/env.server', () => ({
  env: {
    R2_ACCOUNT_ID: undefined,
    R2_ACCESS_KEY_ID: undefined,
    R2_SECRET_ACCESS_KEY: undefined,
    R2_BUCKET_NAME: undefined,
    R2_PUBLIC_URL: undefined,
  },
}));

// Mock the AWS SDK entirely — no real network calls. Commands/getSignedUrl are imported
// dynamically inside the adapter, but vi.mock intercepts the module graph regardless.
const sendMock = vi.fn();
class FakeS3Client {
  send = sendMock;
}
// Real classes (not arrow functions): the adapter calls each of these with `new`, which throws
// for a plain arrow function and would silently turn every success path into a caught error.
const putObjectMock = vi.fn();
const deleteObjectMock = vi.fn();
const getObjectMock = vi.fn();

class FakePutObjectCommand {
  constructor(public input: unknown) {
    putObjectMock(input);
  }
}
class FakeDeleteObjectCommand {
  constructor(public input: unknown) {
    deleteObjectMock(input);
  }
}
class FakeGetObjectCommand {
  constructor(public input: unknown) {
    getObjectMock(input);
  }
}

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: FakeS3Client,
  PutObjectCommand: FakePutObjectCommand,
  DeleteObjectCommand: FakeDeleteObjectCommand,
  GetObjectCommand: FakeGetObjectCommand,
}));

const getSignedUrlMock = vi.fn();
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => getSignedUrlMock(...args),
}));

const ACCOUNT_ID = 'acct123';
const ACCESS_KEY_ID = 'access-key';
const SECRET_ACCESS_KEY = 'secret-key';
const BUCKET_NAME = 'culprit-files';
const PUBLIC_URL = 'https://pub-abc123.r2.dev';

function makeAdapter() {
  return new R2StorageAdapter(
    ACCOUNT_ID,
    ACCESS_KEY_ID,
    SECRET_ACCESS_KEY,
    BUCKET_NAME,
    PUBLIC_URL,
  );
}

describe('R2StorageAdapter', () => {
  beforeEach(() => {
    sendMock.mockReset();
    putObjectMock.mockClear();
    deleteObjectMock.mockClear();
    getObjectMock.mockClear();
    getSignedUrlMock.mockReset();
  });

  describe('upload', () => {
    it('returns ok with the path on success, keying the object under the bucket prefix', async () => {
      sendMock.mockResolvedValue({});
      const adapter = makeAdapter();

      const result = await adapter.upload('profile', 'photo.png', Buffer.from('abc'), 'image/png');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toEqual({ path: 'photo.png' });
      expect(putObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: BUCKET_NAME,
          Key: 'profile/photo.png',
          ContentType: 'image/png',
        }),
      );
    });

    it('returns err(IntegrationError) when the SDK call throws', async () => {
      sendMock.mockRejectedValue(new Error('network down'));
      const adapter = makeAdapter();

      const result = await adapter.upload('research', 'x.png', Buffer.from('abc'), 'image/png');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('integration');
    });
  });

  describe('remove', () => {
    it('returns ok(undefined) on success', async () => {
      sendMock.mockResolvedValue({});
      const adapter = makeAdapter();

      const result = await adapter.remove('documents', 'x.pdf');

      expect(result.ok).toBe(true);
      expect(deleteObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({ Bucket: BUCKET_NAME, Key: 'documents/x.pdf' }),
      );
    });

    it('returns err(IntegrationError) when the SDK call throws', async () => {
      sendMock.mockRejectedValue(new Error('network down'));
      const adapter = makeAdapter();

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

    it.each(cases)('builds the public URL for the %s category', (bucket, path) => {
      const adapter = makeAdapter();

      const url = adapter.getPublicUrl(bucket, path);

      expect(url).toBe(`${PUBLIC_URL}/${bucket}/${path}`);
    });

    it('URL-encodes each path segment', () => {
      const adapter = makeAdapter();

      const url = adapter.getPublicUrl('profile', 'my folder/my photo.png');

      expect(url).toBe(`${PUBLIC_URL}/profile/my%20folder/my%20photo.png`);
    });

    it('confirms every public category is covered by PUBLIC_STORAGE_BUCKETS', () => {
      expect(PUBLIC_STORAGE_BUCKETS).toEqual([
        'profile',
        'research',
        'publications',
        'events',
        'team',
      ]);
    });

    it('keeps `documents` out of the public list — it is signed-URL only', () => {
      expect(PUBLIC_STORAGE_BUCKETS).not.toContain('documents');
    });
  });

  describe('getSignedUrl', () => {
    it('returns ok with the signed URL on success', async () => {
      getSignedUrlMock.mockResolvedValue('https://signed.example/x.pdf');
      const adapter = makeAdapter();

      const result = await adapter.getSignedUrl('documents', 'x.pdf', 300);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toEqual({ url: 'https://signed.example/x.pdf' });
      expect(getObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({ Bucket: BUCKET_NAME, Key: 'documents/x.pdf' }),
      );
      expect(getSignedUrlMock).toHaveBeenCalledWith(
        expect.any(FakeS3Client),
        expect.anything(),
        expect.objectContaining({ expiresIn: 300 }),
      );
    });

    it('returns err(IntegrationError) when the SDK call throws', async () => {
      getSignedUrlMock.mockRejectedValue(new Error('network down'));
      const adapter = makeAdapter();

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
