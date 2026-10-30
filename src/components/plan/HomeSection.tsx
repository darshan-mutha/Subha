"use client";

import type { LocalWorkspace } from "@/lib/client";
import { DoNextSection } from "./DoNextSection";
import { eventTitle } from "./eventTitle";
import { FunctionsSummary } from "./FunctionsSummary";
import { CelebrateCard, PlanAbout, PlanWarnings, RefineBox, ViewerPicker } from "./HomeParts";
import type { PlanActions } from "./usePlanActions";
import type { PlanDerived } from "./usePlanDerived";
import type { Act } from "./workspaceTypes";

/** The Home section: about, functions, warnings, whose tasks, Do next (or the celebration) and Change your plan. */
export function HomeSection({
  data,
  derived,
  actions,
  busy,
  act,
  shareUrl,
  onShare,
  viewer,
  onViewerChange,
  goTo,
}: {
  data: LocalWorkspace;
  derived: PlanDerived;
  actions: PlanActions;
  busy: boolean;
  act: Act;
  shareUrl: string | null;
  onShare: ((openTab?: string) => Promise<void>) | null;
  viewer: string;
  onViewerChange: (memberId: string) => void;
  goTo: (id: string) => void;
}) {
  const { input, plan, team } = data;
  return (
    <>
      <PlanAbout input={input} plan={plan} />
      <FunctionsSummary
        plan={plan}
        firstDay={input.date}
        entries={data.guestList ?? []}
        onOpen={() => goTo("functions")}
      />
      <PlanWarnings warnings={plan.warnings} />

      <ViewerPicker team={team} viewer={viewer} onViewerChange={onViewerChange} />

      {derived.complete ? (
        <CelebrateCard
          title={eventTitle(data)}
          shareUrl={shareUrl}
          onShare={onShare ? () => void act(onShare, "Creating your team link…", "Team link ready") : null}
        />
      ) : (
        <DoNextSection items={derived.upNext} state={actions.taskState} />
      )}

      <RefineBox
        busy={busy}
        instruction={actions.instruction}
        onInstruction={actions.setInstruction}
        onSubmit={actions.refine}
      />
    </>
  );
}
