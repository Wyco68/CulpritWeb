import { env } from '@/modules/shared/lib/env.server';
import { logger } from '@/modules/shared/lib/logger';
import { IntegrationError } from '@/modules/shared/lib/errors';
import { err, ok, type Result } from '@/modules/shared/lib/result';

// Server-only Cloudflare R2 storage adapter (S3-compatible API). This is the ONLY way the app
// talks to object storage — never import it from a client component. One R2 bucket holds every
// category, split by a folder prefix (`<bucket>/<path>`) rather than five separate R2 buckets —
// fewer things to provision in the Cloudflare dashboard, and the app-level `StorageBucket`
// distinction is preserved either way since callers never see the physical layout.
//
// R2 was adopted over Supabase Storage (2026-08-08, see PROJECT_SPEC.md §14.1/§7): Supabase's
// free tier caps egress at 5GB/month, which becomes the site's binding bottleneck around ~650
// visitors/day; R2 never charges for egress at all. The database stays on Supabase — only files
// moved. `documents` has no separate ACL enforcement at the storage layer (R2 has no per-prefix
// policy the way Supabase RLS did) — privacy is enforced entirely by which method application
// code calls: nothing in this codebase ever calls `getPublicUrl('documents', ...)`, only
// `getSignedUrl`. Fine for a single-admin, low-traffic site; revisit if that ever changes.

/** Logical categories, mapped to folder prefixes inside the one R2 bucket. */
export type StorageBucket =
  'profile' | 'research' | 'publications' | 'events' | 'team' | 'documents';

/** Public-read categories — safe to build a plain HTTPS URL for. `documents` is private (signed URLs only). */
export const PUBLIC_STORAGE_BUCKETS: readonly StorageBucket[] = [
  'profile',
  'research',
  'publications',
  'events',
  'team',
];

export interface StorageAdapter {
  /** Upsert semantics — overwrites any existing object at the same path. */
  upload(
    bucket: StorageBucket,
    path: string,
    file: Buffer | Uint8Array,
    contentType: string,
  ): Promise<Result<{ path: string }, IntegrationError>>;
  remove(bucket: StorageBucket, path: string): Promise<Result<void, IntegrationError>>;
  /** Synchronous — only meaningful for the four public buckets. */
  getPublicUrl(bucket: StorageBucket, path: string): string;
  /** For the private `documents` bucket. */
  getSignedUrl(
    bucket: StorageBucket,
    path: string,
    expiresInSeconds: number,
  ): Promise<Result<{ url: string }, IntegrationError>>;
}

function objectKey(bucket: StorageBucket, path: string): string {
  // No caller passes user-controlled path segments today, but strip `.`/`..` regardless — an S3
  // Key is a flat string, not a filesystem path, so a segment like `..` doesn't "traverse" the way
  // it would on disk; it just becomes an attacker-chosen literal key. Blocking it here means a
  // future upload route can accept a user-supplied filename without reopening this as a review item.
  const cleanPath = path
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
    .join('/');
  return `${bucket}/${cleanPath}`;
}

/**
 * No-op adapter for dev/test when R2 env is unset — boots cleanly instead of crashing.
 * Mutating operations report "not configured" via the Result channel rather than throwing;
 * silently pretending a file was stored would corrupt whatever the caller persists next.
 */
export class NoopStorageAdapter implements StorageAdapter {
  async upload(
    bucket: StorageBucket,
    path: string,
    file: Buffer | Uint8Array,
    contentType: string,
  ): Promise<Result<{ path: string }, IntegrationError>> {
    void file;
    logger.warn('storage_noop', {
      note: 'R2 storage env unset; skipping upload',
      bucket,
      path,
      contentType,
    });
    return err(new IntegrationError('Storage is not configured.'));
  }

  async remove(bucket: StorageBucket, path: string): Promise<Result<void, IntegrationError>> {
    logger.warn('storage_noop', { note: 'R2 storage env unset; skipping remove', bucket, path });
    return err(new IntegrationError('Storage is not configured.'));
  }

  getPublicUrl(bucket: StorageBucket, path: string): string {
    logger.warn('storage_noop', {
      note: 'R2 storage env unset; returning empty public URL',
      bucket,
      path,
    });
    return '';
  }

  async getSignedUrl(
    bucket: StorageBucket,
    path: string,
    expiresInSeconds: number,
  ): Promise<Result<{ url: string }, IntegrationError>> {
    logger.warn('storage_noop', {
      note: 'R2 storage env unset; skipping signed URL',
      bucket,
      path,
      expiresInSeconds,
    });
    return err(new IntegrationError('Storage is not configured.'));
  }
}

/** Cloudflare R2 adapter — S3-compatible API via the AWS SDK, pointed at R2's endpoint. */
export class R2StorageAdapter implements StorageAdapter {
  private clientPromise: Promise<import('@aws-sdk/client-s3').S3Client> | undefined;

  constructor(
    private readonly accountId: string,
    private readonly accessKeyId: string,
    private readonly secretAccessKey: string,
    private readonly bucketName: string,
    /** Public base URL for the bucket (custom domain, or the `pub-<hash>.r2.dev` dev URL). */
    private readonly publicUrl: string,
  ) {}

  // Lazily constructed + cached so the SDK only loads when R2 is actually configured.
  private async getClient(): Promise<import('@aws-sdk/client-s3').S3Client> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const { S3Client } = await import('@aws-sdk/client-s3');
        return new S3Client({
          region: 'auto',
          endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: this.accessKeyId,
            secretAccessKey: this.secretAccessKey,
          },
        });
      })();
    }
    return this.clientPromise;
  }

  async upload(
    bucket: StorageBucket,
    path: string,
    file: Buffer | Uint8Array,
    contentType: string,
  ): Promise<Result<{ path: string }, IntegrationError>> {
    try {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const client = await this.getClient();
      await client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: objectKey(bucket, path),
          Body: file,
          ContentType: contentType,
        }),
      );
      return ok({ path });
    } catch (cause) {
      return err(new IntegrationError('File upload failed.', cause));
    }
  }

  async remove(bucket: StorageBucket, path: string): Promise<Result<void, IntegrationError>> {
    try {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const client = await this.getClient();
      await client.send(
        new DeleteObjectCommand({ Bucket: this.bucketName, Key: objectKey(bucket, path) }),
      );
      return ok(undefined);
    } catch (cause) {
      return err(new IntegrationError('File removal failed.', cause));
    }
  }

  getPublicUrl(bucket: StorageBucket, path: string): string {
    const key = objectKey(bucket, path).split('/').map(encodeURIComponent).join('/');
    return `${this.publicUrl}/${key}`;
  }

  async getSignedUrl(
    bucket: StorageBucket,
    path: string,
    expiresInSeconds: number,
  ): Promise<Result<{ url: string }, IntegrationError>> {
    try {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const client = await this.getClient();
      const url = await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: this.bucketName, Key: objectKey(bucket, path) }),
        { expiresIn: expiresInSeconds },
      );
      return ok({ url });
    } catch (cause) {
      return err(new IntegrationError('Could not create a signed URL.', cause));
    }
  }
}

let cached: StorageAdapter | undefined;

/** Factory: real R2 adapter when configured, else a logging no-op. Cached per process. */
export function getStorageAdapter(): StorageAdapter {
  if (cached) return cached;
  cached =
    env.R2_ACCOUNT_ID &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET_NAME &&
    env.R2_PUBLIC_URL
      ? new R2StorageAdapter(
          env.R2_ACCOUNT_ID,
          env.R2_ACCESS_KEY_ID,
          env.R2_SECRET_ACCESS_KEY,
          env.R2_BUCKET_NAME,
          env.R2_PUBLIC_URL,
        )
      : new NoopStorageAdapter();
  return cached;
}
