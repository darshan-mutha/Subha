# Shubā — plan any celebration in minutes

**Who it's for:** Indian families planning a celebration themselves (a wedding, a child's birthday, a griha pravesh) with a fixed budget, a guest list that keeps changing, and relatives who all want to help. **The hardest part for them** is keeping budget, dates, guests and vendors in step when something changes. Shubā keeps the whole plan connected, so one change updates everything.

Shubā is a GenAI planning assistant for weddings, birthdays, religious ceremonies, festivals, school, corporate and community events. **Start by speaking** in English, Hindi, Kannada, Tamil, Telugu, Marathi or Bengali (or type one line, or use the form), check the details Shubā understood, and get a complete, editable plan:

- **Make it yours** – pick what matters most (food, photos, rituals…), food preference (veg, Jain, no onion-garlic…) and **guest needs** (elderly guests, wheelchair access, young children, hearing or sight support, allergies, a quiet room). Priorities get more of the budget and are protected when money is short; guest needs go into the venue and caterer messages, the budget and the checklist. Voice picks these up too ("my grandmother uses a wheelchair")
- **Budget** split by category that always adds up to your total, with ways to save. **Change any line** and Shubā moves the difference across the other lines, showing exactly what it cost elsewhere
- **Timeline** of tasks from today to the event day, each with a **priority (High / Medium / Low)** and a **real due date**; overdue and due-this-week tasks are highlighted
- **Over budget? See your choices** – when bookings cost more than planned (or you just need to spend less), Shubā offers several different ways out, each with an estimated saving and what it affects: increase the budget, cheaper options in the same area, drop extras, fewer guests, change the venue, move the date, fewer functions, family helps, one vendor for several jobs. Your priorities are never cut. Pick one and the whole plan updates, with **What changed** and **Undo**
- **Running late?** – mark any task or booking as late and pick when it will be done. Every unfinished task after it moves by the same number of days (venue before caterer, caterer before menu tasting), nothing moves onto the event day, tasks already done stay put, and a **What changed** card lists every move with **Undo**. Shared with the whole team
- **Do next** list: the most urgent unfinished tasks (overdue first, then by date and priority), for everyone or one person
- **Vendor checklist** with questions to ask and a ready-to-send WhatsApp brief for each vendor
- **Quotes, booking and agreement** – add the quotes you get, compare them side by side against that vendor's share of the budget, book one, track advance paid and balance due (fed into the Budget tab), and get a one-page booking confirmation to send on WhatsApp or print
- **Invitation card** – Shubā writes the invitation in English or 6 Indian languages (Hindi, Kannada, Tamil, Telugu, Marathi, Bengali) in a warm, traditional or fun tone, and draws a card in three looks (Peacock, Ivory, Haldi). Edit any word, then download the image, share it straight to WhatsApp on a phone, or send the message
- **Guest replies (RSVP)** – one link for all guests, sent on WhatsApp with the invitation words. Each family says if they're coming, how many adults and children, their food (veg, Jain, no onion-garlic…), any needs (elderly, wheelchair, young children, allergies) and which side they're from, and can change their reply later from the same phone. The Guests tab shows live counts, a food count for the caterer, guest needs, every reply and a downloadable list, and offers to update the plan's guest count from the replies. Guests never see the plan, budget or team link, and the host can stop taking replies at any time
- **Seating plan** – worked out from the guest replies: each family sits together (a very big family fills tables side by side), each side sits together, small groups share tables, and families with elderly or wheelchair users get the tables nearest the entrance. Choose 6–12 people per table, keep seats for "maybe" guests, move any family to another table (saved for the whole team), see the food mix per table, and copy the plan to send to the venue
- **Personalised ideas** for theme, decor, food, activities and special touches
- **Auspicious timings** (Rahu Kalam, Yamagandam, Gulika Kalam) calculated for the event city and date
- **Warnings** for unrealistic budgets, short notice and seasonal risks
- **Plan together** – add family and friends, let AI divide the tasks by role, share one private link; everyone ticks off their tasks and sees live progress, and each person can get their task list on WhatsApp
- **Change the plan mid-way in plain words** – "We added 50 guests, the budget is 10% lower and the date moved 2 weeks earlier" updates guests, budget and date together, re-plans the timeline and vendor deadlines, cuts the least important areas first, and shows a **What changed** card with **Undo**
- **My events** – plan several celebrations at once, no sign-in needed. Every event is kept on your device in one list (soonest first, with a countdown); switch between them, start a new one without losing the others, or remove one. Shared events keep their team link, and plans opened from someone else's link are added to the list so helpers can find them again
- **Download as PDF / print**

Built for Hack2skill PromptWars Virtual — Challenge 5: Celebration & Event Planner.

## Look: your celebration comes alive

Shubā's logo is a petal rangoli: six petals, one always gold. A new plan starts in calm black and white; every task you tick adds a little colour (peacock teal and gold, blended in OKLab), each milestone (venue booked, invitations sent…) fills one petal of the rangoli with a short, gentle petal shower and a one-line cheer, and at 100% the plan turns festive with a toran across the top and an "All set" card. Warnings (overdue, errors) are always in colour from day one.

- Soft, rounded shapes everywhere: pill buttons and chips, rounded cards, inputs, tables and focus rings, soft shadows, gentle easing.
- Fraunces SuperSoft for headings and the wordmark (self-hosted, one file covering "ā"), Inter for everything else.
- Light and dark mode; "reduce motion" turns off all animation (colour still updates).
- Every colour pair is tested for WCAG AA at 0%, 25%, 50%, 75% and 100% progress, in both modes (`tests/palette.test.ts`).

## How it works

```
Browser (React, Next.js)                     Server (Next.js route handlers)
┌────────────────────────┐   POST /api/extract┌──────────────────────────────────────────┐
│ Speak / type / form    │ ─────────────────▶ │ 1. Rate limit + size limit + JSON check   │
│  (same zod schema as   │                    │ 2. Validate input (zod)                   │
│   the server)          │                    │ 3. In parallel:                           │
│ Plan view (tabs)       │ ◀───────────────── │    • Claude, structured JSON output       │
│ Change-request box     │   POST /api/refine │    • City lookup → sunrise/sunset →       │
└────────────────────────┘                    │      Rahu Kalam etc. (pure maths)         │
                                              │ 4. Validate AI reply (zod), retry once    │
                                              │ 5. Fix budget totals, add local warnings  │
                                              └──────────────────────────────────────────┘
```

| Path                                                                     | Purpose                                                                                            |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `src/lib/schemas.ts`                                                     | Input, plan and refine schemas shared by browser and server                                        |
| `src/lib/prompt.ts`                                                      | System instruction, prompts and the JSON schema sent to Claude                                     |
| `src/lib/extract.ts`                                                     | Voice / one-line description → validated form values                                               |
| `src/components/VoiceStart.tsx`                                          | Browser speech-to-text (7 Indian languages) with typing fallback                                   |
| `src/lib/team.ts`                                                        | Team members, stable task ids, shared-plan schemas, WhatsApp messages                              |
| `src/lib/assign.ts`                                                      | AI task split with even-load fallback                                                              |
| `src/lib/store.ts`                                                       | Shared plan storage (Neon Postgres; in-memory for tests), optimistic versioning                    |
| `src/components/TeamPanel.tsx`, `SharedPlanView.tsx`                     | Plan together, team link page with live progress                                                   |
| `src/lib/ai.ts`                                                          | Claude client, schema conversion, JSON extraction, validation and retry                            |
| `src/lib/planner.ts`                                                     | Orchestrates AI call, timings, budget normalisation and warnings                                   |
| `src/lib/muhurat.ts`                                                     | Sunrise/sunset (NOAA algorithm) and Rahu Kalam / Yamagandam / Gulika Kalam                         |
| `src/lib/locations.ts`                                                   | Built-in Indian city list with Open-Meteo geocoding fallback                                       |
| `src/lib/budget.ts`                                                      | Rupee formatting, budget normalisation and rule-based warnings                                     |
| `src/lib/rsvp.ts`, `rsvpStore.ts`, `GuestReply.tsx`, `GuestsSection.tsx` | Guest replies: rules, counts, separate guest link, hashed reply secrets, guest page and Guests tab |
| `src/lib/myEvents.ts`, `MyEvents.tsx`                                    | My events: several events per device, shared links remembered, safe migration                      |
| `src/lib/savings.ts`, `SavingsChoices.tsx`                               | Over-budget choices: overspend per line, raise-budget in code, AI choices                          |
| `src/lib/budgetGuide.ts`, `BudgetHelper.tsx`                             | "Not sure? Help me decide": three estimated budget levels and per-guest spend                      |
| `src/lib/http.ts`                                                        | Shared API handling: cross-site block, rate limits, body limit, validation                         |
| `src/components/*`                                                       | Form, accessible tabs and plan sections                                                            |

## Where GenAI is used

- **Voice-first start** – the browser turns speech into text as the host talks (the words appear in the box to check or edit; no audio reaches Shubā's server). The text goes to Claude, which returns the event details as JSON (dates like "next Sunday" and amounts like "15 lakh" are converted). Every field is re-validated with the form's rules; anything missing or invalid is highlighted for the host to fill in. The form is always available as a fallback.
- **Plan generation** – Claude (`claude-sonnet-5-5`, low effort for speed) receives the event details and returns a plan as JSON that must match a schema (structured outputs, `output_config.format`). Zod re-validates every reply.
- **Vendor agreement** – Claude writes the scope and simple terms (set-up time, guest changes, cancellation) for a one-page booking confirmation. Prices, dates and the payment schedule are always filled in by code from the host's own numbers, never by the AI. If the AI is busy, a standard template is used so the host still gets a draft.
- **Invitation words** – Claude writes only the heading, invitation and closing line, in the chosen language's own script. The date (in that language), time, venue and notes are placed on the card by code exactly as the host entered them, so the AI can never get a date or address wrong. If the AI is busy, standard English words are used and the host is told.
- **Task split** – given the helpers' names and roles ("cousin, knows caterers"), Claude assigns each task and vendor booking to the best person; anything left out is balanced evenly in code.
- **Priorities and dates** – the plan returns each step's days-before-event and a priority per task; Shubā turns these into real dates in code (never before today) and builds the "Do next" list.
- **Personal plans** – the host's top priorities, food preference and guest needs are part of the prompt; Claude weights the budget toward the priorities and builds access needs into briefs, questions, budget and tasks.
- **Over-budget choices** – Claude suggests 4–6 different ways to save for this event and city (cheaper options, fewer functions, a venue with in-house catering…), each with an estimated saving and what it affects, never touching the host's priorities or guest needs. "Increase the budget" is worked out in code (exactly what each over-booked line is short, rounded up to ₹1,000) and applied without AI. Picking another choice sends it through the change flow below. If the AI is busy, rule-based choices are used and the host is told.
- **Plan refinement** – the current plan plus the user's change request are sent back; Claude returns an updated plan, any new total budget, guest count or date, and plain lines on what changed and which trade-offs it made. The new date is re-checked with the form's rules, and Shubā adds its own factual lines (date, guests, budget before → after).
- **What AI is _not_ trusted with** – the "Not sure? Help me decide" budget levels (Simple / Comfortable / Grand) come from rule-based per-guest ranges by event type and city, so they are instant, free and repeatable; budget totals are re-balanced in code (also when the host edits a line), warnings for budget-per-guest and short notice are rule-based, and auspicious timings are calculated, never generated.

### Prompt evolution

1. **v1** – "Plan an event for…" → generic, US-centric answers that ignored the budget.
2. **v2** – Expert Indian planner role, INR and city-aware pricing, strict JSON schema → structured, but budget lines did not add up and timelines included past dates.
3. **v3** – Rules for totals, today's date, ready-to-send vendor briefs, dietary notes and risk warnings; user text wrapped in `<user_details>` and declared as data (prompt-injection guard); explicit ban on inventing muhurat.
4. **v4** – Each timeline step returns `daysBefore` and each task a `priority`, so Shubā can show real due dates, overdue items and a "Do next" list.
5. **v5** – 3–5 tasks flagged as milestones; each fills a petal of the rangoli and plays a short celebration when done.
6. **v6** – Every amount is framed as a planning estimate; the model may never call a price confirmed or quote a named vendor's rate.
7. **v7** – Personal plans: priorities protected when cutting costs, guest needs built into briefs, budget and tasks, tasks ordered by dependency (venue before caterer and invitations), and change requests can move the date and must explain what changed.
8. **v8** – Speed: a new plan is written as two halves at the same time, each told which part it owns, roughly halving the wait.

## Security

- Claude API key is read only on the server from `ANTHROPIC_API_KEY`; it never reaches the browser. API errors are mapped to friendly messages that never include provider details.
- All input is validated with zod on both client and server; text fields allow letters (any script), numbers and common punctuation only.
- Request size limit (32 KB; 4 KB for the event description), JSON-only API, reply length capped per call.
- Rate limits on AI calls: 10 per minute and 50 per day per visitor, plus an app-wide ceiling of 300 per hour as a cost safety net (all adjustable with environment variables). Saving ticks: 90 per minute.
- Requests from other websites are refused (Origin and Sec-Fetch-Site checks), so another site cannot spend Shubā's AI quota through its visitors.
- Kill switch: `AI_DISABLED=1` pauses AI planning instantly without a redeploy of code.
- Plus a monthly spend limit set in the Claude Console.
- AI output is validated against a schema before use; raw service errors are never shown to users.
- Strict, nonce-based Content-Security-Policy generated per request (`'strict-dynamic'`, no inline scripts, no `eval` in production), plus X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, Cross-Origin-Opener-Policy and HSTS. API routes send `default-src 'none'`.
- Speech is turned into text by the browser; only that text is sent to Claude, and it is never stored by Shubā.
- Guest replies store only what guests type (name, numbers, food, needs, optional phone and note) and are visible only to people with the team link. The guest link is a separate random 128-bit token, so it cannot be used to open or change the plan, and the guest page shows only the invitation. Each guest gets a secret kept on their phone to change their own reply; only a SHA-256 hash of it is stored. Downloaded reply lists are protected against spreadsheet formula injection.
- Microphone is allowed only for this site (Permissions-Policy) and only while the host is recording.

## Accessibility

Automated scan with **axe-core (WCAG 2.2 A/AA + best practices): 0 violations** at 0% and 100% progress, in light and dark mode, on every screen (voice start, details check, form errors, all plan tabs, shared plan) at desktop and mobile widths. axe checks also run in the test suite (`tests/a11y.test.tsx`).

- Semantic landmarks, skip link, one `h1`, labelled form controls.
- Errors linked to fields with `aria-invalid` and `aria-describedby`; focus moves to the first error.
- WAI-ARIA tabs with arrow-key, Home and End navigation.
- Live region announces progress and results; focus moves to the plan heading when ready.
- WCAG AA colour contrast, 44 px touch targets, visible focus ring, reduced-motion support, mobile-first layout.

## Efficiency

- A new plan is written as two halves at the same time (budget, timeline and warnings / vendors and ideas), alongside the city lookup, so the host waits about half as long as for one long reply. Common Indian cities need no network call; lookups are cached.
- Structured AI output with one retry only on malformed output. Seating, guest counts, raising the budget and budget levels are worked out in code, with no AI wait at all.
- Static home page, no client-side libraries beyond React.

## Code quality and testing

```bash
npm run check   # Prettier, ESLint, TypeScript strict, tests with coverage
```

- **ESLint** (Next.js core-web-vitals + TypeScript rules) and **Prettier** formatting, enforced in CI.
- **GitHub Actions CI** (`.github/workflows/ci.yml`) runs formatting, lint, type-check, tests with coverage and a production build on every push.
- **Coverage**: about 96% of lines (thresholds enforced: 90% lines/statements, 85% functions, 80% branches).

204 automated tests (Vitest + Testing Library) cover validation, budget maths, sunrise and Rahu Kalam calculations, geocoding fallback, AI reply parsing and retries, prompts, voice-note extraction, team task split, shared-plan storage and API, API routes (validation, 413/415/429), the voice start, form and keyboard tab navigation.

## Run locally

```bash
cp .env.example .env.local   # add ANTHROPIC_API_KEY (from https://platform.claude.com)
                             # and DATABASE_URL (Neon Postgres) to enable team sharing
npm install
npm run dev
```

## Changelog

- **26 Oct 2026** – Seating plan in the Guests tab, worked out in code from the replies (families and sides together, access needs nearest the entrance, even split for big families), with table size, "maybe" seats, moves saved with the plan and copy-as-text.
- **26 Oct 2026** – Guest replies (RSVP): one guest link (separate from the team link), a simple reply page with food and needs, live counts and food count for the host, download as a spreadsheet, and "update the plan to N guests" through the change flow with Undo. Each guest's reply is protected by a secret kept only on their phone (stored hashed).
- **26 Oct 2026** – My events: several events on one device without a login. A list with countdowns, open / remove (with a check), new events no longer replace the old one, shared events open from their team link. The plan saved by the one-plan version is moved into the list automatically.
- **26 Oct 2026** – Over budget? See your choices: a banner when bookings go over, and a Budget-tab panel with several ways to save (or raise the budget), each with an estimated saving and trade-off; choosing one updates the plan with What changed and Undo.
- **25 Oct 2026** – Running late: mark a task late and the tasks after it shift by the same days (capped at the day before the event), with What changed and Undo. Saved with the plan and the team link.
- **25 Oct 2026** – Make it yours (priorities, food, guest needs, also by voice); mid-way changes can move the date, with a What changed card and Undo; editable budget lines that rebalance the rest; prompt v7.
- **25 Oct 2026** – Vendor quotes, booking and agreement: compare quotes against budget, book a vendor, track advance and balance, AI-drafted booking confirmation (WhatsApp / print). Booked amounts now show on the Budget tab.
- **25 Oct 2026** – Invitation maker: AI-written invite in 7 languages, card drawn in the browser (1080×1350) in three looks, download / share / WhatsApp. Saved with the plan and shared with the team.

## Roadmap

Full panchang and muhurat via a licensed astrology API, comments and voting on ideas, sign-in so events follow you across devices, multi-language UI.
