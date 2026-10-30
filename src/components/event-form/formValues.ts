import { suggestedFunctions, type TraditionValues } from "@/components/TraditionPicker";
import { addDays, todayIST } from "@/lib/dates";
import type { EventInput, EventType, FocusArea, FoodPref, GuestNeed } from "@/lib/schemas";

/** Everything the event form holds, as typed by the host (numbers stay strings until checked). */
export interface FormValues {
  eventType: EventType | "";
  eventName: string;
  date: string;
  city: string;
  guests: string;
  budget: string;
  style: string;
  notes: string;
  includeMuhurat: boolean;
  focus: FocusArea[];
  food: FoodPref;
  guestNeeds: GuestNeed[];
  traditions: TraditionValues["traditions"];
  traditionOther: string;
  days: number;
  functions: TraditionValues["functions"];
  additions: TraditionValues["additions"];
}

/** A blank form. */
export const EMPTY_FORM: FormValues = {
  eventType: "",
  eventName: "",
  date: "",
  city: "",
  guests: "",
  budget: "",
  style: "",
  notes: "",
  includeMuhurat: false,
  focus: [],
  food: "",
  guestNeeds: [],
  traditions: [],
  traditionOther: "",
  days: 1,
  functions: [],
  additions: [],
};

/** A ready-made example; its date is set when it is tapped (see exampleValues). */
export interface Example {
  label: string;
  /** How far ahead the example event is, so it always passes the form's date check. */
  daysAhead: number;
  values: Omit<FormValues, "date">;
}

/** Ready-made examples the host can load with one tap. */
export const EXAMPLES: Example[] = [
  {
    label: "Wedding in Jaipur",
    daysAhead: 120,
    values: {
      eventType: "wedding",
      eventName: "Ananya & Rohan's wedding",
      city: "Jaipur",
      guests: "250",
      budget: "1500000",
      style: "Royal Rajasthani",
      notes: "Mostly vegetarian guests, some need Jain food",
      includeMuhurat: true,
      focus: ["food", "rituals", "photos"],
      food: "veg",
      guestNeeds: ["elderly", "wheelchair"],
      traditions: ["marwari", "punjabi"],
      traditionOther: "",
      days: 3,
      functions: suggestedFunctions(["marwari", "punjabi"], "wedding", 3, ["choreography", "welcome"]),
      additions: ["choreography", "welcome"],
    },
  },
  {
    label: "Kid's birthday",
    daysAhead: 30,
    values: {
      eventType: "birthday",
      eventName: "Aarav turns 5",
      city: "Bengaluru",
      guests: "40",
      budget: "50000",
      style: "Jungle safari",
      notes: "Afternoon party at home, 20 kids and 20 adults",
      includeMuhurat: false,
      focus: ["entertainment", "food"],
      food: "veg",
      guestNeeds: ["young-kids", "allergies"],
      traditions: [],
      traditionOther: "",
      days: 1,
      functions: [],
      additions: [],
    },
  },
  {
    label: "Community Diwali",
    daysAhead: 45,
    values: {
      eventType: "community-event",
      eventName: "Apartment Diwali Mela",
      city: "Pune",
      guests: "300",
      budget: "200000",
      style: "Eco-friendly, no firecrackers",
      notes: "Stalls by residents, cultural programme for kids",
      includeMuhurat: false,
      focus: ["entertainment", "decor"],
      food: "",
      guestNeeds: ["elderly", "young-kids"],
      traditions: [],
      traditionOther: "",
      days: 1,
      functions: [],
      additions: [],
    },
  },
];

/** Turns form values into the raw shape the event schema checks (empty numbers become missing). */
export function toInput(values: FormValues): unknown {
  return {
    ...values,
    guests: values.guests === "" ? undefined : values.guests,
    budget: values.budget === "" ? undefined : values.budget,
  };
}

/** Fills the form from a saved event, e.g. when editing its details. */
export function fromInput(input: EventInput): FormValues {
  return {
    ...EMPTY_FORM,
    ...input,
    traditions: input.traditions ?? [],
    traditionOther: input.traditionOther ?? "",
    days: input.days ?? 1,
    functions: input.functions ?? [],
    additions: input.additions ?? [],
    guests: String(input.guests),
    budget: String(input.budget),
  };
}

/** The example's form values, dated from today in India so it is valid whenever it is tapped. */
export function exampleValues(example: Example): FormValues {
  return { ...example.values, date: addDays(todayIST(), example.daysAhead) };
}
