/** Voice note limits, shared by the browser recorder and the server. */
export const AUDIO_MIME_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/aac",
] as const;
export const MAX_AUDIO_SECONDS = 60;
/** ~60 s of compressed speech, base64-encoded, with headroom. */
export const MAX_AUDIO_BASE64 = 1_400_000;
