"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export function ApproveButton({ manufacturer, adjustment, sampleSize }: { manufacturer: string; adjustment: number; sampleSize: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Create a new pricing version with a ${manufacturer} adjustment of ×${adjustment.toFixed(2)}?`)) return;
        setBusy(true);
        await fetch("/api/admin/calibration/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ manufacturer, adjustment, sampleSize }) });
        setBusy(false);
        router.refresh();
      }}
    >
      Approve
    </Button>
  );
}
