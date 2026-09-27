// Readies a gallery photo for upload without cropping it (ADR-019). Gallery photos keep their own
// shape; the only thing that can stop one uploading is size — the upload routes cap a file at 4 MB
// (see `uploaded-photo.ts`), and a photo straight off a phone camera is often larger.
//
// So a photo that already fits is uploaded byte-for-byte as picked. One that is too large, or wider
// than any screen will ever show it, is scaled down on a canvas — same aspect ratio, every pixel of
// the frame kept — and re-encoded as JPEG.

/** Longest edge kept, in px. Larger than the gallery ever renders, even on a 2x display. */
const MAX_EDGE = 2560;
/** Re-encode above this, leaving headroom under the route's 4 MB cap. */
const MAX_BYTES = 3.5 * 1024 * 1024;

function decode(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      // Undecodable in this browser (a HEIC straight off an iPhone, everywhere but Safari).
      reject(new Error('That file could not be read as an image.'));
    };
    image.src = url;
  });
}

/** The file itself when it can be uploaded as-is, otherwise a scaled-down JPEG of the whole photo. */
export async function preparePhotoForUpload(file: File): Promise<Blob> {
  const image = await decode(file);
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  if (file.size <= MAX_BYTES && longest <= MAX_EDGE) return file;

  const ratio = Math.min(1, MAX_EDGE / longest);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * ratio);
  canvas.height = Math.round(image.naturalHeight * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the photo.');
  // JPEG has no alpha channel: fill first so a transparent PNG comes out on white, not black.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.9),
  );
  if (!blob) throw new Error('Could not process the photo.');
  return blob;
}
