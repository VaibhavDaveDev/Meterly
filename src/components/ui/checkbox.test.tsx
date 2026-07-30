import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("renders an unchecked checkbox by default", () => {
    render(<Checkbox aria-label="agree" />);
    const checkbox = screen.getByRole("checkbox", { name: /agree/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it("renders as checked when the checked prop is true", () => {
    render(<Checkbox aria-label="agree" checked readOnly />);
    const checkbox = screen.getByRole("checkbox", { name: /agree/i });
    expect(checkbox).toBeChecked();
  });

  it("calls onCheckedChange with true when an unchecked box is clicked", () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="agree" onCheckedChange={onCheckedChange} />);

    const checkbox = screen.getByRole("checkbox", { name: /agree/i });
    fireEvent.click(checkbox);

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("calls onCheckedChange with false when a checked box is clicked", () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox
        aria-label="agree"
        defaultChecked
        onCheckedChange={onCheckedChange}
      />
    );

    const checkbox = screen.getByRole("checkbox", { name: /agree/i });
    fireEvent.click(checkbox);

    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it("respects the disabled prop", () => {
    render(<Checkbox aria-label="agree" disabled />);
    const checkbox = screen.getByRole("checkbox", { name: /agree/i });
    expect(checkbox).toBeDisabled();
  });

  it("forwards the ref to the underlying input element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Checkbox aria-label="agree" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.type).toBe("checkbox");
  });

  it("merges a custom className with the default styles", () => {
    render(<Checkbox aria-label="agree" className="custom-class" />);
    const checkbox = screen.getByRole("checkbox", { name: /agree/i });
    expect(checkbox.className).toContain("custom-class");
    expect(checkbox.className).toContain("peer");
  });

  it("does not throw when onCheckedChange is not provided", () => {
    render(<Checkbox aria-label="agree" />);
    const checkbox = screen.getByRole("checkbox", { name: /agree/i });
    expect(() => fireEvent.click(checkbox)).not.toThrow();
  });
});
