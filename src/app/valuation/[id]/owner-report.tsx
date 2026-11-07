"use client";

import { Check, Copy, Download, Link2, Pencil, Printer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { downloadPdf } from "@/components/report/pdf";
import { summaryText } from "@/components/report/labels";
import { ReportView, type ReportData } from "@/components/report/report-view";
import { Button, ButtonLink, Panel } from "@/components/ui";
import { getLocalValuation, getValuationCopy, removeLocalValuation, saveLocalValuation, saveValuationCopy, titleFor } from "@/lib/client/storage";
import type { PublicValuation } from "@/lib/services/valuations";

export function OwnerReport({ id, authEnabled, signedIn }: { id: string; authEnabled: boolean; signedIn: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<PublicValuation | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const headers = useCallback((): Record<string, string> => {
    const local = getLocalValuation(id);
    return local ? { "x-edit-token": local.editToken } : {};
  }, [id]);

  useEffect(() => {
    fetch(`/api/valuations/${id}`, { headers: headers() })
      .then(async (res) => {
        if (!res.ok) throw new Error("not found");
        const body = await res.json();
        setV(body.valuation);
        saveValuationCopy(id, body.valuation);
        setState("ready");
      })
      .catch(() => {
        // Fall back to the copy saved in this browser when the server record is unavailable.
        const copy = getValuationCopy<PublicValuation>(id);
        if (copy) {
          setV(copy);
          setOffline(true);
          setState("ready");
        } else setState("missing");
      });
  }, [id, headers]);

  const shareUrl = v?.shareId ? `${window.location.origin}/r/${v.shareId}` : null;

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setMessage("Copying is blocked in this browser. Select the text and copy it manually.");
    }
  }

  async function toggleShare(enabled: boolean) {
    setBusy(true);
    const res = await fetch(`/api/valuations/${id}/share`, { method: "POST", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
    setBusy(false);
    if (res.ok) {
      const body = await res.json();
      setV(body.valuation);
      setMessage(enabled ? "Share link created. Anyone with the link can view this report." : "Share link turned off. The old link no longer works.");
    } else setMessage("The share setting could not be changed. Try again.");
  }

  async function saveToAccount() {
    setBusy(true);
    const res = await fetch(`/api/valuations/${id}/claim`, { method: "POST", headers: headers() });
    setBusy(false);
    setMessage(res.ok ? "Saved to your account." : "Sign in first to save this valuation to your account.");
  }

  async function remove() {
    if (!confirm("Delete this valuation? This removes it permanently, including any share link.")) return;
    setBusy(true);
    const res = await fetch(`/api/valuations/${id}`, { method: "DELETE", headers: headers() });
    setBusy(false);
    if (res.ok) {
      removeLocalValuation(id);
      router.push("/account");
    } else setMessage("The valuation could not be deleted.");
  }

  useEffect(() => {
    if (v) {
      const local = getLocalValuation(id);
      if (local) saveLocalValuation({ ...local, title: titleFor(v.input), fairMarketValueCents: v.result.fairMarketValueCents });
    }
  }, [v, id]);

  if (state === "loading") return <p className="mx-auto max-w-5xl px-6 py-20 text-muted">Loading your valuation…</p>;
  if (state === "missing" || !v)
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-3xl">Valuation not available</h1>
        <p className="mt-3 text-muted">
          Private valuations open only in the browser that created them, or in your account once saved. If someone sent you a link, ask them to turn on sharing.
        </p>
        <ButtonLink href="/value" className="mt-8">
          Start a new valuation
        </ButtonLink>
      </div>
    );

  const data: ReportData = { ...v };

  return (
    <ReportView
      data={data}
      banner={
        <Panel className="no-print mb-6 flex flex-col gap-3 bg-paper p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[0.92rem]">
            <span className="font-medium">This report is private.</span>{" "}
            <span className="text-muted">
              {offline
                ? "Showing the copy saved in this browser. Sharing needs the saved server record."
                : v.isShared
                  ? "Sharing is on."
                  : "Only you can see it until you create a share link."}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {v.isShared && shareUrl ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => copy(shareUrl, "link")}>
                  {copied === "link" ? <Check size={15} aria-hidden /> : <Link2 size={15} aria-hidden />}
                  {copied === "link" ? "Link copied" : "Copy share link"}
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => toggleShare(false)}>
                  Turn off sharing
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => toggleShare(true)}>
                <Link2 size={15} aria-hidden /> Create share link
              </Button>
            )}
            {authEnabled &&
              (signedIn ? (
                <Button variant="ghost" size="sm" disabled={busy} onClick={saveToAccount}>
                  Save to account
                </Button>
              ) : (
                <Link href={`/account?next=/valuation/${id}`} className="px-2 text-sm text-flame-deep underline underline-offset-4">
                  Sign in to save
                </Link>
              ))}
          </div>
          {message && (
            <p role="status" className="text-sm text-muted sm:basis-full">
              {message}
            </p>
          )}
        </Panel>
      }
      actions={
        <>
          <ButtonLink href={`/value?edit=${id}`} variant="secondary" size="sm">
            <Pencil size={15} aria-hidden /> Edit
          </ButtonLink>
          <Button variant="secondary" size="sm" onClick={() => downloadPdf(data)}>
            <Download size={15} aria-hidden /> PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer size={15} aria-hidden /> Print
          </Button>
          <Button variant="secondary" size="sm" onClick={() => copy(summaryText(v.input, v.result, v.referenceNumber, shareUrl ?? undefined), "summary")}>
            {copied === "summary" ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
            {copied === "summary" ? "Copied" : "Copy summary"}
          </Button>
          <Button variant="ghost" size="sm" onClick={remove} disabled={busy} aria-label="Delete valuation">
            <Trash2 size={15} aria-hidden />
          </Button>
        </>
      }
    />
  );
}
