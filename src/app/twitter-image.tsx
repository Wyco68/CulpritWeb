// Twitter/X card art — same generated brand image as Open Graph, re-exported under Next's
// `twitter-image` file convention rather than duplicating the ImageResponse markup.
export { default, size, contentType, alt } from './opengraph-image';

// Segment config has to be declared in the route file itself; a re-export isn't read.
export const revalidate = 86400;
