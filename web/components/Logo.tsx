import Link from "next/link";
import { APP_NAME } from "@/lib/config";

// The app's logo: the pink "+" square and the app name. Clicking it goes to the home page.
// Used on the home page and on every patient and clinician screen, so it looks the same everywhere.
// tone="light" is white text for the dark home-page gradient; tone="dark" is teal text for white backgrounds.
export function Logo({ tone = "dark" }: { tone?: "light" | "dark" }) {
  return (
    <Link
      href="/"
      aria-label={`${APP_NAME} home`}
      className={`flex items-center gap-2 ${tone === "light" ? "text-white" : "text-teal-700"}`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500 text-lg font-semibold text-white">
        +
      </span>
      <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
    </Link>
  );
}
