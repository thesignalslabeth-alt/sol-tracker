import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedCorsOrigin, corsOrigins } from "./cors";

test("parses API_CORS_ORIGINS, trimming spaces and trailing slashes", () => {
  assert.deepEqual(corsOrigins(" http://localhost:8081/ , https://app.example.com,,"), [
    "http://localhost:8081",
    "https://app.example.com",
  ]);
  assert.deepEqual(corsOrigins(undefined), []);
  assert.deepEqual(corsOrigins(""), []);
});

test("only echoes an allowed origin on /api/ paths", () => {
  const allowed = ["http://localhost:8081"];
  assert.equal(allowedCorsOrigin("/api/v1/dashboard", "http://localhost:8081", allowed), "http://localhost:8081");
  assert.equal(allowedCorsOrigin("/api/v1/dashboard", "https://evil.example", allowed), null);
  assert.equal(allowedCorsOrigin("/", "http://localhost:8081", allowed), null);
  assert.equal(allowedCorsOrigin("/api/v1/dashboard", null, allowed), null);
});

test("nothing is allowed when the list is empty", () => {
  assert.equal(allowedCorsOrigin("/api/v1/dashboard", "http://localhost:8081", []), null);
});
