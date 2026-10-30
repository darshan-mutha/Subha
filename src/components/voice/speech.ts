/** Longest the browser listens in one go. */
export const MAX_LISTEN_SECONDS = 60;
/** Longest description the start box accepts. */
export const MAX_CHARS = 500;

/** The small slice of the browser's speech recognition API that Shubā uses. */
export interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

/** The browser's speech recognition constructor, if it has one. */
export function getRecognition(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Whether this browser can listen at all. */
export function canRecord(): boolean {
  return !!getRecognition();
}

/** Seconds as "m:ss". */
export function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Join what was already typed with what was just said. */
export function joinSpoken(before: string, spoken: string): string {
  const said = spoken.replace(/\s+/g, " ").trim();
  if (!said) return before;
  const typed = before.trim();
  return (typed ? `${typed} ${said}` : said).slice(0, MAX_CHARS);
}

/** A friendly message for a speech recognition error, or "" when none is needed. */
export function speechErrorMessage(error: string): string {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Shubā could not use your microphone. Please allow microphone access, or type instead.";
  }
  if (error === "no-speech") return "Shubā didn't hear anything. Tap the mic and speak, or type instead.";
  if (error !== "aborted") return "Listening stopped. Please try again, or type instead.";
  return "";
}
