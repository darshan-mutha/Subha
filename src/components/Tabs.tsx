"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

/** Accessible tabs following the WAI-ARIA tabs pattern (arrow keys, Home, End). */
export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();
  const current = Math.min(active, items.length - 1);

  function focusTab(index: number) {
    const next = (index + items.length) % items.length;
    setActive(next);
    refs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const moves: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowLeft: current - 1,
      Home: 0,
      End: items.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      focusTab(moves[event.key]);
    }
  }

  return (
    <div className="tabs">
      <div role="tablist" aria-label={label} className="tablist">
        {items.map((item, i) => (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${base}-tab-${item.id}`}
            aria-selected={i === current}
            aria-controls={`${base}-panel-${item.id}`}
            tabIndex={i === current ? 0 : -1}
            className="tab"
            onClick={() => setActive(i)}
            onKeyDown={onKeyDown}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item, i) => (
        <section
          key={item.id}
          role="tabpanel"
          id={`${base}-panel-${item.id}`}
          aria-labelledby={`${base}-tab-${item.id}`}
          hidden={i !== current}
          tabIndex={0}
          className="tabpanel"
          data-print-title={item.label}
        >
          {item.content}
        </section>
      ))}
    </div>
  );
}
