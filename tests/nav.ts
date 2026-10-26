import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** Labels on the navigation bar; everything else is in the menu. */
const ON_BAR: Record<string, string> = { Home: "Home", Budget: "Budget", Timeline: "Tasks", Guests: "Guests" };

/** Opens a plan section the way a person would: from the bar, or from the ☰ menu. */
export async function openSection(name: string): Promise<void> {
  const nav = within(screen.getByRole("navigation", { name: "Plan sections" }));
  if (ON_BAR[name]) {
    await userEvent.click(nav.getByRole("button", { name: ON_BAR[name] }));
    return;
  }
  await userEvent.click(nav.getByRole("button", { name: "Menu" }));
  await userEvent.click(nav.getByRole("button", { name }));
}

/** The plan section on screen now. */
export function currentSection(): HTMLElement {
  const el = document.querySelector<HTMLElement>(".section-panel:not([hidden])");
  if (!el) throw new Error("No plan section is open");
  return el;
}

/** Runs a page action (Edit details, Download PDF, My events…) from the ☰ menu. */
export async function menuAction(name: string | RegExp): Promise<void> {
  const nav = within(screen.getByRole("navigation", { name: "Plan sections" }));
  await userEvent.click(nav.getByRole("button", { name: "Menu" }));
  await userEvent.click(nav.getByRole("button", { name }));
}
