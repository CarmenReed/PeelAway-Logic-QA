// accessibility.test.jsx
//
// Automated a11y coverage for the user facing React surface.
//
// Vision impaired accessibility is the primary target of these tests. They
// use jest-axe (axe-core bindings for Jest) to catch common WCAG violations
// that affect screen reader users, keyboard-only users, and users relying on
// system magnification:
//
//   * image-alt         - every image has meaningful alt text or is marked decorative
//   * button-name       - every button has an accessible name
//   * link-name         - every link has an accessible name
//   * label             - every form control has an associated label
//   * aria-valid-attr   - ARIA attributes are spelled correctly
//   * aria-required-attr- required ARIA attributes are present
//   * role-img-alt      - SVGs with role="img" have aria-label or title
//   * list              - list items live inside proper list containers
//
// Color contrast (WCAG 1.4.3) cannot be verified in jsdom because it has no
// layout engine; that check lives in e2e/09-accessibility.spec.ts where
// Playwright drives a real browser. See docs/hci-audit/README.md.
//
// If the HCI audit flags an accessibility regression, these tests should
// have already failed. They are the dynamic counterpart to the static regex
// scan in scripts/hci-audit.js.

import React from "react";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

import Header from "../components/Header";
import JobCard from "../components/JobCard";
import GuideBar from "../components/GuideBar";
import Spinner from "../components/Spinner";
import ProgressStepper from "../components/ProgressStepper";
import AppliedTracker from "../components/AppliedTracker";
import LandingScreen from "../components/LandingScreen";
import CloudConnector from "../components/CloudConnector";
import ManualJobInput from "../components/ManualJobInput";

expect.extend(toHaveNoViolations);

// useWindowWidth is mocked so ProgressStepper renders its desktop layout
// deterministically.
jest.mock("../hooks/useWindowWidth", () => ({
  __esModule: true,
  default: () => 1024,
}));

// Rules we always enforce. Keeping this list explicit makes it obvious what
// "a11y regression" means in this codebase and prevents axe version bumps
// from silently adding or removing coverage.
const VISION_IMPAIRED_RULES = {
  "image-alt": { enabled: true },
  "button-name": { enabled: true },
  "link-name": { enabled: true },
  label: { enabled: true },
  "aria-valid-attr": { enabled: true },
  "aria-valid-attr-value": { enabled: true },
  "aria-required-attr": { enabled: true },
  "aria-required-children": { enabled: true },
  "aria-required-parent": { enabled: true },
  "role-img-alt": { enabled: true },
  "svg-img-alt": { enabled: true },
  list: { enabled: true },
  listitem: { enabled: true },
  "duplicate-id-aria": { enabled: true },
};

const axeOptions = {
  rules: VISION_IMPAIRED_RULES,
};

async function expectNoViolations(ui) {
  const { container } = render(ui);
  const results = await axe(container, axeOptions);
  expect(results).toHaveNoViolations();
}

describe("Vision impaired accessibility: static components", () => {
  it("Spinner has no a11y violations", async () => {
    await expectNoViolations(<Spinner />);
  });

  it("GuideBar has no a11y violations (without Start Over)", async () => {
    await expectNoViolations(<GuideBar emoji="!" text="Search for jobs to get started" />);
  });

  it("GuideBar has no a11y violations (with Start Over)", async () => {
    await expectNoViolations(
      <GuideBar emoji="!" text="Review the matches below" onStartOver={() => {}} />
    );
  });

  it("Header has no a11y violations (no click)", async () => {
    await expectNoViolations(<Header />);
  });

  it("Header has no a11y violations (clickable logo)", async () => {
    await expectNoViolations(<Header onLogoClick={() => {}} />);
  });
});

describe("Vision impaired accessibility: data display", () => {
  const baseJob = {
    title: "Senior Engineer",
    company: "Acme Corp",
    location: "Remote",
    total_score: 8.5,
    skills_fit: 4,
    level_fit: 5,
    reasoning: "Strong cloud match",
    key_tech_stack: ["React", "Node.js"],
    status: "Strong Match",
    salary_range: "$150k",
    url: "https://acme.example/jobs/123",
    jd_text: "Full stack role",
    date_posted: "2026-04-10",
    freshness_flag: "fresh",
  };

  it("JobCard has no a11y violations", async () => {
    await expectNoViolations(<JobCard job={baseJob} />);
  });

  it("JobCard has no a11y violations when selectable", async () => {
    await expectNoViolations(
      <JobCard job={baseJob} selectable selected={false} onToggle={() => {}} />
    );
  });

  it("AppliedTracker has no a11y violations (empty)", async () => {
    await expectNoViolations(
      <AppliedTracker appliedList={[]} onRemove={() => {}} onClear={() => {}} />
    );
  });

  it("AppliedTracker has no a11y violations (with entries)", async () => {
    const appliedList = [
      {
        title: "Senior Engineer",
        company: "Acme Corp",
        appliedDate: "2026-04-10T12:00:00Z",
        url: "https://acme.example/jobs/123",
      },
      {
        title: "Staff Engineer",
        company: "Globex",
        appliedDate: "2026-04-11T12:00:00Z",
      },
    ];
    await expectNoViolations(
      <AppliedTracker appliedList={appliedList} onRemove={() => {}} onClear={() => {}} />
    );
  });
});

describe("Vision impaired accessibility: navigation and flow", () => {
  it("ProgressStepper has no a11y violations (first step current)", async () => {
    await expectNoViolations(
      <ProgressStepper current={0} maxVisited={0} onTabClick={() => {}} />
    );
  });

  it("ProgressStepper has no a11y violations (mid pipeline)", async () => {
    await expectNoViolations(
      <ProgressStepper current={2} maxVisited={2} onTabClick={() => {}} />
    );
  });

  it("ProgressStepper exposes current step via aria-current", async () => {
    const { container } = render(
      <ProgressStepper current={1} maxVisited={1} onTabClick={() => {}} />
    );
    const currentEls = container.querySelectorAll('[aria-current="step"]');
    expect(currentEls).toHaveLength(1);
    expect(currentEls[0].textContent).toContain("2");
  });

  it("ProgressStepper clickable dots render as buttons", () => {
    const { container } = render(
      <ProgressStepper current={2} maxVisited={2} onTabClick={() => {}} />
    );
    const buttons = container.querySelectorAll("button.step-dot");
    // First 3 steps are visited, so they should all be buttons.
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    buttons.forEach((btn) => {
      expect(btn.getAttribute("aria-label")).toMatch(/Step \d of 4/);
    });
  });
});

describe("Vision impaired accessibility: landing and modals", () => {
  it("LandingScreen has no a11y violations", async () => {
    await expectNoViolations(
      <LandingScreen onStart={() => {}} demoMode={false} onDemoModeChange={() => {}} />
    );
  });

  it("LandingScreen has no a11y violations with demo mode on", async () => {
    await expectNoViolations(
      <LandingScreen onStart={() => {}} demoMode={true} onDemoModeChange={() => {}} />
    );
  });

  it("CloudConnector modal has no a11y violations when shown", async () => {
    await expectNoViolations(
      <CloudConnector show={true} onClose={() => {}} onConnectionChange={() => {}} />
    );
  });

  it("CloudConnector modal exposes dialog role and labelled heading", () => {
    const { container } = render(
      <CloudConnector show={true} onClose={() => {}} onConnectionChange={() => {}} />
    );
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(container.querySelector(`#${labelledBy}`)).not.toBeNull();
  });
});

describe("Vision impaired accessibility: forms", () => {
  it("ManualJobInput URL mode has no a11y violations", async () => {
    await expectNoViolations(
      <ManualJobInput
        profileText=""
        extractedProfile={{}}
        apiKey="test"
        onJobScored={() => {}}
        scoreRawJobs={async () => []}
      />
    );
  });
});
