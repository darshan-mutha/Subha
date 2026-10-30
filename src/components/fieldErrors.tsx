/**
 * The attributes that tie one control to its error message: invalid only while
 * there is an error (never aria-invalid="false"), described by the message,
 * or by `otherwise` (e.g. a hint) when there is none.
 */
export function invalidAttrs(errorId: string, error: string | undefined, otherwise?: string) {
  return {
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? errorId : otherwise,
  };
}

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
  const invalid = (field: string) => invalidAttrs(errId(field), errors[field]);
  return { err, invalid };
}
