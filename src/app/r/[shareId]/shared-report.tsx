"use client";

import { Download, Printer } from "lucide-react";
import { downloadPdf } from "@/components/report/pdf";
import { ReportView, type ReportData } from "@/components/report/report-view";
import { Button, ButtonLink } from "@/components/ui";

export function SharedReport({ data }: { data: ReportData }) {
  return (
    <ReportView
      data={data}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={() => downloadPdf(data)}>
            <Download size={15} aria-hidden /> PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer size={15} aria-hidden /> Print
          </Button>
          <ButtonLink href="/value" size="sm">
            Value your balloon
          </ButtonLink>
        </>
      }
    />
  );
}
