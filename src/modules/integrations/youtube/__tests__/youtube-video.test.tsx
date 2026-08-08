import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { YouTubeVideo } from '../youtube-video';

describe('YouTubeVideo', () => {
  it('renders an iframe with the privacy-enhanced embed src and accessible title for a valid ID', () => {
    render(<YouTubeVideo videoId="dQw4w9WgXcQ" title="Conference keynote recording" />);

    const iframe = screen.getByTitle('Conference keynote recording');
    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    expect(iframe).toHaveAttribute('loading', 'lazy');
  });

  it('resolves a full YouTube URL to the correct embed src', () => {
    render(
      <YouTubeVideo
        videoId="https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s"
        title="Guest lecture"
      />,
    );

    expect(screen.getByTitle('Guest lecture')).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
  });

  it('renders the empty/error state instead of an iframe for an invalid video ID', () => {
    render(<YouTubeVideo videoId="not-a-real-id" title="Broken video" />);

    expect(screen.queryByTitle('Broken video')).not.toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Video unavailable');
  });
});
