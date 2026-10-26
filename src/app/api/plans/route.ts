import { handleJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { DoneSchema, makeSharedContentSchema, pruneState } from "@/lib/team";

export const runtime = "nodejs";

/** Saves a plan so it can be shared with the team. Returns its secret id. */
export async function POST(request: Request) {
  return handleJson(
    request,
    makeSharedContentSchema().extend({ done: DoneSchema.default({}) }),
    async ({ done: ticked, ...content }) => {
      const { assignments, done } = pruneState(content.plan, content.team, content.assignments, ticked);
      const saved = await getStore().create({ ...content, assignments }, done);
      return { id: saved.id };
    },
    { maxBytes: 256_000, kind: "data" },
  );
}
