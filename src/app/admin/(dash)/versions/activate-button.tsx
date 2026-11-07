"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export function ActivateButton({ version }: { version: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Make version ${version} the active pricing? New valuations will use it. Existing reports keep their own version.`)) return;
        setBusy(true);
        await fetch("/api/admin/config/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version }) });
        setBusy(false);
        router.refresh();
      }}
    >
      Make active
    </Button>
  );
}
