"use client";

import type { RefObject } from "react";
import type { EventInput } from "@/lib/schemas";
import { EventForm, type FormValues } from "../EventForm";
import { VoiceStart, type VoicePayload } from "../VoiceStart";

/** The screen's heading, so the page can move focus to it after a screen change. */
export type HeadingRef = RefObject<HTMLHeadingElement | null>;

/** The polite live region that announces progress to screen readers. */
export function LiveStatus({ text }: { text: string }) {
  return (
    <p className="sr-only" role="status" aria-live="polite">
      {text}
    </p>
  );
}

/** A visible error alert, shown only when there is an error. */
export function ErrorAlert({ error }: { error: string }) {
  return error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;
}

interface VoiceProps {
  headingRef: HeadingRef;
  busy: boolean;
  error: string;
  eventCount: number;
  onSubmit: (payload: VoicePayload) => void;
  onUseForm: () => void;
  onMyEvents: () => void;
}

/** The first screen: speak or type a line about the celebration. */
export function VoiceScreen({ headingRef, busy, error, eventCount, onSubmit, onUseForm, onMyEvents }: VoiceProps) {
  return (
    <>
      <section aria-labelledby="start-heading">
        <h2 id="start-heading" ref={headingRef} className="section-title" tabIndex={-1}>
          Tell us about your celebration
        </h2>
        <VoiceStart busy={busy} error={error} onSubmit={onSubmit} onUseForm={onUseForm} />
      </section>
      {eventCount > 0 && (
        <button type="button" className="btn btn-link" onClick={onMyEvents}>
          Back to my events ({eventCount})
        </button>
      )}
    </>
  );
}

interface FormProps {
  headingRef: HeadingRef;
  hasPlan: boolean;
  heard: string;
  missing: Record<string, string>;
  error: string;
  formKey: number;
  editing: FormValues | undefined;
  busy: boolean;
  fieldErrs: Record<string, string>;
  onSubmit: (input: EventInput) => void;
  onBackToPlan: () => void;
  onBackToVoice: () => void;
}

/** The details form screen, with what a voice note heard when there was one. */
export function DetailsScreen(props: FormProps) {
  const { headingRef, hasPlan, heard, missing, error, busy } = props;
  const fromVoice = Boolean(heard);
  return (
    <section aria-labelledby="start-heading">
      <h2 id="start-heading" ref={headingRef} className="section-title" tabIndex={-1}>
        {hasPlan ? "Edit your event" : fromVoice ? "Check your details" : "Tell us about your celebration"}
      </h2>
      {fromVoice && (
        <div className="heard card-inner">
          <p className="small-heading">Shubā heard:</p>
          <blockquote>“{heard}”</blockquote>
          <p className="muted small">
            {Object.keys(missing).length
              ? "We filled in what we understood. Please complete the highlighted fields."
              : "We filled in everything we understood. Check the details and create your plan."}
          </p>
        </div>
      )}
      <ErrorAlert error={error} />
      <EventForm
        key={props.formKey}
        initial={props.editing}
        initialErrors={missing}
        busy={busy}
        serverErrors={props.fieldErrs}
        onSubmit={props.onSubmit}
      />
      {hasPlan ? (
        <button type="button" className="btn btn-link" onClick={props.onBackToPlan}>
          Cancel and go back to my plan
        </button>
      ) : (
        <button type="button" className="btn btn-link" onClick={props.onBackToVoice}>
          Type or speak instead
        </button>
      )}
      {busy && (
        <p className="loading" aria-hidden="true">
          <span className="spinner" /> Shubā is planning… this takes about 20–30 seconds.
        </p>
      )}
    </section>
  );
}
