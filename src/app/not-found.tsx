import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-4xl">Page not found</h1>
      <p className="mt-3 text-muted">The page may have moved, or a shared report link may have been turned off by its owner.</p>
      <ButtonLink href="/value" className="mt-8">
        Value my balloon
      </ButtonLink>
    </div>
  );
}
