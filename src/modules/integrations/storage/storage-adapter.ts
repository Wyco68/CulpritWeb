import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/modules/shared/lib/env.server';
import { logger } from '@/modules/shared/lib/logger';
import { IntegrationError } from '@/modules/shared/lib/errors';
import { err, ok, type Result } from '@/modules/shared/lib/result';

// Server-only Supabase Storage adapter. The service-role client bypasses RLS, so this module is
// the ONLY way the app talks to Supabase Storage — never import it from a client component.
// Buckets are pre-provisioned (with RLS policies) by migration; this module never creates them.

/** The five buckets provisioned by migration. Typed so callers can't typo a bucket name. */
export type StorageBucket = 'profile' | 'research' | 'publications' | 'events' | 'documents';

/** Public-read buckets — safe to build a plain HTTPS URL for. `documents` is private (signed URLs only). */
export const PUBLIC_STORAGE_BUCKETS: readonly StorageBucket[] = [
  'profile',
  'research',
  'publications',
  'events',
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

/**
 * No-op adapter for dev/test when Supabase env is unset — boots cleanly instead of crashing.
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
    logger.warn('storage_noop', { note: 'Supabase storage env unset; skipping upload', bucket, path, contentType });
    return err(new IntegrationError('Storage is not configured.'));
  }

  async remove(bucket: StorageBucket, path: string): Promise<Result<void, IntegrationError>> {
    logger.warn('storage_noop', { note: 'Supabase storage env unset; skipping remove', bucket, path });
    return err(new IntegrationError('Storage is not configured.'));
  }

  getPublicUrl(bucket: StorageBucket, path: string): string {
    logger.warn('storage_noop', {
      note: 'Supabase storage env unset; returning empty public URL',
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
      note: 'Supabase storage env unset; skipping signed URL',
      bucket,
      path,
      expiresInSeconds,
    });
    return err(new IntegrationError('Storage is not configured.'));
  }
}

/** Supabase Storage adapter backed by the service-role client (bypasses RLS). */
export class SupabaseStorageAdapter implements StorageAdapter {
  private clientPromise: Promise<SupabaseClient> | undefined;

  constructor(
    private readonly supabaseUrl: string,
    private readonly serviceRoleKey: string,
  ) {}

  // Lazily constructed + cached so the SDK only loads when Supabase is actually configured.
  private async getClient(): Promise<SupabaseClient> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const { createClient } = await import('@supabase/supabase-js');
        return createClient(this.supabaseUrl, this.serviceRoleKey, {
          auth: { persistSession: false },
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
      const client = await this.getClient();
      const { error } = await client.storage.from(bucket).upload(path, file, {
        contentType,
        upsert: true,
      });
      if (error) return err(new IntegrationError('File upload failed.', error));
      return ok({ path });
    } catch (cause) {
      return err(new IntegrationError('File upload failed.', cause));
    }
  }

  async remove(bucket: StorageBucket, path: string): Promise<Result<void, IntegrationError>> {
    try {
      const client = await this.getClient();
      const { error } = await client.storage.from(bucket).remove([path]);
      if (error) return err(new IntegrationError('File removal failed.', error));
      return ok(undefined);
    } catch (cause) {
      return err(new IntegrationError('File removal failed.', cause));
    }
  }

  getPublicUrl(bucket: StorageBucket, path: string): string {
    const encodedPath = path
      .split('/')
      .filter(Boolean)
      .map(encodeURIComponent)
      .join('/');
    return `${this.supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
  }

  async getSignedUrl(
    bucket: StorageBucket,
    path: string,
    expiresInSeconds: number,
  ): Promise<Result<{ url: string }, IntegrationError>> {
    try {
      const client = await this.getClient();
      const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
      if (error || !data) return err(new IntegrationError('Could not create a signed URL.', error));
      return ok({ url: data.signedUrl });
    } catch (cause) {
      return err(new IntegrationError('Could not create a signed URL.', cause));
    }
  }
}

let cached: StorageAdapter | undefined;

/** Factory: real Supabase adapter when configured, else a logging no-op. Cached per process. */
export function getStorageAdapter(): StorageAdapter {
  if (cached) return cached;
  cached =
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
      ? new SupabaseStorageAdapter(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
      : new NoopStorageAdapter();
  return cached;
}
