/** The choices on the details form: kinds of event, what matters most, food and guest needs. */

export const EVENT_TYPES = [
  "wedding",
  "engagement",
  "birthday",
  "anniversary",
  "baby-shower",
  "naming-ceremony",
  "housewarming",
  "religious-ceremony",
  "festival",
  "community-event",
  "corporate-event",
  "school-event",
  "other",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  wedding: "Wedding",
  engagement: "Engagement",
  birthday: "Birthday",
  anniversary: "Anniversary",
  "baby-shower": "Baby shower",
  "naming-ceremony": "Naming ceremony",
  housewarming: "Housewarming (Griha Pravesh)",
  "religious-ceremony": "Religious ceremony / Pooja",
  festival: "Festival celebration",
  "community-event": "Community event",
  "corporate-event": "Corporate event",
  "school-event": "School / college event",
  other: "Other",
};

/** Event types where auspicious timings are shown by default. */
export const TRADITIONAL_EVENT_TYPES: ReadonlySet<EventType> = new Set<EventType>([
  "wedding",
  "engagement",
  "naming-ceremony",
  "housewarming",
  "religious-ceremony",
  "festival",
]);

/** Areas the host can rank as "what matters most". Protected when costs are cut. */
export const FOCUS_AREAS = ["food", "decor", "photos", "venue", "entertainment", "rituals"] as const;
export type FocusArea = (typeof FOCUS_AREAS)[number];
export const FOCUS_LABELS: Record<FocusArea, string> = {
  food: "Food",
  decor: "Decor",
  photos: "Photos & video",
  venue: "Venue",
  entertainment: "Music & fun",
  rituals: "Rituals & traditions",
};
export const MAX_FOCUS = 3;

export const FOOD_PREFS = ["", "veg", "jain", "no-onion-garlic", "veg-and-non-veg"] as const;
export type FoodPref = (typeof FOOD_PREFS)[number];
export const FOOD_LABELS: Record<FoodPref, string> = {
  "": "No preference",
  veg: "Vegetarian",
  jain: "Jain",
  "no-onion-garlic": "No onion or garlic",
  "veg-and-non-veg": "Veg and non-veg",
};

/** Guest needs that change the venue, food and timeline. */
export const GUEST_NEEDS = ["elderly", "wheelchair", "young-kids", "hearing-sight", "allergies", "quiet-room"] as const;
export type GuestNeed = (typeof GUEST_NEEDS)[number];
export const GUEST_NEED_LABELS: Record<GuestNeed, string> = {
  elderly: "Elderly guests",
  wheelchair: "Wheelchair or step-free access",
  "young-kids": "Babies and young children",
  "hearing-sight": "Hearing or sight support",
  allergies: "Food allergies",
  "quiet-room": "Quiet or rest room",
};
