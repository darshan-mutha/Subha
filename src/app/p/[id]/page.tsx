import type { Metadata } from "next";
import { ClientOnly } from "@/components/ClientOnly";
import { SharedPlanView } from "@/components/SharedPlanView";

export const metadata: Metadata = {
  title: "Our celebration plan – Shubā",
  robots: { index: false, follow: false },
};

export default async function SharedPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ClientOnly
      fallback={
        <p className="loading">
          <span className="spinner" aria-hidden="true" /> Loading your plan…
        </p>
      }
    >
      <SharedPlanView id={id} />
    </ClientOnly>
  );
}
