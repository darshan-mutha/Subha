"use client";

import { ideaId } from "@/lib/ideas";
import type { Idea, Plan } from "@/lib/schemas";

interface Props {
  id: string;
  signature: NonNullable<Plan["ideas"]["signature"]>;
  added: ReadonlySet<string>;
  busy: boolean;
  onAdd: (sig: Idea) => void;
}

/** The signature moment of the chosen theme, which the host can add to the plan. */
export function SignatureMoment({ id, signature, added, busy, onAdd }: Props) {
  const sig: Idea = {
    title: signature.title,
    detail: signature.detail,
    why: "",
    moment: "main",
    forFunction: "",
    cost: 0,
    effort: "help",
  };
  return (
    <section className="card-inner signature" aria-labelledby={`${id}-sig`}>
      <p className="eyebrow">Signature moment</p>
      <h3 id={`${id}-sig`}>{signature.title}</h3>
      <p>{signature.detail}</p>
      <p className="muted small">The one thing guests will talk about later.</p>
      {added.has(ideaId(sig)) ? (
        <p className="small done-text">
          <span aria-hidden="true">✓ </span>In your plan
        </p>
      ) : (
        <button type="button" className="btn btn-small" disabled={busy} onClick={() => onAdd(sig)}>
          Add to my plan
        </button>
      )}
    </section>
  );
}
