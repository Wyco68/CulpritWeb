import { describe, expect, it } from 'vitest';
import { parseYouTubeVideoId } from '../youtube-utils';

describe('parseYouTubeVideoId', () => {
  it('accepts a bare 11-character video ID', () => {
    expect(parseYouTubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('accepts a watch?v= URL', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('accepts a youtu.be short URL', () => {
    expect(parseYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('accepts an embed URL', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('accepts a youtube-nocookie.com embed URL', () => {
    expect(parseYouTubeVideoId('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
  });

  it('accepts a watch URL with extra query params', () => {
    expect(
      parseYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&list=PL123'),
    ).toBe('dQw4w9WgXcQ');
  });

  it('rejects an empty string', () => {
    expect(parseYouTubeVideoId('')).toBeNull();
  });

  it('rejects garbage input', () => {
    expect(parseYouTubeVideoId('not a url or id')).toBeNull();
  });

  it('rejects a malformed URL', () => {
    expect(parseYouTubeVideoId('https://')).toBeNull();
  });

  it('rejects a URL from an unrelated host', () => {
    expect(parseYouTubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('rejects a wrong-length ID', () => {
    expect(parseYouTubeVideoId('short')).toBeNull();
    expect(parseYouTubeVideoId('waytoolongtobevalid')).toBeNull();
  });

  it('rejects a watch URL missing the v param', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/watch?list=PL123')).toBeNull();
  });
});
