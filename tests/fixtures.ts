import type { EventInput, Plan } from "@/lib/schemas";

export const NOW = new Date("2026-10-24T06:00:00Z"); // 24 Oct 2026, 11:30 IST

export const baseInput: EventInput = {
  eventType: "birthday",
  eventName: "Aarav turns 5",
  date: "2026-12-12",
  city: "Bengaluru",
  guests: 40,
  budget: 50000,
  style: "Jungle safari",
  notes: "Afternoon party",
  includeMuhurat: false,
};

export const samplePlan: Plan = {
  summary: "A fun jungle safari party at home.",
  theme: { name: "Jungle Safari", description: "Green and gold with animal props.", colors: ["green", "gold"] },
  budget: [
    { category: "Food", amount: 20000, note: "Snacks and cake" },
    { category: "Decor", amount: 12000, note: "" },
    { category: "Entertainment", amount: 10000, note: "Magician" },
    { category: "Return gifts", amount: 5000, note: "" },
    { category: "Contingency", amount: 2000, note: "" },
  ],
  budgetTips: ["Order the cake from a home baker"],
  timeline: [
    { when: "4 weeks before", daysBefore: 28, tasks: [{ task: "Send invites", priority: "high", milestone: true }] },
    {
      when: "1 week before",
      daysBefore: 7,
      tasks: [{ task: "Confirm magician", priority: "medium", milestone: false }],
    },
    { when: "Event day", daysBefore: 0, tasks: [{ task: "Set up decor by 2 PM", priority: "low", milestone: false }] },
  ],
  vendors: [
    {
      type: "Caterer",
      priority: "must-have",
      bookByDaysBefore: 30,
      questions: ["Kid-friendly menu?"],
      brief: "Hi, we need snacks for 40.",
    },
    {
      type: "Entertainer",
      priority: "nice-to-have",
      bookByDaysBefore: null,
      questions: [],
      brief: "Hi, are you free on 12 Dec?",
    },
  ],
  ideas: { decor: ["Leaf garlands"], food: ["Animal-shaped sandwiches"], activities: ["Treasure hunt"], extras: [] },
  warnings: [],
};
