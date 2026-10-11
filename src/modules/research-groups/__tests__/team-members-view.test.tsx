import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { TeamMembersView } from '../ui/team-members-view';
import type { TeamMember } from '../team-member.types';

const professors = { id: 't-p', name: 'Professors', sortOrder: 1 };
const research = { id: 't-r', name: 'Research Team', sortOrder: 2 };
const dev = { id: 't-d', name: 'Development Team', sortOrder: 3 };

const member = (overrides: Partial<TeamMember>): TeamMember => ({
  id: 'm1',
  name: 'Kai Tanaka',
  citationName: null,
  role: 'PhD student',
  affiliation: null,
  bio: null,
  photoUrl: null,
  team: research,
  hiddenSections: [],
  isDirector: false,
  sortOrder: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

const director = member({
  id: 'd1',
  name: 'Jutarat Jaimunk',
  role: 'Professor',
  affiliation: 'Chiang Mai University',
  bio: 'Works on privacy by design.',
  team: null,
  isDirector: true,
});
const everyone = [
  director,
  member({ id: 'p1', name: 'Ana Ferreira', role: 'Professor', team: professors }),
  member({ id: 'r1', name: 'Kai Tanaka' }),
  member({ id: 'e1', name: 'Sam Rowe', role: 'Engineer', team: dev }),
];

describe('TeamMembersView', () => {
  it('features the director first, then one labelled section per team in the admin order', () => {
    // Deliberately out of order: the display order comes from the teams' positions.
    render(<TeamMembersView members={[...everyone].reverse()} />);

    const lead = screen.getByRole('region', { name: 'Jutarat Jaimunk' });
    expect(within(lead).getByText('Lab Director · Professor')).toBeInTheDocument();
    expect(within(lead).getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/team/d1');

    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Jutarat Jaimunk',
      'Professors',
      'Research Team',
      'Development Team',
    ]);
    // Each grid is named by its heading, so the teams survive being read region by region.
    expect(
      within(screen.getByRole('list', { name: 'Development Team' })).getByRole('link'),
    ).toHaveAttribute('href', '/team/e1');
  });

  it("puts the director's external links on their card, opening in a new tab", () => {
    render(
      <TeamMembersView
        members={everyone}
        directorLinks={[
          {
            id: 'l1',
            label: 'Google Scholar',
            url: 'https://scholar.google.com/citations?user=x',
            sortOrder: 0,
          },
        ]}
      />,
    );

    const lead = screen.getByRole('region', { name: 'Jutarat Jaimunk' });
    const scholar = within(lead).getByRole('link', { name: /Google Scholar/ });
    expect(scholar).toHaveAttribute('href', 'https://scholar.google.com/citations?user=x');
    expect(scholar).toHaveAttribute('target', '_blank');
    expect(scholar).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('drops teams with nobody in them', () => {
    render(<TeamMembersView members={[director, everyone[3]!]} />);

    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Jutarat Jaimunk',
      'Development Team',
    ]);
  });

  it('lists members with no team last', () => {
    render(
      <TeamMembersView
        members={[member({ id: 'x', name: 'No Team', team: null }), everyone[2]!]}
      />,
    );

    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Research Team',
      'Other members',
    ]);
  });
});
