import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GalleryField } from '../gallery-field';
import { CoverField } from '../cover-field';

// The admin side of ADR-019: gallery photos upload whole with no framing step, and the card cover
// is framed by a stored rectangle rather than by re-uploading.

const apiRequest = vi.fn();
vi.mock('@/modules/shared/lib/api-client', () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));
// Decoding and downscaling need a real canvas; what matters here is that the file reaches the
// route untouched in shape, so the preparation step passes it through.
vi.mock('@/modules/shared/lib/prepare-photo', () => ({
  preparePhotoForUpload: async (file: File) => file,
}));
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

const photo = (name: string) => new File(['x'], name, { type: 'image/jpeg' });

/** jsdom never decodes images; this one "loads" as a 4000×3000 photo on the next tick. */
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 4000;
  naturalHeight = 3000;
  set src(_value: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}

beforeEach(() => {
  apiRequest.mockReset();
  toastError.mockReset();
});

describe('GalleryField', () => {
  it('uploads every picked photo whole, in order, without a framing step', async () => {
    const user = userEvent.setup();
    apiRequest
      .mockResolvedValueOnce({ url: 'https://r2.example/1.jpg' })
      .mockResolvedValueOnce({ url: 'https://r2.example/2.jpg' });
    const onChange = vi.fn();
    render(<GalleryField urls={[]} onChange={onChange} endpoint="/api/admin/events/photo" />);

    await user.upload(screen.getByLabelText('Photos'), [photo('a.jpg'), photo('b.jpg')]);

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith([
        'https://r2.example/1.jpg',
        'https://r2.example/2.jpg',
      ]),
    );
    expect(screen.queryByText('Frame the photo')).not.toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledTimes(2);
    const [endpoint, init] = apiRequest.mock.calls[0];
    expect(endpoint).toBe('/api/admin/events/photo');
    expect((init.body as FormData).get('file')).toBeInstanceOf(File);
  });

  it('keeps going past a photo the server rejects, and says which one', async () => {
    const user = userEvent.setup();
    apiRequest
      .mockRejectedValueOnce(new Error('Photo is too large (4 MB max).'))
      .mockResolvedValueOnce({ url: 'https://r2.example/2.jpg' });
    const onChange = vi.fn();
    render(<GalleryField urls={[]} onChange={onChange} endpoint="/api/admin/events/photo" />);

    await user.upload(screen.getByLabelText('Photos'), [photo('huge.jpg'), photo('ok.jpg')]);

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(['https://r2.example/2.jpg']));
    expect(toastError).toHaveBeenCalledWith('huge.jpg: Photo is too large (4 MB max).');
  });

  it('uploads only as many as there is room for', async () => {
    const user = userEvent.setup();
    apiRequest.mockResolvedValue({ url: 'https://r2.example/new.jpg' });
    render(
      <GalleryField
        urls={['https://r2.example/1.jpg']}
        onChange={vi.fn()}
        endpoint="/api/admin/events/photo"
        max={2}
      />,
    );

    await user.upload(screen.getByLabelText('Photos'), [photo('a.jpg'), photo('b.jpg')]);

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
    expect(toastError).toHaveBeenCalledWith('Only the first 1 photo can be added.');
  });

  it('marks the first photo as the card cover only while there is no dedicated cover', () => {
    const { rerender } = render(
      <GalleryField
        urls={['https://r2.example/1.jpg']}
        onChange={vi.fn()}
        endpoint="/x"
        firstIsCover
      />,
    );
    expect(screen.getByText('Card cover')).toBeInTheDocument();
    rerender(<GalleryField urls={['https://r2.example/1.jpg']} onChange={vi.fn()} endpoint="/x" />);
    expect(screen.queryByText('Card cover')).not.toBeInTheDocument();
  });
});

describe('CoverField', () => {
  beforeEach(() => vi.stubGlobal('Image', FakeImage));
  afterEach(() => vi.unstubAllGlobals());

  it('falls back to the first gallery photo when there is no dedicated cover', () => {
    render(
      <CoverField
        coverPhotoUrl={null}
        coverCrop={null}
        photoUrls={['https://r2.example/1.jpg']}
        onChange={vi.fn()}
        endpoint="/x"
      />,
    );
    expect(screen.getByText(/Using the first gallery photo/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload cover/ })).toBeInTheDocument();
  });

  it('uploads a new cover uncropped, drops the old crop, and opens the crop editor', async () => {
    const user = userEvent.setup();
    apiRequest.mockResolvedValueOnce({ url: 'https://r2.example/cover.jpg' });
    const onChange = vi.fn();
    const { rerender } = render(
      <CoverField
        coverPhotoUrl={null}
        coverCrop={{ url: 'https://r2.example/1.jpg', x: 0, y: 0, width: 0.5, height: 0.5 }}
        photoUrls={['https://r2.example/1.jpg']}
        onChange={onChange}
        endpoint="/api/admin/research/photo"
      />,
    );

    await user.upload(screen.getByLabelText('Cover'), photo('cover.jpg'));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        coverPhotoUrl: 'https://r2.example/cover.jpg',
        coverCrop: null,
      }),
    );
    // The parent form feeds the new value back in.
    rerender(
      <CoverField
        coverPhotoUrl="https://r2.example/cover.jpg"
        coverCrop={null}
        photoUrls={['https://r2.example/1.jpg']}
        onChange={onChange}
        endpoint="/api/admin/research/photo"
      />,
    );
    expect(screen.getByText('Frame the card cover')).toBeInTheDocument();
  });

  it('saves the crop as a rectangle on the cover photo, and can reopen it any time', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CoverField
        coverPhotoUrl={null}
        coverCrop={null}
        photoUrls={['https://r2.example/1.jpg']}
        onChange={onChange}
        endpoint="/x"
      />,
    );

    await user.click(screen.getByRole('button', { name: /Adjust crop/ }));
    const frame = await screen.findByRole('application');
    await waitFor(() => expect(frame.querySelector('img')).not.toBeNull());
    frame.focus();
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    await user.click(screen.getByRole('button', { name: /Save crop/ }));

    const saved = onChange.mock.calls.at(-1)?.[0];
    expect(saved.coverPhotoUrl).toBeNull();
    expect(saved.coverCrop.url).toBe('https://r2.example/1.jpg');
    // A 4:3 photo in a 3:2 frame at zoom 1: the full width, and (4/3) / (3/2) = 8/9 of the height.
    expect(saved.coverCrop.width).toBeCloseTo(1);
    expect(saved.coverCrop.height).toBeCloseTo(8 / 9);
    // Back to the preview, with the editor ready to be reopened.
    expect(screen.getByRole('button', { name: /Adjust crop/ })).toBeInTheDocument();
  });

  it('removes a dedicated cover and its crop together', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CoverField
        coverPhotoUrl="https://r2.example/cover.jpg"
        coverCrop={{ url: 'https://r2.example/cover.jpg', x: 0, y: 0, width: 1, height: 0.5 }}
        photoUrls={['https://r2.example/1.jpg']}
        onChange={onChange}
        endpoint="/x"
      />,
    );

    await user.click(screen.getByRole('button', { name: /Use first photo instead/ }));

    expect(onChange).toHaveBeenCalledWith({ coverPhotoUrl: null, coverCrop: null });
  });
});
