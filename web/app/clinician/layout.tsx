import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";

// Suspense lets Next.js prerender the page shell while the nav reads the current URL in the browser.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AppShell role="clinician">{children}</AppShell>
    </Suspense>
  );
}
