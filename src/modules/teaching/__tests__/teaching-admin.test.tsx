import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TeachingAdmin } from '../ui/teaching-admin';
import type { Course, CvEntry } from '../teaching.types';

// Covers the admin Teaching screen — the two tables, both form dialogs and the delete
// confirmation. This is the screen a logged-in admin uses, so it was previously unexercised:
// driving it through a real browser needs a session, and these tests get at the same behaviour
// without one by rendering the component directly and asserting on the requests it issues.

const refreshMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const NOW = new Date('2026-09-02T00:00:00Z');

const course: Course = {
  id: 'c1',
  code: 'CS 7420',
  title: 'Applied Cryptography',
  level: 'Postgraduate',
  term: 'Autumn 2026',
  description: 'Protocol design and key management.',
  link: null,
  sortOrder: 0,
  createdAt: NOW,
  updatedAt: NOW,
};

const entry: CvEntry = {
  id: 'e1',
  section: 'teaching_award',
  title: 'Faculty Teaching Prize',
  subtitle: 'Northgate University',
  year: '2022',
  description: null,
  sortOrder: 0,
  createdAt: NOW,
  updatedAt: NOW,
};

/**
 * Fields are targeted by their generated id, not by label text. A substring label match for
 * "Title" also hits "Subtitle", and an exact match has to contend with the required asterisk and
 * its visually-hidden "(required)" text — the ids that `FormField` threads through are stable and
 * unambiguous. Same approach the profile form's tests already use.
 */
function field(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`no field with id "${id}"`);
  return el;
}

function renderAdmin(courses: Course[], entries: CvEntry[]) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TeachingAdmin courses={courses} entries={entries} />
    </QueryClientProvider>,
  );
}

describe('TeachingAdmin', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('shows both empty states when there is nothing yet', () => {
    renderAdmin([], []);

    expect(screen.getByText('No courses yet.')).toBeInTheDocument();
    expect(screen.getByText('No entries yet.')).toBeInTheDocument();
  });

  it('lists a course with its code, level and term', () => {
    renderAdmin([course], []);

    expect(screen.getByText('Applied Cryptography')).toBeInTheDocument();
    expect(screen.getByText('CS 7420')).toBeInTheDocument();
    expect(screen.getByText('Postgraduate')).toBeInTheDocument();
    expect(screen.getByText('Autumn 2026')).toBeInTheDocument();
  });

  it('shows a CV entry under its human-readable section label, not the enum value', () => {
    renderAdmin([], [entry]);

    // Scoped to the table: the (closed) entry dialog still renders its <option> list, which
    // carries the same section labels.
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Faculty Teaching Prize')).toBeInTheDocument();
    expect(table.getByText('Teaching awards')).toBeInTheDocument();
    expect(table.queryByText('teaching_award')).not.toBeInTheDocument();
  });

  it('creates a course through the Add dialog', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true, data: course }) });
    const user = userEvent.setup();
    renderAdmin([], []);

    await user.click(screen.getByRole('button', { name: 'Add course' }));
    await user.type(field('course-title'), 'Systems Security');
    await user.type(field('course-level'), 'Undergraduate');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/teaching/courses',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body).toMatchObject({ title: 'Systems Security', level: 'Undergraduate' });
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it('edits an existing course with a PUT to its own id', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true, data: course }) });
    const user = userEvent.setup();
    renderAdmin([course], []);

    await user.click(screen.getByRole('button', { name: 'Edit course: Applied Cryptography' }));
    // The dialog prefills from the row, so the existing title is what we clear and replace.
    const title = field('course-title');
    await user.clear(title);
    await user.type(title, 'Applied Cryptography II');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/teaching/courses/c1',
        expect.objectContaining({ method: 'PUT' }),
      ),
    );
  });

  it('creates a CV entry in the section chosen from the list picker', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true, data: entry }) });
    const user = userEvent.setup();
    renderAdmin([], []);

    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    await user.selectOptions(field('cv-section'), 'teaching_role');
    await user.type(field('cv-title'), 'Module Convenor');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/teaching/entries',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body).toMatchObject({ section: 'teaching_role', title: 'Module Convenor' });
  });

  it('keeps a year range as typed rather than coercing it to a number', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true, data: entry }) });
    const user = userEvent.setup();
    renderAdmin([], []);

    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    await user.type(field('cv-title'), 'Senior Fellow');
    await user.type(field('cv-year'), '2019–2023');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.year).toBe('2019–2023');
  });

  it('deletes a course only after the confirmation is accepted', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true, data: null }) });
    const user = userEvent.setup();
    renderAdmin([course], []);

    await user.click(screen.getByRole('button', { name: 'Delete course: Applied Cryptography' }));
    expect(fetchMock).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete this course?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/teaching/courses/c1',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
  });

  it('routes a CV entry delete to the entries endpoint, not the courses one', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true, data: null }) });
    const user = userEvent.setup();
    renderAdmin([course], [entry]);

    await user.click(screen.getByRole('button', { name: 'Delete entry: Faculty Teaching Prize' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete this entry?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/teaching/entries/e1',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
  });

  it('does not delete when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    renderAdmin([course], []);

    await user.click(screen.getByRole('button', { name: 'Delete course: Applied Cryptography' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses to submit a course with no level, since it is the public grouping key', async () => {
    const user = userEvent.setup();
    renderAdmin([], []);

    await user.click(screen.getByRole('button', { name: 'Add course' }));
    await user.type(field('course-title'), 'Untitled level');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    // Client-side Zod rejects it, so nothing reaches the network.
    await waitFor(() =>
      expect(field('course-level')).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
