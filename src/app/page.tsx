import { ClientOnly } from "@/components/ClientOnly";
import { Planner } from "@/components/Planner";

export default function Home() {
  return (
    <>
      <h1 className="hero">
        Your celebration, <span className="accent-word">planned.</span>
      </h1>
      <p className="lead">
        Weddings, birthdays, poojas, festivals or community events. Just tell Shubā about it in a voice note and get a
        budget, timeline, vendor checklist and ideas in seconds.
      </p>
      <ClientOnly fallback={<div className="card skeleton" aria-hidden="true" />}>
        <Planner />
      </ClientOnly>
    </>
  );
}
