import { describe, expect, it } from 'vitest';
import { baseScale, clampOffset, cropToView, viewToCrop } from '../photo-framer';

// The 3:2 cover editor's frame, and a portrait and a landscape source photo.
const FRAME = { width: 272, height: 272 / 1.5 };
const PORTRAIT = { width: 3000, height: 4000 };
const LANDSCAPE = { width: 4000, height: 2000 };

describe('viewToCrop', () => {
  it('centres a full-width crop at zoom 1 on a portrait photo', () => {
    const crop = viewToCrop(FRAME, PORTRAIT, 1, { x: 0, y: 0 });
    expect(crop.x).toBeCloseTo(0);
    expect(crop.width).toBeCloseTo(1);
    // A 3:2 slice of a 3:4 photo is half its height, centred.
    expect(crop.height).toBeCloseTo(0.5);
    expect(crop.y).toBeCloseTo(0.25);
  });

  it('keeps the crop at the frame aspect in source pixels', () => {
    const crop = viewToCrop(FRAME, LANDSCAPE, 1.7, { x: 20, y: -10 });
    expect((crop.width * LANDSCAPE.width) / (crop.height * LANDSCAPE.height)).toBeCloseTo(1.5);
  });
});

describe('cropToView', () => {
  it('reopens a saved crop exactly where it was left', () => {
    for (const size of [PORTRAIT, LANDSCAPE]) {
      const zoom = 2.2;
      const offset = clampOffset(FRAME, size, { x: -60, y: 35 }, zoom);
      const saved = viewToCrop(FRAME, size, zoom, offset);

      const reopened = cropToView(FRAME, size, saved);
      expect(reopened.zoom).toBeCloseTo(zoom);
      expect(reopened.offset.x).toBeCloseTo(offset.x);
      expect(reopened.offset.y).toBeCloseTo(offset.y);
    }
  });

  it('never zooms out past the point where the photo stops covering the frame', () => {
    const { zoom } = cropToView(FRAME, LANDSCAPE, { x: 0, y: 0, width: 1, height: 1 });
    expect(zoom).toBe(1);
  });
});

describe('clampOffset', () => {
  it('stops the photo being dragged away from the frame', () => {
    const scale = baseScale(FRAME, PORTRAIT);
    const limitY = (PORTRAIT.height * scale - FRAME.height) / 2;
    expect(clampOffset(FRAME, PORTRAIT, { x: 500, y: 5000 }, 1)).toEqual({ x: 0, y: limitY });
  });
});
