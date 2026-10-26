import type { Metadata } from "next";
import { ClientOnly } from "@/components/ClientOnly";
import { SharedPlanView } from "@/components/SharedPlanView";

export const metadata: Metadata = {
  title: "Our celebration plan – Shubā",
  robots: { index: false, follow: false },
};

export default async function SharedPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  // Read here, not from the address bar: during an in-app move the bar may not have updated yet.
  const tab = query.tab === "guests" ? "guests" : undefined;
  const isNew = query.new !== undefined;
  return (
    <ClientOnly
      fallback={
        <p className="loading">
          <span className="spinner" aria-hidden="true" /> Loading your plan…
        </p>
      }
    >
      <SharedPlanView id={id} initialTab={tab} isNew={isNew} />
    </ClientOnly>
  );
}
