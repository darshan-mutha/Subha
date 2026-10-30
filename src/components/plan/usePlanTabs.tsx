"use client";

import { useState } from "react";
import type { LocalWorkspace } from "@/lib/client";
import { DEFAULT_SEATING } from "@/lib/seating";
import type { TabItem } from "../Tabs";
import { GuestsHub } from "../GuestsHub";
import { IdeasPanel } from "../IdeasPanel";
import { InviteMaker } from "../InviteMaker";
import { SavingsChoices } from "../SavingsChoices";
import { TeamPanel } from "../TeamPanel";
import { useReplies } from "../useReplies";
import { VendorsSection } from "../VendorsBoard";
import { BudgetSection } from "./BudgetSection";
import { eventTitle } from "./eventTitle";
import { FunctionsSection } from "./FunctionsSection";
import { HomeSection } from "./HomeSection";
import { TimelineSection } from "./TimelineSection";
import { TimingsSection } from "./TimingsSection";
import type { PlanActions } from "./usePlanActions";
import type { PlanDerived } from "./usePlanDerived";
import type { Act, PlanWorkspaceProps } from "./workspaceTypes";

/** Order of the plan sections in the navigation. */
const SECTION_ORDER = [
  "home",
  "budget",
  "timeline",
  "guests",
  "functions",
  "ideas",
  "vendors",
  "invite",
  "team",
  "timings",
];

type Ctx = Pick<PlanWorkspaceProps, "shareUrl" | "onChange" | "onShare" | "viewer" | "onViewerChange"> & {
  data: LocalWorkspace;
  planId: string | null;
  initialTab: string;
  tab: string;
  derived: PlanDerived;
  actions: PlanActions;
  busy: boolean;
  act: Act;
  goTo: (id: string) => void;
};

/** The sections every plan has, except Guests (which shares state with Functions). */
function coreTabs(ctx: Ctx): TabItem[] {
  const { data, derived, actions, busy, act, onChange, onShare, shareUrl } = ctx;
  const { input, plan, team, assignments, done } = data;
  const { scheduled, today } = derived;
  return [
    { id: "home", label: "Home", content: <HomeSection {...ctx} /> },
    {
      id: "budget",
      label: "Budget",
      content: (
        <>
          <BudgetSection
            plan={plan}
            total={input.budget}
            booked={derived.bookedLines}
            payments={derived.payments}
            onBudgetChange={(lines) =>
              void act(() => onChange({ plan: { ...plan, budget: lines } }), "Saving…", "Budget updated")
            }
          />
          <SavingsChoices
            input={input}
            plan={plan}
            over={derived.overList}
            busy={busy}
            onChoose={actions.chooseSaving}
          />
        </>
      ),
    },
    {
      id: "timeline",
      label: "Timeline",
      content: (
        <TimelineSection tasks={scheduled.timeline} stepDue={scheduled.stepDue} plan={plan} state={actions.taskState} />
      ),
    },
    {
      id: "vendors",
      label: "Vendors",
      content: (
        <VendorsSection items={scheduled.vendors} plan={plan} state={actions.taskState} deals={actions.dealState} />
      ),
    },
    {
      id: "ideas",
      label: "Ideas",
      content: (
        <IdeasPanel
          input={input}
          plan={plan}
          state={data.ideaState}
          onSave={actions.saveIdeas}
          onAdd={(idea, next) => actions.addIdea(idea, next)}
        />
      ),
    },
    {
      id: "invite",
      label: "Invite",
      content: <InviteMaker input={input} invite={data.invite ?? null} onSave={(invite) => onChange({ invite })} />,
    },
    {
      id: "team",
      label: "Team",
      content: (
        <TeamPanel
          team={team}
          items={derived.items}
          assignments={assignments}
          done={done}
          eventTitle={eventTitle(data)}
          shareUrl={shareUrl}
          today={today}
          busy={busy}
          onTeamChange={actions.changeTeam}
          onAutoAssign={actions.autoAssign}
          onShare={onShare ? () => void act(onShare, "Creating your team link…", "Team link ready") : null}
        />
      ),
    },
  ];
}

/** Builds the plan's sections in navigation order. Sections not in this plan (Timings, Functions) are left out. */
export function usePlanTabs(ctx: Ctx): TabItem[] {
  const { data, planId, initialTab, tab, derived, actions, busy, act, onChange, onShare, goTo } = ctx;
  const { input, plan, timings } = data;
  const { today } = derived;
  // "Seat this function" reopens Guests on its Seating part.
  const [guestsOpen, setGuestsOpen] = useState<{ part: "list" | "replies" | "seating"; n: number } | null>(null);
  // One load of the guest replies, shared by the Guests views and Functions.
  const replies = useReplies(planId, tab === "guests" || tab === "functions");

  const tabs: TabItem[] = [
    ...coreTabs(ctx),
    {
      id: "guests",
      label: "Guests",
      content: (
        <GuestsHub
          key={guestsOpen?.n ?? 0}
          planId={planId}
          replies={replies}
          input={input}
          title={eventTitle(data)}
          invite={data.invite ?? null}
          busy={busy}
          onShare={
            onShare ? () => void act(() => onShare("guests"), "Creating your guest link…", "Guest link ready") : null
          }
          seating={data.seating}
          onSeating={(seating) => void act(() => onChange({ seating }), "Saving…", "Seating saved")}
          onUseGuests={(guests) =>
            void actions.applyChange(`Change the guest count to ${guests}, based on the guest list and replies.`)
          }
          entries={data.guestList ?? []}
          functions={(plan.functions ?? []).map((f) => f.name)}
          today={today}
          onList={(guestList) => void act(() => onChange({ guestList }), "Saving…", "Guest list saved")}
          initialPart={guestsOpen?.part ?? (initialTab === "guests" ? "replies" : "list")}
        />
      ),
    },
  ];
  if (timings) tabs.push({ id: "timings", label: "Timings", content: <TimingsSection timings={timings} /> });
  if (plan.functions.length > 0)
    tabs.push({
      id: "functions",
      label: "Functions",
      content: (
        <FunctionsSection
          plan={plan}
          firstDay={input.date}
          entries={data.guestList ?? []}
          replies={replies.replies}
          busy={busy}
          onPlanFor={(fn, guests) =>
            void actions.applyChange(
              `Plan the ${fn} for ${guests} guests, based on the guest list. Keep the other functions as they are.`,
            )
          }
          onSeat={(fn) => {
            void act(() => onChange({ seating: { ...(data.seating ?? DEFAULT_SEATING), fn } }), "Saving…", "");
            setGuestsOpen((g) => ({ part: "seating", n: (g?.n ?? 0) + 1 }));
            goTo("guests");
          }}
        />
      ),
    });
  return tabs.sort((a, b) => SECTION_ORDER.indexOf(a.id) - SECTION_ORDER.indexOf(b.id));
}
