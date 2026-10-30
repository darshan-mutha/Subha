/**
 * "Over budget? See your choices." When bookings cost more than planned, or the
 * host simply needs to spend less, Shubā offers a few different ways out with
 * an estimated saving and what each one affects. The host picks one; applying
 * it goes through the normal change flow (What changed + Undo).
 *
 * Raising the budget is worked out in code. The other choices are suggested by
 * Claude for this event, with a plain-code fallback if the AI is busy.
 *
 * The parts: kinds, modes and schemas (savings/schema), the choices worked out
 * in code (savings/options) and the server-only AI call (savings/suggest).
 * Client code imports the first two directly, to keep the AI client out of the bundle.
 */
export * from "./savings/options";
export * from "./savings/schema";
export * from "./savings/suggest";
