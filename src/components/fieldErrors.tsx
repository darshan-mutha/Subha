/**
 * The error wiring for a form's fields: each control says it is invalid and
 * points at its message with aria-describedby, and the message carries the
 * matching id. `suffix` sets the id ending ("err" by default).
 */
export function fieldErrorWiring(id: string, errors: Record<string, string>, suffix = "err") {
  const errId = (field: string) => `${id}-${field}-${suffix}`;
  const err = (field: string) =>
    errors[field] ? (
      <p className="field-error" id={errId(field)}>
        {errors[field]}
      </p>
    ) : null;
  const invalid = (field: string) => ({
    "aria-invalid": errors[field] ? (true as const) : undefined,
    "aria-describedby": errors[field] ? errId(field) : undefined,
  });
  return { err, invalid };
}
