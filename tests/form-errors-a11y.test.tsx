// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { FunctionsList } from "@/components/traditions/FunctionsList";
import { QuoteForm } from "@/components/vendors/QuoteForm";

async function violations(container: HTMLElement) {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.map((v) => v.id);
}

describe("field errors are linked to their controls", () => {
  it("QuoteForm links every error, including phone and includes", async () => {
    const errors = {
      vendorName: "Please enter a name",
      amount: "Please enter a price",
      phone: "Please check the phone number",
      includes: "Too long",
    };
    const { container } = render(
      <QuoteForm
        uid="q"
        form={{ vendorName: "", phone: "abc", amount: "", includes: "x" }}
        errors={errors}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Phone (optional)")).toHaveAccessibleDescription(errors.phone);
    expect(screen.getByLabelText(/included/)).toHaveAccessibleDescription(errors.includes);
    expect(screen.getByLabelText("Vendor name")).toHaveAccessibleDescription(errors.vendorName);
    expect(await violations(container)).toEqual([]);
  });

  it("QuoteForm adds no description when there is no error", () => {
    render(
      <QuoteForm
        uid="q"
        form={{ vendorName: "", phone: "", amount: "", includes: "" }}
        errors={{}}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Phone (optional)")).not.toHaveAttribute("aria-describedby");
    expect(screen.getByLabelText(/included/)).not.toHaveAttribute("aria-describedby");
  });

  it("FunctionsList links the group error to the fieldset and the checkboxes", async () => {
    const props = {
      id: "t",
      names: ["Mehendi", "Sangeet"],
      functions: [],
      days: 2,
      custom: "",
      customError: "",
      setCustom: vi.fn(),
      addCustom: vi.fn(),
      toggleFunction: vi.fn(),
      moveFunction: vi.fn(),
    };
    const error = "Please pick at least one function";
    const { container, rerender } = render(<FunctionsList {...props} error={error} />);
    expect(screen.getByRole("group", { name: "Functions" })).toHaveAccessibleDescription(error);
    expect(screen.getByRole("checkbox", { name: "Mehendi" })).toHaveAccessibleDescription(
      expect.stringContaining(error),
    );
    expect(await violations(container)).toEqual([]);

    rerender(<FunctionsList {...props} error={undefined} />);
    expect(screen.getByRole("group", { name: "Functions" })).not.toHaveAttribute("aria-describedby");
    expect(screen.getByRole("checkbox", { name: "Mehendi" })).not.toHaveAccessibleDescription(
      expect.stringContaining(error),
    );
  });
});
