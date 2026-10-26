import type { Metadata } from "next";
import { ClientOnly } from "@/components/ClientOnly";
import { GuestReply } from "@/components/GuestReply";

export const metadata: Metadata = {
  title: "You're invited – Shubā",
  robots: { index: false, follow: false },
};

/** The page guests open from the reply link. */
export default async function GuestReplyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <ClientOnly
      fallback={
        <p className="loading">
          <span className="spinner" aria-hidden="true" /> Loading the invitation…
        </p>
      }
    >
      <GuestReply token={token} />
    </ClientOnly>
  );
}
