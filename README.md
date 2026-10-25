# Shubā — plan any celebration in minutes

Shubā is a GenAI planning assistant for weddings, birthdays, religious ceremonies, festivals, school, corporate and community events. **Start with a voice note** in English, Hindi or any Indian language (or type one line, or use the form), check the details Shubā understood, and get a complete, editable plan:

- **Budget** split by category that always adds up to your total, with ways to save
- **Timeline** of tasks from today to the event day, each with a **priority (High / Medium / Low)** and a **real due date**; overdue and due-this-week tasks are highlighted
- **Do next** list: the most urgent unfinished tasks (overdue first, then by date and priority), for everyone or one person
- **Vendor checklist** with questions to ask and a ready-to-send WhatsApp brief for each vendor
- **Personalised ideas** for theme, decor, food, activities and special touches
- **Auspicious timings** (Rahu Kalam, Yamagandam, Gulika Kalam) calculated for the event city and date
- **Warnings** for unrealistic budgets, short notice and seasonal risks
- **Plan together** – add family and friends, let AI divide the tasks by role, share one private link; everyone ticks off their tasks and sees live progress, and each person can get their task list on WhatsApp
- **Change the plan in plain words** ("Reduce the budget by 20%", "Make it eco-friendly")
- **Download as PDF / print**, and the last plan is kept on your device

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
│ Voice note / form      │ ─────────────────▶ │ 1. Rate limit + size limit + JSON check   │
│  (same zod schema as   │                    │ 2. Validate input (zod)                   │
│   the server)          │                    │ 3. In parallel:                           │
│ Plan view (tabs)       │ ◀───────────────── │    • Gemini, structured JSON output       │
│ Change-request box     │   POST /api/refine │    • City lookup → sunrise/sunset →       │
└────────────────────────┘                    │      Rahu Kalam etc. (pure maths)         │
                                              │ 4. Validate AI reply (zod), retry once    │
                                              │ 5. Fix budget totals, add local warnings  │
                                              └──────────────────────────────────────────┘
```

| Path                                                 | Purpose                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/lib/schemas.ts`                                 | Input, plan and refine schemas shared by browser and server                     |
| `src/lib/prompt.ts`                                  | System instruction, prompts and the JSON schema sent to Gemini                  |
| `src/lib/extract.ts`                                 | Voice / one-line description → validated form values                            |
| `src/components/VoiceStart.tsx`                      | Microphone recorder (MediaRecorder, 60 s max) with typing fallback              |
| `src/lib/team.ts`                                    | Team members, stable task ids, shared-plan schemas, WhatsApp messages           |
| `src/lib/assign.ts`                                  | AI task split with even-load fallback                                           |
| `src/lib/store.ts`                                   | Shared plan storage (Neon Postgres; in-memory for tests), optimistic versioning |
| `src/components/TeamPanel.tsx`, `SharedPlanView.tsx` | Plan together, team link page with live progress                                |
| `src/lib/gemini.ts`                                  | Gemini client, JSON extraction, validation and retry                            |
| `src/lib/planner.ts`                                 | Orchestrates AI call, timings, budget normalisation and warnings                |
| `src/lib/muhurat.ts`                                 | Sunrise/sunset (NOAA algorithm) and Rahu Kalam / Yamagandam / Gulika Kalam      |
| `src/lib/locations.ts`                               | Built-in Indian city list with Open-Meteo geocoding fallback                    |
| `src/lib/budget.ts`                                  | Rupee formatting, budget normalisation and rule-based warnings                  |
| `src/lib/http.ts`                                    | Shared API handling: rate limit, body limit, validation, safe errors            |
| `src/components/*`                                   | Form, accessible tabs and plan sections                                         |

## Where GenAI is used

- **Voice-first start** – the voice note (or a typed line) goes to Gemini as audio; Gemini returns a transcript and the event details as JSON (dates like "next Sunday" and amounts like "15 lakh" are converted). Every field is re-validated with the form's rules; anything missing or invalid is highlighted for the host to fill in. The form is always available as a fallback.
- **Plan generation** – Gemini (`gemini-flash-latest`) receives the event details and returns a plan as JSON that must match a schema (`responseJsonSchema`).
- **Task split** – given the helpers' names and roles ("cousin, knows caterers"), Gemini assigns each task and vendor booking to the best person; anything left out is balanced evenly in code.
- **Priorities and dates** – the plan returns each step's days-before-event and a priority per task; Shubā turns these into real dates in code (never before today) and builds the "Do next" list.
- **Plan refinement** – the current plan plus the user's change request are sent back; Gemini returns an updated plan and, if asked, a new total budget or guest count.
- **What AI is _not_ trusted with** – budget totals are re-balanced in code, warnings for budget-per-guest and short notice are rule-based, and auspicious timings are calculated, never generated.

### Prompt evolution

1. **v1** – "Plan an event for…" → generic, US-centric answers that ignored the budget.
2. **v2** – Expert Indian planner role, INR and city-aware pricing, strict JSON schema → structured, but budget lines did not add up and timelines included past dates.
3. **v3** – Rules for totals, today's date, ready-to-send vendor briefs, dietary notes and risk warnings; user text wrapped in `<user_details>` and declared as data (prompt-injection guard); explicit ban on inventing muhurat.
4. **v4** – Each timeline step returns `daysBefore` and each task a `priority`, so Shubā can show real due dates, overdue items and a "Do next" list.
5. **v5** – 3–5 tasks flagged as milestones; each fills a petal of the rangoli and plays a short celebration when done.

## Security

- Gemini API key is read only on the server from `GEMINI_API_KEY`; it never reaches the browser.
- All input is validated with zod on both client and server; text fields allow letters (any script), numbers and common punctuation only.
- Request size limit (32 KB; voice notes up to ~1 MB, audio types whitelisted), JSON-only API, per-IP rate limit (10 requests/minute).
- AI output is validated against a schema before use; raw service errors are never shown to users.
- Strict, nonce-based Content-Security-Policy generated per request (`'strict-dynamic'`, no inline scripts, no `eval` in production), plus X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, Cross-Origin-Opener-Policy and HSTS. API routes send `default-src 'none'`.
- Voice notes are sent to Gemini for understanding only and are never stored by Shubā. No personal data is stored on the server.
- Microphone is allowed only for this site (Permissions-Policy) and only while the host is recording.

## Accessibility

Automated scan with **axe-core (WCAG 2.2 A/AA + best practices): 0 violations** at 0% and 100% progress, in light and dark mode, on every screen (voice start, details check, form errors, all plan tabs, shared plan) at desktop and mobile widths. axe checks also run in the test suite (`tests/a11y.test.tsx`).

- Semantic landmarks, skip link, one `h1`, labelled form controls.
- Errors linked to fields with `aria-invalid` and `aria-describedby`; focus moves to the first error.
- WAI-ARIA tabs with arrow-key, Home and End navigation.
- Live region announces progress and results; focus moves to the plan heading when ready.
- WCAG AA colour contrast, 44 px touch targets, visible focus ring, reduced-motion support, mobile-first layout.

## Efficiency

- AI call and city lookup run in parallel; common Indian cities need no network call; lookups are cached.
- Single structured AI call per plan; one retry only on malformed output.
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
cp .env.example .env.local   # add GEMINI_API_KEY (free at https://aistudio.google.com/apikey)
                             # and DATABASE_URL (Neon Postgres) to enable team sharing
npm install
npm run dev
```

## Roadmap

Full panchang and muhurat via a licensed astrology API, comments and voting on ideas, sign-in for teams, guest list and RSVP tracking, seating suggestions, vendor quote comparison, multi-language UI.
