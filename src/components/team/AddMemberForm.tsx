"use client";

import { useId, useState, type FormEvent, type RefObject } from "react";
import { MemberSchema, newMemberId, type Member } from "@/lib/team";
import { invalidAttrs } from "../fieldErrors";

/** Which input a problem belongs to, so only that one is marked invalid. */
type Problem = { field: "name" | "role"; message: string } | null;

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
  const [problem, setProblem] = useState<Problem>(null);
  const errorId = `${id}-error`;
  const errorFor = (field: "name" | "role") => (problem?.field === field ? problem.message : undefined);

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = MemberSchema.safeParse({ id: newMemberId(), name, role });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path[0] === "role" ? "role" : "name";
      setProblem({ field, message: issue?.message ?? `Please check the ${field}` });
      return;
    }
    if (team.some((m) => m.name.toLowerCase() === parsed.data.name.toLowerCase())) {
      setProblem({ field: "name", message: `${parsed.data.name} is already in the team` });
      return;
    }
    setProblem(null);
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
          {...invalidAttrs(errorId, errorFor("name"))}
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
          {...invalidAttrs(errorId, errorFor("role"))}
        />
      </div>
      <button type="submit" className="btn" disabled={busy}>
        Add person
      </button>
      {problem && (
        <p id={errorId} className="field-error" role="alert">
          {problem.message}
        </p>
      )}
    </form>
  );
}
