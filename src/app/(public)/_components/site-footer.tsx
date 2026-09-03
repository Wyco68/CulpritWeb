// The closing rule of every public page. Deliberately minimal: an attribution line and nothing
// else.
//
// It carries no navigation. The masthead's tab bar is the site's only wayfinding, and repeating
// those six links at the foot of the page duplicated it without adding a destination — a link
// farm in miniature. What the footer is for here is closing the page, not re-opening it.

export function SiteFooter({ fullName }: { fullName: string }) {
  const year = new Date().getFullYear();

  return (
    // No top margin: `main` already ends on its own py-24, and stacking the two left ~190px of
    // dead space above the rule that read as a rendering fault rather than as breathing room.
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-8">
        <p className="text-sm text-muted-foreground">
          <span className="tabular">{year}</span> {fullName}
        </p>
      </div>
    </footer>
  );
}
