// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanWorkspace } from "@/components/PlanWorkspace";
import { vendorWhatsApp } from "@/components/VendorDeal";
import type { LocalWorkspace } from "@/lib/client";
import type { SharedPlanContent } from "@/lib/team";
import { planStructure } from "@/lib/team";
import { baseInput, samplePlan } from "./fixtures";
import { currentSection, openSection } from "./nav";

const catererId = planStructure(samplePlan).vendors[0].id;

function Harness({ initial, onToggle }: { initial: LocalWorkspace; onToggle: (id: string, done: boolean) => void }) {
  const [data, setData] = useState(initial);
  return (
    <PlanWorkspace
      planKey="deals"
      data={data}
      shareUrl={null}
      onChange={async (c: Partial<SharedPlanContent>) => setData((d) => ({ ...d, ...c }))}
      onToggle={(id, done) => {
        onToggle(id, done);
        setData((d) => ({ ...d, done: { ...d.done, [id]: done } }));
      }}
      onShare={null}
      onEdit={null}
      onStartOver={vi.fn()}
      viewer=""
      onViewerChange={vi.fn()}
    />
  );
}

const start: LocalWorkspace = {
  input: baseInput,
  plan: samplePlan,
  timings: null,
  team: [],
  assignments: {},
  done: {},
};

async function openVendors() {
  const user = userEvent.setup();
  const toggle = vi.fn();
  render(<Harness initial={start} onToggle={toggle} />);
  await openSection("Vendors");
  const caterer = screen.getAllByRole("listitem").find((li) => li.className.includes("vendor card-inner"))!;
  return { user, toggle, caterer: within(caterer) };
}

async function addQuote(
  user: ReturnType<typeof userEvent.setup>,
  card: ReturnType<typeof within>,
  name: string,
  amount: string,
  phone = "",
) {
  await user.click(card.getByRole("button", { name: "+ Add a quote" }));
  await user.type(card.getByLabelText("Vendor name"), name);
  await user.type(card.getByLabelText("Quoted price (₹)"), amount);
  if (phone) await user.type(card.getByLabelText("Phone (optional)"), phone);
  await user.click(card.getByRole("button", { name: "Add quote" }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("vendor quotes, booking and agreement", () => {
  it("shows the vendor's budget and validates new quotes", async () => {
    const { user, caterer } = await openVendors();
    expect(caterer.getByText("₹20,000")).toBeInTheDocument();
    expect(caterer.getByText(/No quotes yet/)).toBeInTheDocument();
    await user.click(caterer.getByRole("button", { name: "+ Add a quote" }));
    await user.click(caterer.getByRole("button", { name: "Add quote" }));
    expect(caterer.getByText("Please enter the vendor's name")).toBeInTheDocument();
    expect(caterer.getByLabelText("Vendor name")).toHaveAttribute("aria-invalid", "true");
    await user.click(caterer.getByRole("button", { name: "Cancel" }));
    expect(caterer.queryByLabelText("Vendor name")).not.toBeInTheDocument();
  });

  it("compares quotes against the budget, cheapest first", async () => {
    const { user, caterer } = await openVendors();
    await addQuote(user, caterer, "Udupi Caterers", "26000");
    await addQuote(user, caterer, "Home Baker Co", "18000");
    const rows = caterer.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Home Baker Co");
    expect(rows[0]).toHaveTextContent("Lowest");
    expect(rows[0]).toHaveTextContent("₹2,000 under budget");
    expect(rows[1]).toHaveTextContent("₹6,000 over budget");
    await user.click(caterer.getByRole("button", { name: "Remove quote from Udupi Caterers" }));
    expect(caterer.queryByText("Udupi Caterers")).not.toBeInTheDocument();
  });

  it("books a quote, ticks the vendor, tracks the advance and updates the budget tab", async () => {
    const { user, toggle, caterer } = await openVendors();
    await addQuote(user, caterer, "Home Baker Co", "18000");
    await user.click(caterer.getByRole("button", { name: "Book Home Baker Co for ₹18,000" }));
    expect(toggle).toHaveBeenCalledWith(catererId, true);
    expect(caterer.getByText("Booked", { selector: ".badge" })).toBeInTheDocument();

    const advance = caterer.getByLabelText("Advance paid (₹)");
    await user.type(advance, "25000{Enter}");
    expect(caterer.getByRole("alert")).toHaveTextContent("can't be more than the agreed price");
    await user.clear(advance);
    await user.type(advance, "5000{Enter}");
    expect(caterer.getByText(/Balance due/)).toHaveTextContent("₹13,000");

    await openSection("Budget");
    const payments = within(currentSection()).getByText("Advance paid").closest("dl")!;
    expect(payments).toHaveTextContent("Booked₹18,000");
    expect(payments).toHaveTextContent("Advance paid₹5,000");
    expect(payments).toHaveTextContent("Balance due₹13,000");
    expect(payments).toHaveTextContent("Left in budget₹32,000");
    expect(screen.getByRole("columnheader", { name: "Booked" })).toBeInTheDocument();

    await openSection("Vendors");
    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    expect(toggle).toHaveBeenLastCalledWith(catererId, false);
  });

  it("drafts an editable agreement and offers WhatsApp and print", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ text: "BOOKING CONFIRMATION – CATERER\nTotal agreed price: ₹18,000", source: "ai" }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const print = vi.fn();
    vi.stubGlobal("print", print);
    const { user, caterer } = await openVendors();
    await addQuote(user, caterer, "Home Baker Co", "18000", "9845012345");
    await user.click(caterer.getByRole("button", { name: /^Book Home Baker Co/ }));
    await user.click(caterer.getByRole("button", { name: "Draft agreement" }));

    const box = await caterer.findByLabelText("Agreement draft (you can edit it)");
    expect(box).toHaveValue("BOOKING CONFIRMATION – CATERER\nTotal agreed price: ₹18,000");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/agreement");
    expect(body.quote.vendorName).toBe("Home Baker Co");
    expect(body.vendor.type).toBe("Caterer");

    const wa = caterer.getByRole("link", { name: /Send to Home Baker Co on WhatsApp/ });
    expect(wa.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/919845012345\?text=BOOKING/);

    await user.type(box, "\nEdited");
    await user.tab();
    expect(caterer.getByRole("button", { name: "Redraft agreement" })).toBeInTheDocument();

    await user.click(caterer.getByRole("button", { name: "Download PDF / Print" }));
    expect(print).toHaveBeenCalled();
    expect(document.body.dataset.print).toBe("agreement");
    window.dispatchEvent(new Event("afterprint"));
    expect(document.body.dataset.print).toBeUndefined();
  });

  it("shows an error when drafting fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Too many requests. Please wait a minute and try again." }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const { user, caterer } = await openVendors();
    await addQuote(user, caterer, "Home Baker Co", "18000");
    await user.click(caterer.getByRole("button", { name: /^Book Home Baker Co/ }));
    await user.click(caterer.getByRole("button", { name: "Draft agreement" }));
    await waitFor(() => expect(caterer.getByRole("alert")).toHaveTextContent("Too many requests"));
  });

  it("lets the host choose which budget line a vendor is paid from", async () => {
    const { user, caterer } = await openVendors();
    await user.selectOptions(caterer.getByLabelText("Paid from"), "Decor");
    expect(caterer.getByText("₹12,000")).toBeInTheDocument();
  });

  it("has no accessibility violations with quotes and a booking", async () => {
    const { user, caterer } = await openVendors();
    await addQuote(user, caterer, "Home Baker Co", "18000");
    await user.click(caterer.getByRole("button", { name: /^Book Home Baker Co/ }));
    const result = await axe.run(document.body, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});

describe("vendorWhatsApp", () => {
  it("adds +91 to 10-digit numbers and falls back to a plain share link", () => {
    expect(vendorWhatsApp("98450 12345", "hi")).toBe("https://wa.me/919845012345?text=hi");
    expect(vendorWhatsApp("+44 7700 900123", "hi")).toBe("https://wa.me/447700900123?text=hi");
    expect(vendorWhatsApp("", "hi")).toBe("https://wa.me/?text=hi");
  });
});
