// Password hashing. We never store a password, only a slow one-way hash of it.
//
// scrypt is built into Node, so this needs no extra library. The cost settings
// follow the OWASP Password Storage Cheat Sheet's minimum for scrypt:
// N = 2^17, r = 8, p = 1. On a laptop one hash takes about 0.2 seconds, which is
// nothing for one sign-in and very expensive for someone guessing millions.
//
// A stored hash looks like:   scrypt$131072$8$1$<salt>$<hash>
// The settings are saved with it, so they can be raised later without breaking
// old hashes.

const crypto = require("crypto");

const COST = { N: 2 ** 17, r: 8, p: 1 };
const KEY_BYTES = 64;
const SALT_BYTES = 16;
const MAX_MEMORY = 256 * 1024 * 1024; // scrypt at N=2^17 needs about 128 MB
const MAX_PASSWORD_LENGTH = 200; // stops someone sending a huge "password" to waste our CPU

function format(salt, key, cost) {
  return ["scrypt", cost.N, cost.r, cost.p, salt.toString("base64"), key.toString("base64")].join("$");
}

// Used when seeding demo accounts, where waiting is fine.
function hashPasswordSync(password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = crypto.scryptSync(password, salt, KEY_BYTES, { ...COST, maxmem: MAX_MEMORY });
  return format(salt, key, COST);
}

// Check a password against a stored hash without blocking other requests.
// Resolves to true or false. Never throws for a wrong or malformed input.
function verifyPassword(password, stored) {
  return new Promise((resolve) => {
    const parts = String(stored || "").split("$");
    if (typeof password !== "string" || password.length > MAX_PASSWORD_LENGTH || parts.length !== 6 || parts[0] !== "scrypt") {
      return resolve(false);
    }
    const cost = { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]) };
    const salt = Buffer.from(parts[4], "base64");
    const expected = Buffer.from(parts[5], "base64");
    crypto.scrypt(password, salt, expected.length, { ...cost, maxmem: MAX_MEMORY }, (error, key) => {
      if (error) return resolve(false);
      // timingSafeEqual takes the same time whether the first or the last byte
      // differs, so the response time gives nothing away.
      resolve(key.length === expected.length && crypto.timingSafeEqual(key, expected));
    });
  });
}

// A hash of a random password nobody knows. When the email does not exist we
// still check against this, so "no such user" takes as long as "wrong password".
const DUMMY_HASH = hashPasswordSync(crypto.randomBytes(32).toString("hex"));

module.exports = { hashPasswordSync, verifyPassword, DUMMY_HASH, MAX_PASSWORD_LENGTH };
