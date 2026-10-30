"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface ViewTab<T extends string> {
  id: T;
  label: ReactNode;
  /** Extra class for this tab, e.g. "is-done" on a finished step. */
  className?: string;
}

/** The ids that link a tab to its panel. */
export const tabIds = (base: string, id: string) => ({ tab: `${base}-tab-${id}`, panel: `${base}-panel-${id}` });

/**
 * Buttons that switch between views of one section (Guest list / Replies /
 * Seating, Ask / Compare / Book), following the WAI-ARIA tabs pattern: one
 * tab stop, arrow keys, Home and End. The parent renders the open view inside
 * <TabPanel>.
 */
export function ViewTabs<T extends string>({
  base,
  label,
  items,
  current,
  onSelect,
  className,
  tabClassName,
}: {
  base: string;
  label: string;
  items: ViewTab<T>[];
  current: T;
  onSelect: (id: T) => void;
  className: string;
  tabClassName?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    items.findIndex((i) => i.id === current),
  );

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: items.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = (moves[event.key] + items.length) % items.length;
    onSelect(items[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div className={className} role="tablist" aria-label={label}>
      {items.map((item, i) => {
        const ids = tabIds(base, item.id);
        const classes = [tabClassName, item.className].filter(Boolean).join(" ");
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={ids.tab}
            aria-selected={i === index}
            // Only the open view is rendered, so only its tab points at a panel.
            aria-controls={i === index ? ids.panel : undefined}
            tabIndex={i === index ? 0 : -1}
            className={classes || undefined}
            onClick={() => onSelect(item.id)}
            onKeyDown={onKeyDown}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** The open view under <ViewTabs>, labelled by its tab. */
export function TabPanel({ base, id, children }: { base: string; id: string; children: ReactNode }) {
  const ids = tabIds(base, id);
  return (
    <div role="tabpanel" id={ids.panel} aria-labelledby={ids.tab}>
      {children}
    </div>
  );
}
