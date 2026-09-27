import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CoursesAdmin } from '../ui/courses-admin';
import { CvEntriesAdmin } from '../ui/cv-entries-admin';
import type { Course, CvEntry } from '../teaching.types';

// ADR-020: a section switched off for a member is hidden from their PUBLIC page only. In the admin
// it stays fully editable — Add, Edit and Delete all remain — and is marked, so nobody wonders why
// an entry is missing from the profile.

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const course: Course = {
  id: 'c1',
  teamMemberId: 'm1',
  code: 'CS 4235',
  title: 'Introduction to Information Security',
  level: 'Undergraduate',
  term: 'Fall 2025',
  description: null,
  link: null,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const entry: CvEntry = {
  id: 'e1',
  teamMemberId: 'm1',
  section: 'education',
  title: 'PhD, Computer Science',
  subtitle: null,
  description: null,
  year: '2019',
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

describe('CoursesAdmin', () => {
  it('stays editable while hidden, and says the courses are hidden', async () => {
    const user = userEvent.setup();
    renderWithQuery(<CoursesAdmin teamMemberId="m1" courses={[course]} hidden />);

    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(screen.getByText(/Hidden from the public profile/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add course' })).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Actions: Introduction to Information Security' }),
    );
    expect(
      screen.getByRole('menuitem', { name: 'Edit course: Introduction to Information Security' }),
    ).toBeInTheDocument();
  });

  it('marks the courses as on the profile when shown', () => {
    renderWithQuery(<CoursesAdmin teamMemberId="m1" courses={[course]} />);
    expect(screen.getByText('On profile')).toBeInTheDocument();
    expect(screen.queryByText(/Hidden from the public profile/)).not.toBeInTheDocument();
  });
});

describe('CvEntriesAdmin', () => {
  it('keeps a hidden list editable and marks only that list', async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <CvEntriesAdmin
        teamMemberId="m1"
        sections={['research_interest', 'education']}
        hiddenSections={['education']}
        entries={[entry]}
      />,
    );

    // Both lists offer Add, hidden or not.
    expect(screen.getByRole('button', { name: 'Add research interest' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add education entry' })).toBeInTheDocument();

    const row = screen.getByRole('row', { name: /PhD, Computer Science/ });
    expect(within(row).getByText('Hidden')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Actions: PhD, Computer Science' }));
    expect(
      screen.getByRole('menuitem', { name: 'Edit entry: PhD, Computer Science' }),
    ).toBeInTheDocument();
  });

  it('renders an empty hidden list too, so it can still be filled in', () => {
    renderWithQuery(
      <CvEntriesAdmin
        teamMemberId="m1"
        sections={['education']}
        hiddenSections={['education']}
        entries={[]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Add education entry' })).toBeInTheDocument();
  });
});
