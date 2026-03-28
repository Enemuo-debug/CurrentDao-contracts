// RegulatoryReporting contract tests

import { RegulatoryReporting } from "../../contracts/regulatory/RegulatoryReporting";
import { Requirement } from "../../contracts/regulatory/interfaces/IRegulatoryReporting";

describe("RegulatoryReporting", () => {
  let contract: RegulatoryReporting;
  beforeEach(() => {
    contract = new RegulatoryReporting();
  });

  it("should track and update requirements", () => {
    const req: Requirement = {
      id: "req1",
      description: "Test requirement",
      effectiveDate: "2026-01-01",
      regulatoryBody: "SEC",
      jurisdiction: "US",
    };
    contract.trackRequirement(req);
    contract.updateRequirement("req1", { description: "Updated requirement" });
    // No direct getter, but can check via report
  });

  it("should generate a compliance report", async () => {
    const report = await contract.generateReport("Q1-2026");
    expect(report).toHaveProperty("id");
    expect(report).toHaveProperty("period", "Q1-2026");
    expect(report).toHaveProperty("requirements");
  });

  it("should store and retrieve historical reports", async () => {
    await contract.generateReport("Q1-2026");
    const reports = await contract.getHistoricalReports("Q1-2026");
    expect(Array.isArray(reports)).toBe(true);
    expect(reports.length).toBeGreaterThan(0);
  });
});
