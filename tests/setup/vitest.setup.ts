import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// `revalidatePath`/`revalidateTag` read Next's per-request static-generation store, which only
// exists inside a real server request. Route-handler tests call the exported POST/PUT/DELETE
// functions directly, so the store is absent and the real implementation throws
// "Invariant: static generation store missing" — a test-harness artifact, not a code defect.
// Stubbed with spies (rather than no-ops) so a test that cares can assert which paths a handler
// invalidated; see modules/shared/lib/revalidate for the paths themselves.
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

// jsdom implements the <dialog> ELEMENT but not its imperative `showModal()`/`close()` methods
// (still true as of jsdom 26 — https://github.com/jsdom/jsdom/issues/3294). Real browsers have
// supported both natively since ~2022; this is a test-environment-only gap. Polyfilled here once
// for every test file rather than working around it per-component, since the shared `Dialog`
// primitive (native <dialog>-based, no Radix dependency) is used across every admin CRUD screen.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}
