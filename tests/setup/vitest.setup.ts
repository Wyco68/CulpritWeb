import '@testing-library/jest-dom/vitest';

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
