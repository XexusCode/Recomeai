import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PopularitySlider } from "@/components/PopularitySlider";

describe("PopularitySlider", () => {
  it("announces no minimum and increments with keyboard", async () => {
    const handleChange = vi.fn();
    render(<PopularitySlider value={null} onChange={handleChange} />);

    const slider = screen.getByRole("slider", { name: /minimum popularity/i });
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText(/no minimum/i)).toBeInTheDocument();

    slider.focus();
    const user = userEvent.setup();
    await user.keyboard("{ArrowRight}");

    expect(handleChange).toHaveBeenCalledWith(1);
  });

  it("clears the minimum when the button is clicked", async () => {
    const handleChange = vi.fn();
    render(<PopularitySlider value={42} onChange={handleChange} />);

    const clearButton = screen.getByRole("button", { name: /clear minimum/i });
    const user = userEvent.setup();
    await user.click(clearButton);

    expect(handleChange).toHaveBeenCalledWith(null);
  });
});
