// SPDX-License-Identifier: MIT
// Utility library for report formatting and helpers

export class ReportingLib {
  /**
   * Formats report data according to the given regulatory standard.
   * Supports multiple standards (e.g., JSON, XML, CSV, custom formats).
   */
  static formatToStandard(reportData: any, standard: string): string {
    switch (standard.toLowerCase()) {
      case "json":
        return JSON.stringify(reportData, null, 2);
      case "csv":
        // Simple CSV conversion for demonstration
        if (Array.isArray(reportData)) {
          const keys = Object.keys(reportData[0] || {});
          const rows = reportData.map((row: any) =>
            keys.map((k) => row[k]).join(","),
          );
          return [keys.join(","), ...rows].join("\n");
        }
        return "";
      case "xml":
        // Placeholder for XML formatting
        return `<report>${JSON.stringify(reportData)}</report>`;
      default:
        // Default to JSON
        return JSON.stringify(reportData);
    }
  }
}
