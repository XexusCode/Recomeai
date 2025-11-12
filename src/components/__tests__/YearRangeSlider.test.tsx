import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { YearRangeSlider } from "@/components/YearRangeSlider";

describe("YearRangeSlider", () => {
  it("updates minimum year via keyboard", async () => {
    const handleChange = vi.fn();
    render(<YearRangeSlider value={[null, null]} onChange={handleChange} />);

    const [minThumb] = screen.getAllByRole("slider");
    minThumb.focus();
    const user = userEvent.setup();
    await user.keyboard("{ArrowRight}");

    expect(handleChange).toHaveBeenCalledWith([1961, null]);
  });

  it("limits values within range and reports labels", () => {
    const handleChange = vi.fn();
    render(<YearRangeSlider value={[2000, 2010]} onChange={handleChange} min={1980} max={2024} />);

    const thumbs = screen.getAllByRole("slider");
    expect(thumbs[0]).toHaveAttribute("aria-valuenow", "2000");
    expect(thumbs[1]).toHaveAttribute("aria-valuenow", "2010");
    expect(screen.getByText(/minimum year: 2000/i)).toBeInTheDocument();
    expect(screen.getByText(/maximum year: 2010/i)).toBeInTheDocument();
  });
});
