'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { cn } from '@/modules/shared/lib/utils';
import { Button } from './button';

// The one per-row action control for every admin table: a single "more" button opening a menu.
// Everyday actions sit at the top; destructive ones are separated below a rule, so Delete is never
// one stray click away from Edit the way two adjacent icon buttons were.
//
// Rendered into a portal with fixed positioning: admin tables live inside an `overflow-hidden`
// panel and an `overflow-x-auto` scroller, and an absolutely positioned menu would be clipped by
// both. Follows the WAI-ARIA menu button pattern — Enter/Space/ArrowDown open it on the first item,
// arrows and Home/End move, Escape closes and returns focus to the button.

export type RowAction = {
  label: string;
  /** Accessible name when the visible label alone doesn't say which record ("Edit" → "Edit: X"). */
  ariaLabel?: string;
  icon: LucideIcon;
  destructive?: boolean;
} & ({ onSelect: () => void; href?: never } | { href: string; onSelect?: never });

const MENU_WIDTH = 208;

export function RowActionsMenu({ label, actions }: { label: string; actions: RowAction[] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const regular = actions.filter((action) => !action.destructive);
  const destructive = actions.filter((action) => action.destructive);

  function items() {
    return Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  }

  function close(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  // Positioned before paint so the menu never flashes at the top-left corner. Opens below the
  // button, right-aligned to it, and flips above when there is no room underneath.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const height = menuRef.current?.offsetHeight ?? 0;
    const below = rect.bottom + 4;
    const top = below + height > window.innerHeight ? Math.max(8, rect.top - height - 4) : below;
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    setPosition({ top, left });
    items()[0]?.focus();
  }, [open]);

  // A fixed menu would drift away from its row on scroll, so it closes instead; a click anywhere
  // else closes it too.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onScroll = () => close(false);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  function onMenuKeyDown(event: React.KeyboardEvent) {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const move = (next: number) => {
      event.preventDefault();
      list[(next + list.length) % list.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(list.length - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') close(false);
  }

  const itemClassName = (action: RowAction) =>
    cn(
      'flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm outline-none transition-colors duration-150',
      action.destructive
        ? 'text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10'
        : 'text-foreground hover:bg-muted focus-visible:bg-muted',
    );

  function renderItem(action: RowAction) {
    const content = (
      <>
        <action.icon className="size-4 shrink-0" aria-hidden="true" />
        {action.label}
      </>
    );
    if (action.href) {
      return (
        <Link
          key={action.label}
          href={action.href}
          role="menuitem"
          tabIndex={-1}
          aria-label={action.ariaLabel}
          className={itemClassName(action)}
          onClick={() => close(false)}
        >
          {content}
        </Link>
      );
    }
    return (
      <button
        key={action.label}
        type="button"
        role="menuitem"
        tabIndex={-1}
        aria-label={action.ariaLabel}
        className={itemClassName(action)}
        onClick={() => {
          close(false);
          action.onSelect?.();
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex justify-end">
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </Button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKeyDown}
            style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
            className="menu-enter fixed z-50 rounded-md border border-border-strong bg-surface p-1 shadow-raised"
          >
            {regular.map(renderItem)}
            {regular.length > 0 && destructive.length > 0 && (
              <div role="separator" className="my-1 h-px bg-border" />
            )}
            {destructive.map(renderItem)}
          </div>,
          document.body,
        )}
    </div>
  );
}
