// SPDX-License-Identifier: MIT
// Interface for RegulatoryReporting contract

// Types for requirements, reports, and jurisdictions
export type RegulatoryBody = string;
export type Jurisdiction = string;
export type Requirement = {
  id: string;
  description: string;
  effectiveDate: string;
  expiryDate?: string;
  regulatoryBody: RegulatoryBody;
  jurisdiction: Jurisdiction;
};

export type ComplianceReport = {
  id: string;
  period: string;
  generatedAt: string;
  requirements: Requirement[];
  data: any;
  formatted: string;
  submitted: boolean;
};

export interface IRegulatoryReporting {
  generateReport(period: string): Promise<ComplianceReport>;
  trackRequirement(requirement: Requirement): void;
  updateRequirement(requirementId: string, updates: Partial<Requirement>): void;
  removeRequirement(requirementId: string): void;
  collectComplianceData(): Promise<any>;
  formatReport(report: ComplianceReport, standard: string): string;
  submitReport(reportId: string): Promise<boolean>;
  getHistoricalReports(
    period?: string,
    jurisdiction?: Jurisdiction,
  ): Promise<ComplianceReport[]>;
  getAuditData(reportId: string): Promise<any>;
}
