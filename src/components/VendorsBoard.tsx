"use client";

import { useState } from "react";
import type { ScheduledItem } from "@/lib/schedule";
import type { Plan } from "@/lib/schemas";
import { currentStep, vendorGroups, vendorSummary, type VendorStep } from "@/lib/vendorSummary";
import type { TaskState } from "./plan/types";
import type { DealState } from "./VendorDeal";
import { useVendorSelection } from "./vendors/useVendorSelection";
import { Detail } from "./vendors/VendorDetail";
import { Group } from "./vendors/VendorList";
import { Summary } from "./vendors/VendorSummaryCard";

/**
 * Vendors: a short summary, then two groups ("To book", "Booked") of one-line
 * rows. Tapping a vendor opens it with three steps: Ask vendors → Compare
 * quotes → Book. On phones the vendor opens in place of the list; on wider
 * screens the list stays on the left and the vendor shows on the right.
 */

export function VendorsSection({
  items,
  plan,
  state,
  deals,
}: {
  items: ScheduledItem[];
  plan: Plan;
  state: TaskState;
  /** Quotes and bookings. Left out where the plan is read-only. */
  deals?: DealState;
}) {
  const summary = vendorSummary(items, plan, deals?.deals ?? {}, state.done);
  const shownIds = new Set(
    items.filter((item) => !state.viewer || state.assignments[item.id] === state.viewer).map((i) => i.id),
  );
  const rows = summary.rows.filter((r) => shownIds.has(r.id));
  const groups = vendorGroups(rows);

  const { open, selected, rowRefs, headingRef, openVendor, back } = useVendorSelection(rows, groups);
  const [steps, setSteps] = useState<Record<string, VendorStep>>({});
  const index = items.findIndex((i) => i.id === selected);
  const selectedRow = rows.find((r) => r.id === selected);

  return (
    <>
      <h2 className="section-title">Vendors</h2>
      {rows.length === 0 ? (
        <p className="muted">No vendors for this person yet.</p>
      ) : (
        <div className={`vb${open && selectedRow ? " is-open" : ""}`}>
          <Summary s={summary} onOpen={openVendor} />
          <div className="vb-cols">
            <div className="vb-lists">
              <Group title="To book" rows={groups.toBook} selected={selected} onOpen={openVendor} rowRefs={rowRefs} />
              <Group title="Booked" rows={groups.booked} selected={selected} onOpen={openVendor} rowRefs={rowRefs} />
            </div>
            {selectedRow && index >= 0 && (
              <Detail
                key={selected}
                row={selectedRow}
                item={items[index]}
                vendor={plan.vendors[index]}
                state={state}
                deals={deals}
                step={steps[selected] ?? currentStep(selectedRow)}
                onStep={(s) => setSteps((prev) => ({ ...prev, [selected]: s }))}
                onBack={back}
                headingRef={headingRef}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
