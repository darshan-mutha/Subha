"use client";

interface Props {
  functions: string[];
  filter: string;
  setFilter: (value: string) => void;
}

/** Chips that narrow the ideas list to one function, or show all. */
export function FunctionFilter({ functions, filter, setFilter }: Props) {
  if (functions.length === 0) return null;
  return (
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
  );
}
