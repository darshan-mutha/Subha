"use client";

import { useCallback, useState } from "react";
import { loadBlooms, saveBlooms } from "@/lib/client";
import type { ScheduledItem } from "@/lib/schedule";

/** Milestone moments play once per device. On first view, milestones already done count as played. */
export function useBlooms(planKey: string, milestones: ScheduledItem[]) {
  const [played, setPlayed] = useState<string[]>(() => {
    const saved = loadBlooms(planKey);
    if (saved) return saved;
    const seeded = milestones.filter((m) => m.status === "done").map((m) => m.id);
    saveBlooms(planKey, seeded);
    return seeded;
  });
  const bloomIndex = milestones.findIndex((m) => m.status === "done" && !played.includes(m.id));
  const bloomItem = bloomIndex >= 0 ? milestones[bloomIndex] : null;
  const finishBloom = useCallback(() => {
    if (!bloomItem) return;
    setPlayed((list) => {
      const next = [...list, bloomItem.id];
      saveBlooms(planKey, next);
      return next;
    });
  }, [bloomItem, planKey]);
  return { bloomIndex, bloomItem, finishBloom };
}
