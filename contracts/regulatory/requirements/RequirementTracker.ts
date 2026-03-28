// SPDX-License-Identifier: MIT
// Tracks regulatory requirements for multiple bodies/jurisdictions

import {
  Requirement,
  RegulatoryBody,
  Jurisdiction,
} from "../interfaces/IRegulatoryReporting";

export class RequirementTracker {
  private requirements: Map<string, Requirement> = new Map();

  addRequirement(requirement: Requirement) {
    this.requirements.set(requirement.id, requirement);
  }

  updateRequirement(requirementId: string, updates: Partial<Requirement>) {
    const req = this.requirements.get(requirementId);
    if (req) {
      this.requirements.set(requirementId, { ...req, ...updates });
    }
  }

  removeRequirement(requirementId: string) {
    this.requirements.delete(requirementId);
  }

  getRequirementsByBodyAndJurisdiction(
    body: RegulatoryBody,
    jurisdiction: Jurisdiction,
  ): Requirement[] {
    return Array.from(this.requirements.values()).filter(
      (r) => r.regulatoryBody === body && r.jurisdiction === jurisdiction,
    );
  }

  getAllRequirements(): Requirement[] {
    return Array.from(this.requirements.values());
  }
}
