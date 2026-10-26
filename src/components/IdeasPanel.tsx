"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { formatINR } from "@/lib/budget";
import { ApiError, requestIdeas } from "@/lib/client";
import {
  EMPTY_IDEA_STATE,
  FEELINGS,
  FEELING_LABELS,
  LEANINGS,
  LEANING_LABELS,
  byMoment,
  carryChosen,
  ideaId,
  ideasContext,
  mergeIdeas,
  themeSwatches,
  tidyText,
  type Direction,
  type Feeling,
  type IdeaState,
  type IdeasRequest,
  type Leaning,
} from "@/lib/ideas";
import { EFFORT_LABELS, MOMENT_LABELS, type EventInput, type Idea, type Plan } from "@/lib/schemas";

interface Props {
  input: EventInput;
  plan: Plan;
  state: IdeaState | undefined;
  /** Saves a new plan and/or idea choices. */
  onSave: (next: { plan?: Plan; ideaState: IdeaState }) => Promise<void>;
  /** Turns an idea into a task, budget and vendor message (with What changed and Undo). */
  onAdd: (idea: Idea, ideaState: IdeaState) => Promise<void>;
}

type Job = "themes" | "ideas" | "more" | null;

const WAIT: Record<Exclude<Job, null>, string> = {
  themes: "Shubā is sketching three themes for you… about 15–25 seconds.",
  ideas: "Shubā is filling your day with ideas for this theme… about 20–30 seconds.",
  more: "Shubā is building on your idea… about 10–20 seconds.",
};

function Dots({ colors }: { colors: { name: string; hex: string }[] }) {
  if (colors.length === 0) return null;
  return (
    <ul className="swatches" aria-label="Colours">
      {colors.map((c) => (
        <li key={`${c.name}-${c.hex}`}>
          <span className="swatch" style={{ background: c.hex }} aria-hidden="true" />
          {c.name}
        </li>
      ))}
    </ul>
  );
}

/**
 * Ideas: start from the heart of the event (who it is for, how guests should
 * feel), pick one of three theme directions, then keep, skip or add ideas
 * that follow the guest's day. The host's own idea is always welcome.
 */
export function IdeasPanel({ input, plan, state = EMPTY_IDEA_STATE, onSave, onAdd }: Props) {
  const id = useId();
  const [forWhom, setForWhom] = useState(state.heart.forWhom);
  const [feelings, setFeelings] = useState<Feeling[]>(state.heart.feelings);
  const [own, setOwn] = useState(state.heart.own);
  const [leanings, setLeanings] = useState<Leaning[]>([]);
  const [ownFunction, setOwnFunction] = useState("");
  const [filter, setFilter] = useState("");
  const [job, setJob] = useState<Job>(null);
  const [error, setError] = useState("");
  const [announce, setAnnounce] = useState("");
  const [fresh, setFresh] = useState<string[]>([]);
  const [showSkipped, setShowSkipped] = useState(false);
  const directionsRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLHeadingElement>(null);

  const heart = { forWhom: tidyText(forWhom, 80), feelings, own: tidyText(own, 300) };
  const functions = plan.functions.map((f) => f.name);
  const kept = new Set(state.kept);
  const added = new Set(state.added);
  const groups = byMoment(plan.ideas.items, showSkipped ? [] : state.skipped, filter);
  const skippedCount = plan.ideas.items.filter((i) => state.skipped.includes(ideaId(i))).length;
  const colors = themeSwatches(plan.theme);

  async function ask(mode: Exclude<Job, null>, extra: Partial<IdeasRequest> = {}) {
    setJob(mode);
    setError("");
    setAnnounce(WAIT[mode]);
    try {
      const result = await requestIdeas({
        input,
        context: ideasContext(plan),
        heart,
        mode,
        direction: null,
        leanings: [],
        seed: "",
        forFunction: "",
        ...extra,
      });
      return result;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
      setAnnounce("");
      return null;
    } finally {
      setJob(null);
    }
  }

  async function showThemes() {
    const result = await ask("themes");
    if (!result || result.mode !== "themes") return;
    await onSave({ ideaState: { ...state, heart, directions: result.directions } });
    setAnnounce("Three theme ideas are ready. Choose the one that feels like you.");
    requestAnimationFrame(() => directionsRef.current?.focus());
  }

  async function choose(direction: Direction) {
    const result = await ask("ideas", { direction });
    if (!result || result.mode === "themes") return;
    const items = carryChosen(plan.ideas.items, result.items, state);
    const next: Plan = {
      ...plan,
      theme: {
        name: direction.name,
        description: direction.mood,
        colors: direction.colors.map((c) => c.name),
        swatches: direction.colors.map((c) => c.hex),
      },
      ideas: { signature: result.signature ?? direction.signature, items },
    };
    await onSave({ plan: next, ideaState: { ...state, heart, skipped: [] } });
    setFresh(result.items.map(ideaId));
    setAnnounce(`Your theme is now ${direction.name}, with ${result.items.length} ideas to match.`);
    requestAnimationFrame(() => listRef.current?.focus());
  }

  async function more(extra: Partial<IdeasRequest>, message: string) {
    const result = await ask("more", extra);
    if (!result || result.mode === "themes") return;
    const items = mergeIdeas(plan.ideas.items, result.items);
    await onSave({ plan: { ...plan, ideas: { ...plan.ideas, items } }, ideaState: { ...state, heart } });
    setFresh(result.items.map(ideaId));
    setFilter("");
    setAnnounce(`${result.items.length} new ideas ${message}. They are marked New below.`);
    requestAnimationFrame(() => listRef.current?.focus());
  }

  function submitOwn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (heart.own.length < 3 && leanings.length === 0) {
      setError("Type your idea, or pick a starting point such as Budget-friendly.");
      return;
    }
    void more({ leanings, forFunction: tidyText(ownFunction, 40) }, "built on your idea");
  }

  function toggleIn<T extends string>(list: T[], value: T, max: number): T[] {
    if (list.includes(value)) return list.filter((x) => x !== value);
    return list.length >= max ? list : [...list, value];
  }

  const save = (ideaState: IdeaState) => void onSave({ ideaState }).catch(() => undefined);

  function keep(idea: Idea) {
    const iid = ideaId(idea);
    const on = !kept.has(iid);
    save({ ...state, kept: on ? [...state.kept, iid] : state.kept.filter((x) => x !== iid) });
    setAnnounce(on ? `Kept: ${idea.title}` : `No longer kept: ${idea.title}`);
  }

  function skip(idea: Idea) {
    const iid = ideaId(idea);
    const on = !state.skipped.includes(iid);
    save({
      ...state,
      skipped: on ? [...state.skipped, iid] : state.skipped.filter((x) => x !== iid),
      kept: state.kept.filter((x) => x !== iid),
    });
    setAnnounce(on ? `Skipped: ${idea.title}` : `Brought back: ${idea.title}`);
  }

  const busy = job !== null;

  return (
    <div className="ideas">
      <h2 className="section-title">Ideas</h2>
      <p className="muted">
        Start from the heart of your celebration. Shubā shapes a theme around it, then ideas for every part of the day.
        Keep what you love, skip the rest, and add any idea to your plan.
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      <section className="card-inner heart" aria-labelledby={`${id}-heart`}>
        <h3 id={`${id}-heart`}>The heart of your celebration</h3>
        <div className="field">
          <label htmlFor={`${id}-for`}>Who is it really for?</label>
          <input
            id={`${id}-for`}
            type="text"
            maxLength={80}
            placeholder={
              input.eventName ? `e.g. ${input.eventName}` : "e.g. Dadi's 80th, our daughter's first birthday"
            }
            value={forWhom}
            onChange={(e) => setForWhom(e.target.value)}
          />
        </div>
        <fieldset className="choice-group">
          <legend>How should guests feel? Pick up to 3</legend>
          <div className="choices">
            {FEELINGS.map((f) => {
              const on = feelings.includes(f);
              return (
                <label key={f} className={`choice${on ? " is-on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!on && feelings.length >= 3}
                    onChange={() => setFeelings((list) => toggleIn(list, f, 3))}
                  />
                  {FEELING_LABELS[f]}
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="theme-now">
          <p>
            <span className="muted">Your theme now:</span> <strong>{plan.theme.name}</strong>
          </p>
          <p className="small">{plan.theme.description}</p>
          <Dots colors={colors} />
        </div>
        <button type="button" className="btn btn-primary" onClick={() => void showThemes()} disabled={busy}>
          {job === "themes"
            ? "Sketching themes…"
            : state.directions.length
              ? "Show me 3 new themes"
              : "Show me 3 theme ideas"}
        </button>
      </section>

      {busy && (
        <p className="loading" aria-hidden="true">
          <span className="spinner" /> {WAIT[job]}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {state.directions.length > 0 && (
        <section aria-labelledby={`${id}-dir`} className="directions-block">
          <h3 id={`${id}-dir`} ref={directionsRef} tabIndex={-1} className="small-heading">
            Three directions. Choose the one that feels like you
          </h3>
          <div className="directions">
            {state.directions.map((d) => {
              const current = d.name === plan.theme.name;
              return (
                <article key={d.name} className={`card-inner direction${current ? " is-current" : ""}`}>
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
                      onClick={() => void choose(d)}
                      aria-label={`Choose ${d.name}`}
                    >
                      Choose this
                    </button>
                  )}
                </article>
              );
            })}
          </div>
          <p className="muted small">
            Like parts of two? Say so in the box below, e.g. “colours of the first, food of the second”.
          </p>
        </section>
      )}

      {plan.ideas.signature && (
        <section className="card-inner signature" aria-labelledby={`${id}-sig`}>
          <p className="eyebrow">Signature moment</p>
          <h3 id={`${id}-sig`}>{plan.ideas.signature.title}</h3>
          <p>{plan.ideas.signature.detail}</p>
          <p className="muted small">The one thing guests will talk about later.</p>
          {(() => {
            const sig: Idea = {
              title: plan.ideas.signature.title,
              detail: plan.ideas.signature.detail,
              why: "",
              moment: "main",
              forFunction: "",
              cost: 0,
              effort: "help",
            };
            return added.has(ideaId(sig)) ? (
              <p className="small done-text">
                <span aria-hidden="true">✓ </span>In your plan
              </p>
            ) : (
              <button
                type="button"
                className="btn btn-small"
                disabled={busy}
                onClick={() => void onAdd(sig, { ...state, added: [...state.added, ideaId(sig)] })}
              >
                Add to my plan
              </button>
            );
          })()}
        </section>
      )}

      <section className="card-inner own-idea" aria-labelledby={`${id}-own`}>
        <h3 id={`${id}-own`}>Got an idea?</h3>
        <form onSubmit={submitOwn}>
          <label htmlFor={`${id}-own-text`}>Something you&apos;ve seen, loved or must have. Shubā builds on it.</label>
          <textarea
            id={`${id}-own-text`}
            rows={3}
            maxLength={300}
            placeholder="e.g. A mehendi with a garden feel, Rajasthani food stalls, something fun for the kids"
            value={own}
            onChange={(e) => setOwn(e.target.value)}
          />
          <div className="choices" role="group" aria-label="Starting points">
            {LEANINGS.map((l) => {
              const on = leanings.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  className={`chip${on ? " is-on" : ""}`}
                  aria-pressed={on}
                  onClick={() => setLeanings((list) => toggleIn(list, l, 3))}
                >
                  {LEANING_LABELS[l]}
                </button>
              );
            })}
          </div>
          {functions.length > 0 && (
            <div className="field own-fn">
              <label htmlFor={`${id}-own-fn`}>For which function?</label>
              <select id={`${id}-own-fn`} value={ownFunction} onChange={(e) => setOwnFunction(e.target.value)}>
                <option value="">Any</option>
                {functions.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button type="submit" className="btn" disabled={busy}>
            {job === "more" ? "Thinking…" : "Get ideas"}
          </button>
        </form>
      </section>

      <h3 ref={listRef} tabIndex={-1} className="section-title ideas-heading">
        Ideas for the day
      </h3>
      {functions.length > 0 && (
        <div className="choices fn-filter" role="group" aria-label="Show ideas for">
          {["", ...functions].map((f) => (
            <button
              key={f || "all"}
              type="button"
              className={`chip${filter === f ? " is-on" : ""}`}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f || "All"}
            </button>
          ))}
        </div>
      )}

      {groups.length === 0 && (
        <p className="muted">
          {filter ? `No ideas for ${filter} yet. Ask for some in the box above.` : "No ideas yet. Ask for some above."}
        </p>
      )}

      {groups.map(([moment, list]) => (
        <section key={moment} className="moment" aria-labelledby={`${id}-m-${moment}`}>
          <h4 id={`${id}-m-${moment}`} className="moment-title">
            {MOMENT_LABELS[moment]}
          </h4>
          <ul className="idea-cards">
            {list.map((idea) => {
              const iid = ideaId(idea);
              const isKept = kept.has(iid);
              const isAdded = added.has(iid);
              const isSkipped = state.skipped.includes(iid);
              return (
                <li key={iid} className={`card-inner idea${isKept ? " is-kept" : ""}${isSkipped ? " is-skipped" : ""}`}>
                  <div className="idea-top">
                    <h5>{idea.title}</h5>
                    {fresh.includes(iid) && <span className="badge badge-new">New</span>}
                  </div>
                  <ul className="idea-tags small" aria-label="About this idea">
                    {idea.forFunction && <li>{idea.forFunction}</li>}
                    <li>{EFFORT_LABELS[idea.effort]}</li>
                    {idea.cost > 0 && <li>About {formatINR(idea.cost)} (estimate)</li>}
                  </ul>
                  {idea.detail && <p>{idea.detail}</p>}
                  {idea.why && (
                    <p className="why small">
                      <span className="why-label">Why it fits:</span> {idea.why}
                    </p>
                  )}
                  <div className="idea-actions no-print">
                    {isAdded ? (
                      <span className="small done-text">
                        <span aria-hidden="true">✓ </span>In your plan
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-small btn-primary"
                        disabled={busy || isSkipped}
                        aria-label={`Add to my plan: ${idea.title}`}
                        onClick={() =>
                          void onAdd(idea, {
                            ...state,
                            added: [...state.added, iid],
                            kept: isKept ? state.kept : [...state.kept, iid],
                          })
                        }
                      >
                        Add to my plan
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-small"
                      aria-pressed={isKept}
                      aria-label={`Keep: ${idea.title}`}
                      disabled={isSkipped}
                      onClick={() => keep(idea)}
                    >
                      <span aria-hidden="true">{isKept ? "♥ " : "♡ "}</span>
                      {isKept ? "Kept" : "Keep"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-link"
                      aria-label={`${isSkipped ? "Bring back" : "Skip"}: ${idea.title}`}
                      disabled={isAdded}
                      onClick={() => skip(idea)}
                    >
                      {isSkipped ? "Bring back" : "Skip"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-link"
                      aria-label={`More like this: ${idea.title}`}
                      disabled={busy || isSkipped}
                      onClick={() =>
                        void more(
                          {
                            seed: tidyText(`${idea.title}. ${idea.detail}`, 240),
                            forFunction: tidyText(idea.forFunction, 40),
                          },
                          `like "${idea.title}"`,
                        )
                      }
                    >
                      More like this
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {skippedCount > 0 && (
        <button type="button" className="btn btn-link btn-small no-print" onClick={() => setShowSkipped((s) => !s)}>
          {showSkipped ? "Hide skipped ideas" : `Show ${skippedCount} skipped ${skippedCount === 1 ? "idea" : "ideas"}`}
        </button>
      )}
      <p className="muted small">Costs are rough estimates for {input.city}, not quotes.</p>
    </div>
  );
}
