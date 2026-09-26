// The height of the site header while it is pinned (sticky or fixed, from `lg` up), or 0 when it scrolls away with
// the page (below `lg`). Scroll-position logic that decides "which section is current" measures
// from the bottom of this bar, not from the top of the window, or it would count a section as
// read while it is still hidden underneath the header.
//
// Read from the element itself rather than from `--header-h`, so it is right even if the header's
// content ever outgrows its nominal height.
export function stickyHeaderHeight(): number {
  const header = document.querySelector<HTMLElement>('[data-sticky-header]');
  const position = header ? getComputedStyle(header).position : '';
  if (!header || (position !== 'sticky' && position !== 'fixed')) return 0;
  return header.getBoundingClientRect().height;
}
