"use client";

import { useEffect, useRef } from "react";
import { EMPTY_IDEA_STATE, type IdeaState } from "@/lib/ideas/schema";
import { bloomMessage } from "@/lib/schedule";
import { Bloom } from "./Celebrate";
import { SectionNav, type NavAction } from "./SectionNav";
import type { TabItem } from "./Tabs";
import { aliveFromProgress } from "./plan/eventTitle";
import { OverBudgetBanner, PlanHeader, WhatChanged } from "./plan/PlanBanners";
import { useAct } from "./plan/useAct";
import { useBlooms } from "./plan/useBlooms";
import { usePlanActions } from "./plan/usePlanActions";
import { usePlanDerived } from "./plan/usePlanDerived";
import { usePlanTabs } from "./plan/usePlanTabs";
import { useSectionNav } from "./plan/useSectionNav";
import type { PlanWorkspaceProps } from "./plan/workspaceTypes";

export { eventTitle, aliveFromProgress } from "./plan/eventTitle";

/** The section panels under the navigation; only the current one is shown. */
function SectionPanels({ tabs, current }: { tabs: TabItem[]; current: string }) {
  return (
    <>
      {tabs.map((t) => (
        <section
          key={t.id}
          id={`section-${t.id}`}
          aria-label={t.label}
          hidden={t.id !== current}
          tabIndex={-1}
          className="tabpanel section-panel"
          data-print-title={t.label}
        >
          {t.content}
        </section>
      ))}
    </>
  );
}

/** The plan screen: summary, tabs, team panel and the change-request box. */
export function PlanWorkspace(props: PlanWorkspaceProps) {
  const { data, planKey, planId = null, initialTab = "home", notice = "" } = props;
  const { onEdit, onMyEvents, onStartOver, eventCount = 0 } = props;
  const ideaState: IdeaState = data.ideaState ?? EMPTY_IDEA_STATE;
  const run = useAct();
  const { busy, error, announce, act } = run;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const derived = usePlanDerived(data, props.viewer);
  const { progress, complete, milestones, petals } = derived;
  const { tab, tabsRef, goTo, showChoices } = useSectionNav(initialTab);
  const actions = usePlanActions({ ...props, derived, ideaState, run });
  const { bloomIndex, bloomItem, finishBloom } = useBlooms(planKey, milestones);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--alive", aliveFromProgress(progress).toFixed(3));
    return () => {
      root.style.removeProperty("--alive");
    };
  }, [progress]);

  const tabs = usePlanTabs({ ...props, planId, initialTab, tab: tab, derived, actions, busy, act, goTo: goTo });
  // A section that is not in this plan (e.g. Timings) falls back to Home.
  const current = tabs.some((t) => t.id === tab) ? tab : "home";

  const navActions: NavAction[] = [
    ...(onEdit ? [{ label: "Edit details", onClick: onEdit }] : []),
    { label: "Download PDF / Print", onClick: () => window.print() },
    ...(onMyEvents ? [{ label: eventCount > 1 ? `My events (${eventCount})` : "My events", onClick: onMyEvents }] : []),
    { label: "Plan a new event", onClick: onStartOver },
  ];

  return (
    <article className="plan" aria-labelledby="plan-heading" data-complete={complete}>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
      <PlanHeader
        input={data.input}
        headingRef={headingRef}
        complete={complete}
        petals={petals}
        progress={progress}
        milestonesDone={derived.milestonesDone}
        milestoneCount={milestones.length}
        notice={notice}
      />

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {actions.lastChange && (
        <WhatChanged
          change={actions.lastChange}
          changeRef={actions.changeRef}
          busy={busy}
          onUndo={() => void actions.undo()}
          onKeep={() => actions.setLastChange(null)}
        />
      )}

      {derived.overBy > 0 && <OverBudgetBanner overBy={derived.overBy} onShowChoices={showChoices} />}

      <div className="card plan-tabs" ref={tabsRef}>
        <SectionNav
          sections={tabs.map(({ id, label }) => ({ id, label }))}
          active={current}
          onPick={goTo}
          actions={navActions}
        />
        <SectionPanels tabs={tabs} current={current} />
      </div>

      {bloomItem && (
        <Bloom
          key={bloomItem.id}
          message={bloomMessage(bloomItem, bloomIndex)}
          petal={Math.max(1, petals)}
          onDone={finishBloom}
        />
      )}
    </article>
  );
}
