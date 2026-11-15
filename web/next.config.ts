import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Where the backend (App.js) runs. The browser never calls it directly: requests to
// /api/... on this web app are passed on to it from the server side (see rewrites below).
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:4000";

// What the browser is allowed to load on our pages. This follows the Next.js guide
// for a Content Security Policy without nonces. Scripts, styles, images and requests
// may only come from this site itself, the page cannot be put inside a frame, and
// plugins are off. 'unsafe-inline' is needed because Next.js writes small inline
// scripts and styles into every page. Development mode also needs 'unsafe-eval' and
// a WebSocket for live reloading.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:", // blob: is the preview of a photo you picked to upload
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" }, // do not guess file types
  { key: "X-Frame-Options", value: "DENY" }, // older browsers: never show the app inside a frame
  // A share code is part of the address of the clinician's view. Sending no referrer
  // means that address is never passed on to another site.
  { key: "Referrer-Policy", value: "no-referrer" },
  // The upload screen can open the camera. Nothing else may use the camera, microphone or location.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Browsers only act on this over HTTPS, where it tells them never to fall back to HTTP.
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false, // do not advertise what the site is built with
  experimental: {
    // Reading a document or answering a chat can take longer than the default 30 seconds.
    proxyTimeout: 120_000,
    // The web server holds a request in memory while passing it to the backend, and by
    // default cuts it off at 10 MB, which would break large photo uploads. The backend
    // allows 15 MB, so let a little more than that through and let the backend say no.
    proxyClientMaxBodySize: "20mb",
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
