import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProgressStepper from "../components/ProgressStepper";

// Mock the useWindowWidth hook so we can control desktop vs mobile
jest.mock("../hooks/useWindowWidth");
import useWindowWidth from "../hooks/useWindowWidth";

function renderDesktop({ current = 0, maxVisited = 0, onTabClick = jest.fn() } = {}) {
  useWindowWidth.mockReturnValue(1024); // wider than 640 breakpoint
  return render(<ProgressStepper current={current} maxVisited={maxVisited} onTabClick={onTabClick} />);
}

function renderMobile({ current = 0, maxVisited = 0, onTabClick = jest.fn() } = {}) {
  useWindowWidth.mockReturnValue(375); // narrower than 640 breakpoint
  return render(<ProgressStepper current={current} maxVisited={maxVisited} onTabClick={onTabClick} />);
}

// ============================================================
// Desktop view
// ============================================================

describe("ProgressStepper — desktop", () => {
  it("renders all 4 phase labels", () => {
    renderDesktop();
    expect(screen.getByText("Scout")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Tailor")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("step 1 (index 0) has 'current' class when current=0", () => {
    const { container } = renderDesktop({ current: 0 });
    const dots = container.querySelectorAll(".step-dot");
    expect(dots[0].className).toContain("current");
  });

  it("future steps do not have current class", () => {
    const { container } = renderDesktop({ current: 0 });
    const dots = container.querySelectorAll(".step-dot");
    expect(dots[1].className).toContain("future");
    expect(dots[2].className).toContain("future");
    expect(dots[3].className).toContain("future");
  });

  it("completed steps have 'done' class", () => {
    const { container } = renderDesktop({ current: 2, maxVisited: 2 });
    const dots = container.querySelectorAll(".step-dot");
    expect(dots[0].className).toContain("done");
    expect(dots[1].className).toContain("done");
    expect(dots[2].className).toContain("current");
  });

  it("completed steps show checkmark", () => {
    const { container } = renderDesktop({ current: 2, maxVisited: 2 });
    const dots = container.querySelectorAll(".step-dot");
    expect(dots[0].textContent).toBe("\u2713");
    expect(dots[1].textContent).toBe("\u2713");
  });

  it("future steps show their 1-based number", () => {
    const { container } = renderDesktop({ current: 0 });
    const dots = container.querySelectorAll(".step-dot");
    expect(dots[1].textContent).toBe("2");
    expect(dots[2].textContent).toBe("3");
    expect(dots[3].textContent).toBe("4");
  });

  it("clicking a visited step calls onTabClick with the step index", async () => {
    const user = userEvent.setup();
    const onTabClick = jest.fn();
    const { container } = renderDesktop({ current: 2, maxVisited: 2, onTabClick });
    const dots = container.querySelectorAll(".step-dot");
    await user.click(dots[0]); // Scout (visited)
    expect(onTabClick).toHaveBeenCalledWith(0);
  });

  it("clicking an unvisited step does not call onTabClick", async () => {
    const user = userEvent.setup();
    const onTabClick = jest.fn();
    const { container } = renderDesktop({ current: 0, maxVisited: 0, onTabClick });
    const dots = container.querySelectorAll(".step-dot");
    await user.click(dots[3]); // Complete (unvisited)
    expect(onTabClick).not.toHaveBeenCalled();
  });

  it("unvisited steps have 'no-click' class", () => {
    const { container } = renderDesktop({ current: 0, maxVisited: 0 });
    const dots = container.querySelectorAll(".step-dot");
    expect(dots[1].className).toContain("no-click");
    expect(dots[2].className).toContain("no-click");
    expect(dots[3].className).toContain("no-click");
  });

  it("step lines between done steps have 'done' class", () => {
    const { container } = renderDesktop({ current: 2, maxVisited: 2 });
    const lines = container.querySelectorAll(".step-line");
    expect(lines[0].className).toContain("done"); // Scout → Review
    expect(lines[1].className).toContain("done"); // Review → Tailor
    expect(lines[2].className).toContain("future"); // Tailor → Complete
  });
});

// ============================================================
// Mobile view
// ============================================================

describe("ProgressStepper — mobile", () => {
  it("renders 'Step X of 4: PhaseName' format", () => {
    renderMobile({ current: 0 });
    expect(screen.getByText("Step 1 of 4: Scout")).toBeInTheDocument();
  });

  it("shows correct phase name for each step", () => {
    const phases = ["Scout", "Review", "Tailor", "Complete"];
    phases.forEach((name, i) => {
      const { unmount } = renderMobile({ current: i });
      expect(screen.getByText(`Step ${i + 1} of 4: ${name}`)).toBeInTheDocument();
      unmount();
    });
  });

  it("does not render step dots in mobile view", () => {
    const { container } = renderMobile({ current: 0 });
    expect(container.querySelectorAll(".step-dot")).toHaveLength(0);
  });

  it("uses progress-mobile class on mobile", () => {
    const { container } = renderMobile({ current: 1 });
    expect(container.querySelector(".progress-mobile")).toBeInTheDocument();
  });
});
