import type { FormValues } from "./formValues";
import { fieldErrorWiring } from "../fieldErrors";

/** The form's id prefix and every current field error (own and server). */
export interface FieldContext {
  id: string;
  errors: Record<string, string>;
}

const wiring = ({ id, errors }: FieldContext) => fieldErrorWiring(id, errors, "error");

/** The id, name and error wiring for a form control. */
export function fieldAttrs(ctx: FieldContext, name: keyof FormValues) {
  return { id: `${ctx.id}-${name}`, name, ...wiring(ctx).invalid(name) };
}

/** The error message under a field, if it has one. */
export function FieldError({ ctx, name }: { ctx: FieldContext; name: keyof FormValues }) {
  return wiring(ctx).err(name);
}
