import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import test from "node:test";
import { backdateAndResignJwt } from "./deep-link-token.service.js";

test("backdateAndResignJwt adjusts iat and preserves a valid signature", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iat: 100, exp: 160, sub: "deep-link" }),
  ).toString("base64url");

  const adjusted = backdateAndResignJwt(
    `${header}.${payload}.old-signature`,
    privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  );
  const [adjustedHeader, adjustedPayload, signature] = adjusted.split(".");
  const claims = JSON.parse(
    Buffer.from(adjustedPayload, "base64url").toString("utf8"),
  ) as { iat: number; exp: number };

  assert.equal(claims.iat, 95);
  assert.equal(claims.exp, 160);
  assert.equal(
    verify(
      "RSA-SHA256",
      Buffer.from(`${adjustedHeader}.${adjustedPayload}`),
      publicKey,
      Buffer.from(signature, "base64url"),
    ),
    true,
  );
});
