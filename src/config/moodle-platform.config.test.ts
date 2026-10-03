import assert from "node:assert/strict";
import { test } from "node:test";
import { createMoodlePlatformConfig } from "./moodle-platform.config.js";

test("registers Moodle using a slash-free issuer and valid endpoint URLs", () => {
  const platform = createMoodlePlatformConfig(
    " https://moodle.example.edu/site/ ",
    " 12345 ",
  );

  assert.equal(platform.url, "https://moodle.example.edu/site");
  assert.equal(platform.clientId, "12345");
  assert.equal(
    platform.authenticationEndpoint,
    "https://moodle.example.edu/site/mod/lti/auth.php",
  );
  assert.equal(
    platform.accesstokenEndpoint,
    "https://moodle.example.edu/site/mod/lti/token.php",
  );
  assert.deepEqual(platform.authConfig, {
    method: "JWK_SET",
    key: "https://moodle.example.edu/site/mod/lti/certs.php",
  });
});

test("rejects an incomplete Moodle platform registration", () => {
  assert.throws(() => createMoodlePlatformConfig("https://moodle.example.edu", " "));
});
