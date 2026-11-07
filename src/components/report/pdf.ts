"use client";

import { formatUsd } from "@/lib/engine/math";
import { DISCLAIMER } from "@/components/site/disclaimer";
import { CLASSIFICATION_LABEL, CONFIDENCE_LABEL, detailSections, PROVENANCE_LABEL, reportTitle, SCOPE_LABEL } from "./labels";
import type { ReportData } from "./report-view";

const NAVY: [number, number, number] = [18, 36, 63];
const MUTED: [number, number, number] = [90, 101, 118];
const FLAME: [number, number, number] = [192, 95, 42];
const GOLD: [number, number, number] = [169, 134, 82];
const LINE: [number, number, number] = [221, 213, 195];

/** Builds a professional PDF report in the browser. No server or paid API involved. */
export async function downloadPdf(data: ReportData) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const r = data.result;
  const input = data.input;
  let y = 0;

  const footer = () => {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(...LINE);
      doc.line(M, H - 40, W - M, H - 40);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`Balloon Bluebook · ${data.referenceNumber} · Configuration v${data.configVersion} · Engine ${data.engineVersion}`, M, H - 26);
      doc.text(`Page ${i} of ${pages}`, W - M, H - 26, { align: "right" });
    }
  };

  const ensure = (needed: number) => {
    if (y + needed > H - 60) {
      doc.addPage();
      y = M;
    }
  };

  const heading = (text: string) => {
    ensure(40);
    y += 18;
    doc.setFont("times", "normal");
    doc.setFontSize(15);
    doc.setTextColor(...NAVY);
    doc.text(text, M, y);
    y += 8;
    doc.setDrawColor(...LINE);
    doc.line(M, y, W - M, y);
    y += 14;
  };

  const para = (text: string, size = 9.5, color: [number, number, number] = NAVY) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, W - 2 * M) as string[];
    for (const l of lines) {
      ensure(size + 4);
      doc.text(l, M, y);
      y += size + 3.5;
    }
  };

  const row = (left: string, right: string, opts: { bold?: boolean; sub?: string } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(9.5);
    const leftLines = doc.splitTextToSize(left, W - 2 * M - 120) as string[];
    ensure(leftLines.length * 13 + (opts.sub ? 12 : 0) + 4);
    doc.setTextColor(...NAVY);
    leftLines.forEach((l, i) => doc.text(l, M, y + i * 12));
    doc.text(right, W - M, y, { align: "right" });
    y += leftLines.length * 12;
    if (opts.sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      const subLines = doc.splitTextToSize(opts.sub, W - 2 * M - 120) as string[];
      subLines.forEach((l) => {
        doc.text(l, M, y);
        y += 10;
      });
    }
    y += 4;
    doc.setDrawColor(...LINE);
    doc.line(M, y - 1, W - M, y - 1);
    y += 9;
  };

  // Header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 78, "F");
  doc.setFillColor(...FLAME);
  doc.rect(M, 52, 18, 3, "F");
  doc.setFont("times", "normal");
  doc.setFontSize(20);
  doc.setTextColor(246, 242, 232);
  doc.text("Balloon Bluebook", M, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Valuation report", W - M, 30, { align: "right" });
  doc.text(data.referenceNumber, W - M, 44, { align: "right" });
  doc.text(new Date(r.valuationDate).toLocaleDateString("en-US", { dateStyle: "long" }), W - M, 58, { align: "right" });

  y = 116;
  doc.setFont("times", "normal");
  doc.setFontSize(22);
  doc.setTextColor(...NAVY);
  doc.text(reportTitle(input), M, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(SCOPE_LABEL[input.scope], M, y);

  // Value block
  y += 30;
  doc.setDrawColor(...LINE);
  doc.setFillColor(250, 248, 243);
  doc.roundedRect(M, y, W - 2 * M, 112, 6, 6, "FD");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text("Estimated fair market value", M + 18, y + 24);
  doc.setFont("times", "normal");
  doc.setFontSize(34);
  doc.setTextColor(...NAVY);
  doc.text(formatUsd(r.fairMarketValueCents), M + 18, y + 60);
  const cols = [
    ["Selling range", r.fairMarketValueCents > 0 ? `${formatUsd(r.rangeLowCents)} to ${formatUsd(r.rangeHighCents)}` : "None"],
    ["Recommended listing", r.listingPriceCents > 0 ? `${formatUsd(r.listingPriceCents)}${r.listingProvisional ? " (provisional)" : ""}` : "Not recommended"],
    ["Confidence", `${CONFIDENCE_LABEL[r.confidence]} (±${Math.round(r.confidenceRangePct * 100)}%)`],
  ];
  const colW = (W - 2 * M - 36) / 3;
  cols.forEach(([k, v], i) => {
    const x = M + 18 + i * colW;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(k, x, y + 84);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(v, x, y + 98);
  });
  y += 132;

  if (r.legacyMessage || r.brandMessage || r.policies.length) {
    heading("Resale policy applied");
    if (r.legacyMessage) para(r.legacyMessage);
    if (r.brandMessage && r.brandMessage !== r.legacyMessage) para(r.brandMessage);
    for (const p of r.policies) para(p.message, 8.5, MUTED);
    if (r.separateComponentValueCents !== null) para(`Reusable hardware is worth about ${formatUsd(r.separateComponentValueCents)} on its own, shown separately from the system value.`);
    para("Resale policies are commercial valuation preferences, not regulatory restrictions or airworthiness findings.", 8, MUTED);
  }

  if (r.asking) {
    const a = r.asking;
    heading("Asking price comparison");
    row("Seller asking", formatUsd(a.askingCents));
    row("Estimated fair value", formatUsd(a.fairValueCents));
    row("Difference", `${a.differenceCents >= 0 ? "+" : "-"}${formatUsd(Math.abs(a.differenceCents))}${a.percent !== null ? ` (${a.percent >= 0 ? "+" : ""}${a.percent.toFixed(1)}%)` : ""}`);
    row("Classification", CLASSIFICATION_LABEL[a.classification], { bold: true });
    if (a.classification !== "not_applicable") row("Suggested negotiation range", `${formatUsd(a.negotiationLowCents)} to ${formatUsd(a.negotiationHighCents)}`);
    para(a.message, 9, MUTED);
  }

  heading("Component valuations");
  for (const c of r.components) {
    const sub = [PROVENANCE_LABEL[c.provenance], ...(c.lines?.map((l) => `${l.label}: ${formatUsd(l.displayCents)}`) ?? [])].join(" · ");
    row(c.label, formatUsd(c.displayCents), { sub });
  }
  row("Calculated total", formatUsd(Math.round(r.adjustedTotalCents / 5000) * 5000), { bold: true });
  if (r.policies.length) row("After resale policy", formatUsd(r.fairMarketValueCents), { bold: true });

  heading("Valuation methodology");
  for (const c of r.components) {
    ensure(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...NAVY);
    doc.text(c.label, M, y);
    y += 13;
    for (const s of c.steps) {
      const label = `${s.label}${s.kind === "multiply" && s.factor !== undefined ? `  ×${Number(s.factor.toFixed(4))}` : ""}`;
      row(label, s.kind === "info" ? "" : formatUsd(s.valueCents, { cents: true }), { sub: s.detail });
    }
  }
  para(
    "Components are summed at full precision, any configured market adjustment is applied, then resale policies. The fair market value is rounded to the nearest $50. The listing price adds the configured listing markup, rounded to the nearest $100, and never exceeds an applicable policy maximum.",
    8.5,
    MUTED,
  );

  const flags = r.flags;
  if (flags.length) {
    heading("Assumptions and limitations");
    for (const f of flags) {
      const tag = f.severity === "critical" ? "Needs input" : f.severity === "assumption" ? "Assumption" : "Note";
      para(`${tag}: ${f.message}`, 9, f.severity === "critical" ? FLAME : NAVY);
      y += 2;
    }
  }
  para("Logbooks are assumed complete for pricing and are not verified by this report. Range percentages reflect modeling uncertainty, not statistical confidence intervals.", 8.5, MUTED);

  heading("Equipment details");
  for (const s of detailSections(input)) {
    ensure(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...GOLD);
    doc.text(s.title, M, y);
    y += 13;
    for (const [k, v] of s.rows) row(k, String(v).length > 48 ? "" : String(v), String(v).length > 48 ? { sub: String(v) } : {});
  }

  heading("Disclaimer");
  para(DISCLAIMER, 8.5, MUTED);
  para(`Reference ${data.referenceNumber}. Pricing configuration version ${data.configVersion}, engine ${data.engineVersion}. Reproducible from these versions.`, 8, MUTED);

  footer();
  doc.save(`balloon-bluebook-${data.referenceNumber}.pdf`);
}
