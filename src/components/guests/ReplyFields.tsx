"use client";

import {
  GUEST_FOOD_LABELS,
  GUEST_GROUP_LABELS,
  GUEST_REPLY_NEED_LABELS,
  GUEST_REPLY_NEEDS,
  MAX_PARTY,
  type GuestEvent,
} from "@/lib/rsvp";
import type { fieldErrorWiring } from "../fieldErrors";
import type { ReplyForm } from "./useGuestReply";

/** Sets one answer on the guest's reply form. */
export type SetField = <K extends keyof ReplyForm>(key: K, value: ReplyForm[K]) => void;

/** Error wiring for the reply form's fields (see fieldErrorWiring). */
export type FieldHelpers = ReturnType<typeof fieldErrorWiring>;

/** Party size, food and needs: asked only when the guest may be coming. */
export function GoingFields({
  id,
  form,
  set,
  foods,
  f,
}: {
  id: string;
  form: ReplyForm;
  set: SetField;
  foods: GuestEvent["foods"];
  f: FieldHelpers;
}) {
  return (
    <>
      <div className="field-pair">
        <div className="field">
          <label htmlFor={`${id}-adults`}>Adults</label>
          <input
            id={`${id}-adults`}
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_PARTY}
            value={form.adults}
            onChange={(e) => set("adults", e.target.value)}
            {...f.invalid("adults")}
          />
          {f.err("adults")}
        </div>
        <div className="field">
          <label htmlFor={`${id}-kids`}>Children</label>
          <input
            id={`${id}-kids`}
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_PARTY}
            value={form.kids}
            onChange={(e) => set("kids", e.target.value)}
            {...f.invalid("kids")}
          />
          {f.err("kids")}
        </div>
      </div>

      <div className="field">
        <label htmlFor={`${id}-food`}>Food</label>
        <select id={`${id}-food`} value={form.food} onChange={(e) => set("food", e.target.value as ReplyForm["food"])}>
          {foods.map((food) => (
            <option key={food} value={food}>
              {GUEST_FOOD_LABELS[food]}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="field choice-group">
        <legend>Anything the hosts should know? (optional)</legend>
        <div className="choices choices-col">
          {GUEST_REPLY_NEEDS.map((n) => (
            <label key={n} className="choice">
              <input
                type="checkbox"
                checked={form.needs.includes(n)}
                onChange={(e) =>
                  set("needs", e.target.checked ? [...form.needs, n] : form.needs.filter((x) => x !== n))
                }
              />
              {GUEST_REPLY_NEED_LABELS[n]}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

/** Group, note and phone: the optional details at the end of the reply form. */
export function MoreFields({
  id,
  form,
  set,
  groups,
  f,
}: {
  id: string;
  form: ReplyForm;
  set: SetField;
  groups: GuestEvent["groups"];
  f: FieldHelpers;
}) {
  return (
    <>
      <div className="field">
        <label htmlFor={`${id}-group`}>You are from (optional)</label>
        <select
          id={`${id}-group`}
          value={form.group}
          onChange={(e) => set("group", e.target.value as ReplyForm["group"])}
        >
          <option value="">Choose…</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {GUEST_GROUP_LABELS[g]}
            </option>
          ))}
        </select>
        <p className="hint">Helps the hosts seat families and friends together.</p>
      </div>

      <div className="field">
        <label htmlFor={`${id}-note`}>Message or note (optional)</label>
        <textarea
          id={`${id}-note`}
          rows={2}
          maxLength={200}
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
          {...f.invalid("note")}
        />
        {f.err("note")}
      </div>

      <div className="field">
        <label htmlFor={`${id}-phone`}>Phone (optional)</label>
        <input
          id={`${id}-phone`}
          type="tel"
          autoComplete="tel"
          maxLength={20}
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          {...f.invalid("phone")}
        />
        <p className="hint">Only the hosts see it, so they can reach you about the event.</p>
        {f.err("phone")}
      </div>
    </>
  );
}
