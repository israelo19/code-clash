// Sign-in and sign-out.
//
//   POST /api/login    { email, password, role? }  ->  { user }  and a session cookie
//   POST /api/logout                               ->  ends the session
//   GET  /api/me                                   ->  { user } for whoever is signed in
//
// Mounted in App.js:   app.use("/api", require("./server/routes/auth"));

const express = require("express");
const db = require("../db");
const { verifyPassword, DUMMY_HASH } = require("../passwords");
const { rateLimit, startSession, endSession } = require("../security");
const { text } = require("../validate");

const router = express.Router();

// Slow down password guessing three ways.
//   By account: ten tries per email. This is the one that cannot be dodged.
//   By address: ten tries per visitor. A visitor's address reaches us through the
//     web app in front, and without a proper proxy it can be faked, so this one
//     helps but is not relied on (see SECURITY.md).
//   Overall: a ceiling on sign-ins from everyone together, which stops someone
//     trying one common password against many accounts from many fake addresses.
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const tooMany = "Too many sign-in attempts. Try again in a few minutes.";
const limitByEmail = rateLimit({ windowMs: FIFTEEN_MINUTES, max: 10, message: tooMany, key: (req) => text(req.body && req.body.email, 200).toLowerCase() || null });
const limitByAddress = rateLimit({ windowMs: FIFTEEN_MINUTES, max: 10, message: tooMany });
const limitOverall = rateLimit({ windowMs: FIFTEEN_MINUTES, max: 300, message: tooMany, key: () => "everyone" });

router.post("/login", limitOverall, limitByAddress, limitByEmail, async (req, res) => {
  const { email, password, role } = req.body || {};
  const user = db.getUserForSignIn(email);

  // Always check a hash, even when the email is unknown, so both cases take the
  // same time. And always give the same answer, so a stranger cannot learn
  // which emails have accounts.
  const correct = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !correct || (role && user.role !== role)) {
    return res.status(401).json({ error: "That email and password do not match an account." });
  }

  startSession(req, res, user.id);
  res.json({ user: { id: user.id, role: user.role, name: user.name } });
});

router.post("/logout", (req, res) => {
  endSession(req, res);
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not signed in." });
  res.json({ user: req.user });
});

module.exports = router;
