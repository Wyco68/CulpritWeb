// The closing edge of every public page: the lab's name and affiliation, and the year, above the
// certificate double rule (ADR-018). No navigation here — the masthead is the site's wayfinding.
// Everything comes from the admin-edited profile.

export function SiteFooter({
  labName,
  affiliation,
}: {
  labName: string;
  affiliation?: string | null;
}) {
  const year = new Date().getFullYear();

  return (
    // No top margin: `main` already ends on its own bottom padding.
    <footer className="rule-double">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 sm:px-10 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-balance font-serif text-xl text-foreground">{labName}</p>
          {affiliation && (
            <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
              {affiliation}
            </p>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          © <span className="tabular">{year}</span> {labName}
        </p>
      </div>
    </footer>
  );
}
