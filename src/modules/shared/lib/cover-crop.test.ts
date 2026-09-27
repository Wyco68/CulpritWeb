import { describe, expect, it } from 'vitest';
import { coverCropStyle, resolveCover } from './cover-crop';
import { coverCropSchema, parseCoverCrop } from './cover-crop.schema';

const A = 'https://r2.example/a.jpg';
const B = 'https://r2.example/b.jpg';
const COVER = 'https://r2.example/cover.jpg';
const crop = (url: string) => ({ url, x: 0.1, y: 0.2, width: 0.5, height: 0.4 });

describe('coverCropSchema', () => {
  it('accepts a rectangle inside the photo', () => {
    expect(coverCropSchema.safeParse(crop(A)).success).toBe(true);
  });

  it('rejects a rectangle that runs off the photo', () => {
    expect(coverCropSchema.safeParse({ ...crop(A), x: 0.8, width: 0.5 }).success).toBe(false);
  });

  it('rejects an empty rectangle', () => {
    expect(coverCropSchema.safeParse({ ...crop(A), width: 0 }).success).toBe(false);
  });

  it('rejects a non-http image URL', () => {
    expect(coverCropSchema.safeParse(crop('javascript:alert(1)')).success).toBe(false);
  });
});

describe('parseCoverCrop', () => {
  it('reads a malformed stored value as no crop instead of throwing', () => {
    expect(parseCoverCrop({ x: 'nope' })).toBeNull();
    expect(parseCoverCrop(null)).toBeNull();
  });
});

describe('resolveCover', () => {
  it('prefers the dedicated cover over the gallery', () => {
    expect(resolveCover({ coverPhotoUrl: COVER, photoUrls: [A], coverCrop: crop(COVER) })).toEqual({
      src: COVER,
      crop: crop(COVER),
    });
  });

  it('falls back to the first gallery photo', () => {
    expect(resolveCover({ coverPhotoUrl: null, photoUrls: [A, B], coverCrop: null })).toEqual({
      src: A,
      crop: null,
    });
  });

  it('drops a crop drawn on a different photo than the one now shown', () => {
    // The first photo was removed, so B leads the card; A's rectangle must not frame B.
    expect(resolveCover({ coverPhotoUrl: null, photoUrls: [B], coverCrop: crop(A) })).toEqual({
      src: B,
      crop: null,
    });
  });

  it('has nothing to show without any photo', () => {
    expect(resolveCover({ coverPhotoUrl: null, photoUrls: [], coverCrop: crop(A) })).toEqual({
      src: null,
      crop: null,
    });
  });
});

describe('coverCropStyle', () => {
  it('scales the image so the crop fills the frame and shifts the crop to its corner', () => {
    expect(coverCropStyle(crop(A))).toEqual({
      position: 'absolute',
      width: '200%',
      height: '250%',
      left: '-20%',
      top: '-50%',
    });
  });
});
