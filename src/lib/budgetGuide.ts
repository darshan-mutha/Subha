import type { EventType } from "./schemas";

export { formatLakhCrore } from "./money";

/**
 * "Not sure about budget?" helper. Works out three ready-made budget levels
 * (Simple / Comfortable / Grand) from event type, guests and city, with no AI
 * call: instant, free, and the same answer every time. Every figure is a rough
 * estimate and is labelled that way in the UI.
 */

export const TIERS = ["simple", "comfortable", "grand"] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_LABELS: Record<Tier, string> = {
  simple: "Simple",
  comfortable: "Comfortable",
  grand: "Grand",
};

/** Typical spend per guest in INR as [low, high] for Simple, Comfortable, Grand. */
type Range = readonly [number, number];
const PER_GUEST: Record<EventType, readonly [Range, Range, Range]> = {
  wedding: [
    [1500, 2500],
    [3000, 5000],
    [7000, 12000],
  ],
  engagement: [
    [1000, 1800],
    [2000, 3500],
    [4500, 8000],
  ],
  birthday: [
    [400, 800],
    [900, 1600],
    [2000, 4000],
  ],
  anniversary: [
    [600, 1100],
    [1200, 2200],
    [2800, 5000],
  ],
  "baby-shower": [
    [500, 900],
    [1000, 1800],
    [2200, 4000],
  ],
  "naming-ceremony": [
    [400, 800],
    [900, 1600],
    [2000, 3500],
  ],
  housewarming: [
    [400, 800],
    [900, 1600],
    [2000, 3500],
  ],
  "religious-ceremony": [
    [300, 700],
    [800, 1400],
    [1800, 3200],
  ],
  festival: [
    [300, 600],
    [700, 1200],
    [1500, 2800],
  ],
  "community-event": [
    [200, 450],
    [500, 900],
    [1100, 2000],
  ],
  "corporate-event": [
    [1000, 1800],
    [2000, 3500],
    [4500, 8000],
  ],
  "school-event": [
    [150, 350],
    [400, 800],
    [900, 1600],
  ],
  other: [
    [400, 800],
    [900, 1600],
    [2000, 3500],
  ],
};

/** Even a tiny event has fixed costs (decor, photos, venue). Minimum total per level. */
const BASE_FLOOR: Record<Tier, number> = { simple: 10_000, comfortable: 30_000, grand: 75_000 };
const FLOOR_FACTOR: Partial<Record<EventType, number>> = {
  wedding: 5,
  engagement: 2,
  "corporate-event": 2,
};

/** Big cities and destination towns cost more. Matched on a cleaned-up city name. */
const METROS = new Set([
  "mumbai",
  "delhi",
  "new delhi",
  "bengaluru",
  "bangalore",
  "gurugram",
  "gurgaon",
  "noida",
  "hyderabad",
  "chennai",
  "pune",
  "kolkata",
]);
const DESTINATIONS = new Set(["goa", "udaipur", "jaipur", "jodhpur", "kochi", "mussoorie", "rishikesh"]);

export function cityFactor(city: string): number {
  const key = city.trim().toLowerCase().replace(/\s+/g, " ");
  if (DESTINATIONS.has(key)) return 1.25;
  if (METROS.has(key)) return 1.15;
  return 1;
}

/** Rounds to a figure people actually say: ₹45,000, ₹3,20,000, ₹12,50,000. */
export function niceRound(amount: number): number {
  const step = amount < 100_000 ? 5_000 : amount < 1_000_000 ? 10_000 : 50_000;
  return Math.max(step, Math.round(amount / step) * step);
}

const VENUE: Record<Tier, string> = {
  simple: "Home, terrace or community hall",
  comfortable: "Banquet hall or garden venue",
  grand: "Premium venue, hotel or resort",
};
const FOOD: Record<Tier, string> = {
  simple: "Home-style food or a simple buffet",
  comfortable: "Full caterer with 2–3 counters",
  grand: "Premium menu with live counters",
};
const DECOR: Record<Tier, string> = {
  simple: "Basic flowers and lights",
  comfortable: "Themed decor and stage",
  grand: "Designer decor and lighting",
};
const MEMORIES: Record<Tier, string> = {
  simple: "Phone photos, or a photographer for 2–3 hours",
  comfortable: "Photographer for the whole event",
  grand: "Photo and video team, plus music or DJ",
};

const VENUE_OVERRIDE: Partial<Record<EventType, Record<Tier, string>>> = {
  "corporate-event": {
    simple: "Office space or meeting room",
    comfortable: "Hotel conference hall",
    grand: "Premium hotel or offsite resort",
  },
  "school-event": {
    simple: "School hall or grounds",
    comfortable: "Auditorium with sound and lights",
    grand: "Hired auditorium or outdoor stage",
  },
  "religious-ceremony": {
    simple: "At home or the temple hall",
    comfortable: "Community or kalyana mantapa hall",
    grand: "Large mantapa or banquet venue",
  },
};

export interface BudgetOption {
  tier: Tier;
  label: string;
  low: number;
  high: number;
  /** The single figure we fill in if the host picks this level (mid-point, rounded). */
  suggested: number;
  perGuest: number;
  includes: string[];
}

export interface GuideInput {
  eventType: EventType;
  guests: number;
  city?: string;
}

/** Three budget levels for the host to pick from. Pure function, easy to test. */
export function suggestBudgets({ eventType, guests, city = "" }: GuideInput): BudgetOption[] {
  const factor = cityFactor(city);
  const floorFactor = FLOOR_FACTOR[eventType] ?? 1;
  return TIERS.map((tier, i) => {
    const [lowPer, highPer] = PER_GUEST[eventType][i];
    const floor = BASE_FLOOR[tier] * floorFactor;
    const low = niceRound(Math.max(lowPer * guests * factor, floor));
    const high = Math.max(niceRound(Math.max(highPer * guests * factor, floor * 1.5)), low);
    const suggested = niceRound((low + high) / 2);
    return {
      tier,
      label: TIER_LABELS[tier],
      low,
      high,
      suggested,
      perGuest: Math.round(suggested / guests / 10) * 10,
      includes: [(VENUE_OVERRIDE[eventType] ?? VENUE)[tier], FOOD[tier], DECOR[tier], MEMORIES[tier]],
    };
  });
}

/** "About ₹1,200 per guest" helper for the form, or null if numbers are missing. */
export function perGuest(budget: number, guests: number): number | null {
  if (!Number.isFinite(budget) || !Number.isFinite(guests) || budget <= 0 || guests <= 0) return null;
  return Math.round(budget / guests);
}
