"use client";

import { useMemo } from "react";
import type { LocalWorkspace } from "@/lib/client";
import { bookedByLine, paymentSummary, pruneDeals } from "@/lib/deals";
import { progressOf } from "@/lib/palette";
import { overLines, totalOver } from "@/lib/savings/options";
import { pruneShifts } from "@/lib/delay";
import { doNext, milestoneItems, petalsFilled, schedule } from "@/lib/schedule";
import { todayIST } from "@/lib/dates";
import { planItems } from "@/lib/team";

/** Everything the plan screen works out from the saved plan: schedule, money and progress. */
export function usePlanDerived(data: LocalWorkspace, viewer: string) {
  const { input, plan, assignments, done } = data;
  const today = todayIST();
  const shifts = useMemo(
    () =>
      pruneShifts(
        data.shifts,
        planItems(plan).map((i) => i.id),
      ),
    [data.shifts, plan],
  );
  const scheduled = useMemo(
    () => schedule(plan, input.date, today, done, shifts),
    [plan, input.date, today, done, shifts],
  );
  const items = useMemo(() => [...scheduled.timeline.flat(), ...scheduled.vendors], [scheduled]);
  const upNext = useMemo(() => doNext(items, assignments, viewer), [items, assignments, viewer]);
  const vendorRefs = useMemo(
    () => scheduled.vendors.map((item, i) => ({ id: item.id, type: plan.vendors[i]?.type ?? item.label })),
    [scheduled.vendors, plan.vendors],
  );
  const deals = useMemo(
    () =>
      pruneDeals(
        data.deals,
        vendorRefs.map((v) => v.id),
      ),
    [data.deals, vendorRefs],
  );
  const payments = useMemo(() => paymentSummary(vendorRefs, deals), [vendorRefs, deals]);
  const bookedLines = useMemo(() => bookedByLine(vendorRefs, deals, plan.budget), [vendorRefs, deals, plan.budget]);
  const overList = useMemo(() => overLines(plan.budget, bookedLines), [plan.budget, bookedLines]);
  const overBy = totalOver(overList);

  // "Comes alive": colour grows with the share of tasks done.
  const doneCount = items.filter((i) => i.status === "done").length;
  const progress = progressOf(items.length, doneCount);
  const complete = items.length > 0 && progress === 1;
  const milestones = useMemo(() => milestoneItems(items), [items]);
  const petals = petalsFilled(milestones, progress);
  const milestonesDone = milestones.filter((m) => m.status === "done").length;

  return {
    today,
    shifts,
    scheduled,
    items,
    upNext,
    vendorRefs,
    deals,
    payments,
    bookedLines,
    overList,
    overBy,
    progress,
    complete,
    milestones,
    petals,
    milestonesDone,
  };
}

/** What usePlanDerived returns. */
export type PlanDerived = ReturnType<typeof usePlanDerived>;
