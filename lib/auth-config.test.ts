import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { allowedUserIds } from "./auth-config";
import { ALLOWLIST } from "../config/allowlist";

const original = process.env.ALLOWED_USER_IDS;
afterEach(() => {
  if (original === undefined) delete process.env.ALLOWED_USER_IDS;
  else process.env.ALLOWED_USER_IDS = original;
});

test("every committed entry is a Clerk user ID, listed once", () => {
  assert.ok(ALLOWLIST.length > 0, "the committed allowlist should not be empty");
  for (const id of ALLOWLIST) assert.match(id, /^user_[A-Za-z0-9]+$/, `"${id}" is not a Clerk user ID`);
  assert.equal(new Set(ALLOWLIST).size, ALLOWLIST.length, "an ID is listed twice");
});

test("the committed list applies with no env var set", () => {
  delete process.env.ALLOWED_USER_IDS;
  assert.deepEqual(allowedUserIds(), [...ALLOWLIST]);
});

test("env IDs are added to the committed list, not swapped for it", () => {
  process.env.ALLOWED_USER_IDS = "user_devlocal123";
  const ids = allowedUserIds();
  assert.ok(ids.includes("user_devlocal123"), "the env ID is allowed");
  for (const id of ALLOWLIST) assert.ok(ids.includes(id), `${id} is still allowed`);
});

test("whitespace and blanks in the env var are ignored, and IDs are not repeated", () => {
  process.env.ALLOWED_USER_IDS = `  ${ALLOWLIST[0]} , ,user_devlocal123,`;
  const ids = allowedUserIds();
  assert.equal(ids.length, ALLOWLIST.length + 1, "the duplicate collapses and blanks drop out");
  assert.equal(new Set(ids).size, ids.length);
});
