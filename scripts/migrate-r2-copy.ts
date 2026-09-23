// One-off: copies every object in the source R2 bucket to the client's destination R2 bucket,
// preserving keys exactly (so stored DB URLs only need a host-prefix swap — see
// migrate-r2-backfill-db.ts). Safe to re-run: an object's ETag (read for free off the source
// listing, no extra request) is compared against the destination via HEAD *before* any object
// body is ever downloaded, so a re-run of an already-copied bucket costs one HEAD per object, not
// a re-download of everything just to throw it away.
//
// Usage:
//   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET_NAME=... \
//   R2_DEST_ACCOUNT_ID=... R2_DEST_ACCESS_KEY_ID=... R2_DEST_SECRET_ACCESS_KEY=... R2_DEST_BUCKET_NAME=... \
//   npx tsx scripts/migrate-r2-copy.ts [--dry-run]
//
// Put the eight vars in a local, untracked .env.migration and `export $(cat .env.migration | xargs)`
// instead of inlining them if you'd rather not have credentials in shell history.
//
// Writes scripts/.r2-migration-manifest.json on completion — migrate-r2-backfill-db.ts reads it
// and refuses to run against a copy that reported any failures, so a missed failure here can't
// silently repoint the DB at objects that were never actually copied.

import { writeFile } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

const DRY_RUN = process.argv.includes('--dry-run');
const MANIFEST_PATH = new URL('.r2-migration-manifest.json', import.meta.url);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const source = {
  accountId: requireEnv('R2_ACCOUNT_ID'),
  accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
  secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
  bucket: requireEnv('R2_BUCKET_NAME'),
};

const dest = {
  accountId: requireEnv('R2_DEST_ACCOUNT_ID'),
  accessKeyId: requireEnv('R2_DEST_ACCESS_KEY_ID'),
  secretAccessKey: requireEnv('R2_DEST_SECRET_ACCESS_KEY'),
  bucket: requireEnv('R2_DEST_BUCKET_NAME'),
};

function client(cfg: { accountId: string; accessKeyId: string; secretAccessKey: string }) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
}

const sourceClient = client(source);
const destClient = client(dest);

async function listAllObjects(): Promise<{ key: string; etag: string | undefined }[]> {
  const items: { key: string; etag: string | undefined }[] = [];
  let continuationToken: string | undefined;
  do {
    const page = await sourceClient.send(
      new ListObjectsV2Command({
        Bucket: source.bucket,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of page.Contents ?? []) {
      if (obj.Key) items.push({ key: obj.Key, etag: obj.ETag });
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return items;
}

async function alreadyCopied(key: string, sourceEtag: string | undefined): Promise<boolean> {
  try {
    const head = await destClient.send(new HeadObjectCommand({ Bucket: dest.bucket, Key: key }));
    return sourceEtag !== undefined && head.ETag === sourceEtag;
  } catch {
    return false;
  }
}

async function copyOne(key: string, sourceEtag: string | undefined): Promise<'copied' | 'skipped'> {
  // Checked BEFORE downloading anything: on a re-run of an already-copied bucket, this is the
  // only request per object — the body is never fetched just to be discarded.
  if (await alreadyCopied(key, sourceEtag)) return 'skipped';

  if (DRY_RUN) return 'copied';

  const object = await sourceClient.send(new GetObjectCommand({ Bucket: source.bucket, Key: key }));
  await destClient.send(
    new PutObjectCommand({
      Bucket: dest.bucket,
      Key: key,
      // GetObjectCommand's Body is typed as a cross-runtime union (Readable | ReadableStream |
      // Blob) for browser compatibility; this script only ever runs under Node (tsx), where it is
      // always a Readable.
      Body: object.Body as Readable,
      ContentType: object.ContentType,
      ContentLength: object.ContentLength,
    })
  );
  return 'copied';
}

async function main() {
  console.log(`Listing objects in source bucket "${source.bucket}"...`);
  const objects = await listAllObjects();
  console.log(`Found ${objects.length} objects.${DRY_RUN ? ' (dry run — nothing will be written or downloaded)' : ''}`);

  let copied = 0;
  let skipped = 0;
  const failed: { key: string; error: string }[] = [];

  for (const [i, { key, etag }] of objects.entries()) {
    try {
      const result = await copyOne(key, etag);
      if (result === 'copied') copied++;
      else skipped++;
      process.stdout.write(`\r[${i + 1}/${objects.length}] copied=${copied} skipped=${skipped} failed=${failed.length}`);
    } catch (err) {
      failed.push({ key, error: err instanceof Error ? err.message : String(err) });
    }
  }
  console.log('');

  console.log(`\nDone. copied=${copied} skipped=${skipped} failed=${failed.length}`);
  if (failed.length > 0) {
    console.log('\nFailed keys:');
    for (const f of failed) console.log(`  ${f.key}: ${f.error}`);
  }

  if (!DRY_RUN) {
    await writeFile(
      MANIFEST_PATH,
      JSON.stringify(
        { completedAt: new Date().toISOString(), sourceBucket: source.bucket, destBucket: dest.bucket, copied, skipped, failed },
        null,
        2
      )
    );
    console.log(`\nWrote manifest: ${MANIFEST_PATH.pathname}`);
  }

  if (failed.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
