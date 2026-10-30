"use client";

import { useId, useState, type FormEvent, type RefObject } from "react";
import { MemberSchema, newMemberId, type Member } from "@/lib/team";

/** Name and role inputs that add one helper, rejecting bad or duplicate names. */
export function AddMemberForm({
  team,
  busy,
  nameRef,
  onTeamChange,
}: {
  team: Member[];
  busy: boolean;
  nameRef: RefObject<HTMLInputElement | null>;
  onTeamChange: (team: Member[]) => void;
}) {
  const id = useId();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = MemberSchema.safeParse({ id: newMemberId(), name, role });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the name");
      return;
    }
    if (team.some((m) => m.name.toLowerCase() === parsed.data.name.toLowerCase())) {
      setError(`${parsed.data.name} is already in the team`);
      return;
    }
    setError("");
    onTeamChange([...team, parsed.data]);
    setName("");
    setRole("");
    nameRef.current?.focus();
  }

  return (
    <form className="add-member no-print" onSubmit={add} noValidate>
      <div className="field">
        <label htmlFor={`${id}-name`}>Name</label>
        <input
          id={`${id}-name`}
          ref={nameRef}
          type="text"
          maxLength={40}
          placeholder="e.g. Ravi"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-role`}>Role or relation (optional)</label>
        <input
          id={`${id}-role`}
          type="text"
          maxLength={40}
          placeholder="e.g. cousin, knows caterers"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
      </div>
      <button type="submit" className="btn" disabled={busy}>
        Add person
      </button>
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
