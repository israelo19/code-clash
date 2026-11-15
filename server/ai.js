// The one place the backend calls the AI service (ai/main.py).
//
// The browser never talks to the AI service. It asks us, we check who is asking
// and what they sent, and then we ask the AI service. That keeps the paid API
// key behind our sign-in and rate limits.

const config = require("./config");

const TIMEOUT_MS = 90_000; // reading a document or answering a chat can take a while

// A failed call. `status` is what we should answer the browser with.
class AiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Call the AI service. `init` is the usual fetch options. Returns the parsed JSON.
// Throws an AiError with a message that is safe to show a user.
async function callAi(path, init = {}) {
  const headers = { ...(init.headers || {}) };
  // The shared secret that tells the AI service the request is from us.
  if (config.aiToken) headers["x-internal-token"] = config.aiToken;

  let reply;
  try {
    reply = await fetch(config.aiUrl + path, { ...init, headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new AiError("The AI service is not reachable. Is it running?", 502);
  }

  const body = await reply.json().catch(() => null);
  if (!reply.ok || body === null) {
    // 4xx answers from the AI service describe a problem with the input (a file
    // it cannot read, an unknown service code) and are safe to pass on.
    const reason = body && typeof body.detail === "string" && reply.status < 500 ? body.detail : "The AI service could not do that right now.";
    throw new AiError(reason, reply.status >= 400 && reply.status < 500 ? reply.status : 502);
  }
  return body;
}

const json = (body) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

module.exports = { callAi, json, AiError };
