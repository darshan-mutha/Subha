"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export interface NavAction {
  label: string;
  onClick: () => void;
}

interface Props {
  sections: { id: string; label: string }[];
  active: string;
  onPick: (id: string) => void;
  /** Page actions (edit, PDF, my events…) shown in the More menu. */
  actions: NavAction[];
}

/** Sections on the bar itself; everything else is under More. */
const MAIN: { id: string; label: string; icon: ReactNode }[] = [
  {
    id: "home",
    label: "Home",
    icon: <path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-6h3v6h5V9.5" />,
  },
  {
    id: "budget",
    label: "Budget",
    icon: <path d="M7 5h10M7 9h10M9 5c4 0 5 2 5 4s-2 4-5 4h-2l7 7" />,
  },
  {
    id: "timeline",
    label: "Tasks",
    icon: <path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />,
  },
  {
    id: "guests",
    label: "Guests",
    icon: (
      <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5M16 4.5a3 3 0 0 1 0 6M18 14.5c2 .6 3.3 2.4 3.5 5.5" />
    ),
  },
];

const Icon = ({ children }: { children: ReactNode }) => (
  <svg
    className="phone-nav-icon"
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

/**
 * Phones: a bar fixed to the bottom of the screen with the four sections used
 * most, and More for the rest and for page actions. Hidden on larger screens,
 * where the tabs above the plan are used instead.
 */
export function PhoneNav({ sections, active, onPick, actions }: Props) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const main = MAIN.filter((m) => sections.some((s) => s.id === m.id));
  const rest = sections.filter((s) => !MAIN.some((m) => m.id === s.id));
  const moreActive = rest.some((s) => s.id === active);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent | MouseEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        setOpen(false);
        moreRef.current?.focus();
        return;
      }
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !moreRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("mousedown", close);
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("mousedown", close);
    };
  }, [open]);

  const pick = (id: string) => {
    setOpen(false);
    onPick(id);
  };

  return (
    <nav className="phone-nav no-print" aria-label="Plan sections (phone)">
      {open && (
        <div className="phone-menu" id={menuId} ref={menuRef}>
          <p className="phone-menu-title">More sections</p>
          <ul role="list">
            {rest.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="phone-menu-item"
                  aria-current={s.id === active ? "page" : undefined}
                  onClick={() => pick(s.id)}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
          <ul role="list" className="phone-menu-actions">
            {actions.map((a) => (
              <li key={a.label}>
                <button
                  type="button"
                  className="phone-menu-item"
                  onClick={() => {
                    setOpen(false);
                    a.onClick();
                  }}
                >
                  {a.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul role="list" className="phone-nav-bar">
        {main.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className="phone-nav-item"
              aria-current={m.id === active ? "page" : undefined}
              onClick={() => pick(m.id)}
            >
              <Icon>{m.icon}</Icon>
              <span>{m.label}</span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            ref={moreRef}
            className="phone-nav-item"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            aria-current={moreActive ? "page" : undefined}
            onClick={() => setOpen((o) => !o)}
          >
            <Icon>
              <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="3" />
            </Icon>
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
