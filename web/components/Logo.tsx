import Link from "next/link";
import { APP_NAME } from "@/lib/config";

// The app's logo: the "keyhole page" mark and the app name. Clicking it goes to the home page.
// The mark is a page with a folded corner (your records) with a keyhole cut out of it (you hold the key).
// The drawing is the same one as docs/brand/logo-mark.svg. See docs/brand/LOGO_PROFILE.md.
// Used on the home page and on every patient and clinician screen, so it looks the same everywhere.
// tone="light" is white for the dark home-page gradient; tone="dark" is teal for white backgrounds.
export function Logo({ tone = "dark" }: { tone?: "light" | "dark" }) {
  return (
    <Link
      href="/"
      aria-label={`${APP_NAME} home`}
      className={`flex items-center gap-2 ${tone === "light" ? "text-white" : "text-teal-700"}`}
    >
      <svg viewBox="0 0 64 64" aria-hidden className="h-8 w-8 shrink-0">
        {/* The page. The keyhole is a hole in it, so the background shows through. */}
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M17 4H39.5Q42 4 43.8 5.8L58.2 20.2Q60 22 60 24.5V47A13 13 0 0 1 47 60H17A13 13 0 0 1 4 47V17A13 13 0 0 1 17 4ZM31 20A8 8 0 0 0 27 34.93L24.2 46.4Q23.6 49 26.2 49H35.8Q38.4 49 37.8 46.4L35 34.93A8 8 0 0 0 31 20Z"
        />
        {/* The folded corner, a shade apart from the page. */}
        <path
          className={tone === "light" ? "fill-teal-200" : "fill-teal-900"}
          d="M42 4.52Q42.97 4.97 43.8 5.8L58.2 20.2Q59.03 21.03 59.48 22H46A4 4 0 0 1 42 18Z"
        />
      </svg>
      <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
    </Link>
  );
}
