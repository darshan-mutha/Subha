"use client";

import type { RefObject } from "react";
import type { Direction } from "@/lib/ideas";
import { Dots } from "./Dots";

interface CardProps {
  direction: Direction;
  current: boolean;
  busy: boolean;
  onChoose: (direction: Direction) => void;
}

/** One theme direction: mood, colours, decor/food/fun lines and a Choose button. */
function DirectionCard({ direction: d, current, busy, onChoose }: CardProps) {
  return (
    <article className={`card-inner direction${current ? " is-current" : ""}`}>
      <h4>{d.name}</h4>
      <p className={`badge ${d.fit === "fits" ? "badge-fit" : "badge-stretch"}`}>
        {d.fit === "fits" ? "Fits your budget" : "Stretches your budget"}
      </p>
      <p>{d.mood}</p>
      <Dots colors={d.colors} />
      <dl className="direction-lines small">
        {d.decor && (
          <>
            <dt>Decor</dt>
            <dd>{d.decor}</dd>
          </>
        )}
        {d.food && (
          <>
            <dt>Food</dt>
            <dd>{d.food}</dd>
          </>
        )}
        {d.fun && (
          <>
            <dt>Fun</dt>
            <dd>{d.fun}</dd>
          </>
        )}
        <dt>Signature moment</dt>
        <dd>{d.signature.title}</dd>
      </dl>
      {current ? (
        <p className="small done-text">
          <span aria-hidden="true">✓ </span>Your theme
        </p>
      ) : (
        <button
          type="button"
          className="btn btn-small"
          disabled={busy}
          onClick={() => onChoose(d)}
          aria-label={`Choose ${d.name}`}
        >
          Choose this
        </button>
      )}
    </article>
  );
}

interface Props {
  id: string;
  directions: Direction[];
  currentName: string;
  busy: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onChoose: (direction: Direction) => void;
}

/** The three theme directions Shubā sketched, with the current one marked. */
export function ThemeDirections({ id, directions, currentName, busy, headingRef, onChoose }: Props) {
  return (
    <section aria-labelledby={`${id}-dir`} className="directions-block">
      <h3 id={`${id}-dir`} ref={headingRef} tabIndex={-1} className="small-heading">
        Three directions. Choose the one that feels like you
      </h3>
      <div className="directions">
        {directions.map((d) => (
          <DirectionCard key={d.name} direction={d} current={d.name === currentName} busy={busy} onChoose={onChoose} />
        ))}
      </div>
      <p className="muted small">
        Like parts of two? Say so in the box below, e.g. “colours of the first, food of the second”.
      </p>
    </section>
  );
}
