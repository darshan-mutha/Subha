"use client";

import { useState } from "react";

/** Progress of the current request: busy flag, error, field errors and the screen-reader announcement. */
export function useRequestStatus() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({});
  const [announce, setAnnounce] = useState("");
  return { busy, setBusy, error, setError, fieldErrs, setFieldErrs, announce, setAnnounce };
}

/** What `useRequestStatus` returns. */
export type RequestStatus = ReturnType<typeof useRequestStatus>;
