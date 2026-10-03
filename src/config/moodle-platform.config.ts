import type { PlatformConfig } from "ltijs";

export const createMoodlePlatformConfig = (
  rawUrl: string,
  rawClientId: string,
): PlatformConfig => {
  // ltijs uses an exact issuer URL match when Moodle initiates a launch.
  const url = rawUrl.trim().replace(/\/+$/, "");
  const clientId = rawClientId.trim();

  if (!url || !clientId) {
    throw new Error("MOODLE_URL and MOODLE_CLIENT_ID must both be configured");
  }

  const parsedUrl = new URL(url);
  if (
    !["http:", "https:"].includes(parsedUrl.protocol) ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error("MOODLE_URL must be the Moodle base URL without a query or fragment");
  }

  return {
    url,
    name: "Main Moodle Platform",
    clientId,
    authenticationEndpoint: `${url}/mod/lti/auth.php`,
    accesstokenEndpoint: `${url}/mod/lti/token.php`,
    authConfig: {
      method: "JWK_SET",
      key: `${url}/mod/lti/certs.php`,
    },
  };
};
