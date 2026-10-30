"use client";

import { useState } from "react";

/** Copies text to the clipboard and announces "Copied" (or a fallback hint). */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [status, setStatus] = useState("");
  return (
    <>
      <button
        type="button"
        className="btn btn-small"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setStatus("Copied");
          } catch {
            setStatus("Copy failed – please select the text");
          }
          setTimeout(() => setStatus(""), 2500);
        }}
      >
        Copy {label}
      </button>
      <span role="status" className="small muted">
        {status}
      </span>
    </>
  );
}
