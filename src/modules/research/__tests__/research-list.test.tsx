import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResearchList } from '../ui/research-list';
import type { Research } from '../research.types';

// See the note in publications-list.test.tsx.

const contributor = (name: string, sortOrder: number) => ({
  id: `c${sortOrder}`,
  name,
  sortOrder,
});

const research = (overrides: Partial<Research>): Research => ({
  id: 'r1',
  title: 'Adversarial Malware Sandboxing',
  summary: 'Detecting evasive samples.',
  area: 'malware analysis',
  link: null,
  coverPhotoUrl: null,
  photoUrls: [],
  coverCrop: null,
  contributors: [],
  sortOrder: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

describe('ResearchList', () => {
  it('renders the contributors comma-joined, in the stored order', () => {
    render(
      <ResearchList
        items={[
          research({ contributors: [contributor('R. Lindqvist', 0), contributor('T. Meyer', 1)] }),
        ]}
      />,
    );

    expect(screen.getByText(/^With/)).toHaveTextContent('With R. Lindqvist, T. Meyer');
  });

  it('links a member matched by name and leaves outside contributors grey', () => {
    render(
      <ResearchList
        members={[{ id: 'm2', name: 'Kai Tanaka', citationName: null }]}
        items={[
          research({
            contributors: [contributor('Kai Tanaka', 0), contributor('M. Fernandez', 1)],
          }),
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Kai Tanaka' })).toHaveAttribute('href', '/team/m2');
    const outside = screen.getByText('M. Fernandez');
    expect(outside.closest('a')).toBeNull();
    expect(outside).toHaveClass('text-muted-foreground');
  });

  it('renders no contributor line at all when nobody is credited', () => {
    render(<ResearchList items={[research({ contributors: [] })]} />);

    expect(screen.getByText('Adversarial Malware Sandboxing')).toBeInTheDocument();
    expect(screen.queryByText(/^With/)).not.toBeInTheDocument();
  });

  it('keeps the link and the gallery for Show Details, and shows them there', async () => {
    const user = userEvent.setup();
    render(
      <ResearchList
        items={[
          research({
            summary: 'The whole write-up.',
            link: 'https://example.org/tool',
            photoUrls: ['https://r2.example/a.jpg', 'https://r2.example/b.jpg'],
          }),
        ]}
      />,
    );
    expect(screen.queryByRole('link', { name: /View Project/ })).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Show Details: Adversarial Malware Sandboxing' }),
    );

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('The whole write-up.')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /View Project/ })).toHaveAttribute(
      'href',
      'https://example.org/tool',
    );
    expect(
      within(dialog).getByRole('region', { name: /Adversarial Malware Sandboxing photo gallery/ }),
    ).toBeInTheDocument();
    expect(within(dialog).getAllByRole('img')).toHaveLength(2);
  });

  it('covers the card with the first gallery photo when there is no dedicated cover', () => {
    const { container } = render(
      <ResearchList items={[research({ photoUrls: ['https://r2.example/first.jpg'] })]} />,
    );
    const cover = container.querySelector('li img');
    expect(cover?.getAttribute('src')).toContain(
      encodeURIComponent('https://r2.example/first.jpg'),
    );
  });
});
