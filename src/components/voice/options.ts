/** Languages the browser can listen in. The host picks one; mixing in English usually works. */
export const SPEECH_LANGUAGES = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "kn-IN", label: "ಕನ್ನಡ" },
  { code: "ta-IN", label: "தமிழ்" },
  { code: "te-IN", label: "తెలుగు" },
  { code: "mr-IN", label: "मराठी" },
  { code: "bn-IN", label: "বাংলা" },
] as const;

/** One-tap starters: each fills the box with a complete sentence the host can edit. */
export const START_EXAMPLES = [
  {
    label: "5th birthday in Bengaluru",
    text: "My daughter's 5th birthday on 12 December in Bengaluru, about 40 guests, budget ₹50,000, jungle theme",
  },
  {
    label: "3-day wedding in Jaipur",
    text: "3-day wedding in Jaipur on 14 February, 250 guests, budget ₹25 lakh. We are Marwari, the groom's side is Punjabi. Mehendi and sangeet on day 1, pheras on day 3",
  },
  {
    label: "Griha pravesh in Mysuru",
    text: "Griha pravesh in Mysuru on 18 January, 60 guests, budget ₹1.5 lakh, simple and traditional",
  },
] as const;
