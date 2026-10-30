import type { FormValues } from "./formValues";

/** The form's id prefix and every current field error (own and server). */
export interface FieldContext {
  id: string;
  errors: Record<string, string>;
}

/** The id, name and error wiring for a form control. */
export function fieldAttrs({ id, errors }: FieldContext, name: keyof FormValues) {
  return {
    id: `${id}-${name}`,
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${id}-${name}-error` : undefined,
  };
}

/** The error message under a field, if it has one. */
export function FieldError({ ctx, name }: { ctx: FieldContext; name: keyof FormValues }) {
  return ctx.errors[name] ? (
    <p className="field-error" id={`${ctx.id}-${name}-error`}>
      {ctx.errors[name]}
    </p>
  ) : null;
}
