import { sign } from "node:crypto";

const DEFAULT_IAT_LEEWAY_SECONDS = 5;

export function backdateAndResignJwt(
  token: string,
  privateKey: string,
  leewaySeconds = DEFAULT_IAT_LEEWAY_SECONDS,
): string {
  const [encodedHeader, encodedPayload] = token.split(".");
  if (!encodedHeader || !encodedPayload) {
    throw new Error("Invalid deep-link JWT");
  }

  const payload = JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
  if (typeof payload.iat !== "number") {
    throw new Error("Deep-link JWT is missing iat");
  }

  payload.iat -= Math.max(0, Math.min(leewaySeconds, 30));
  const adjustedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signingInput = `${encodedHeader}.${adjustedPayload}`;
  const signature = sign("RSA-SHA256", Buffer.from(signingInput), privateKey);
  return `${signingInput}.${signature.toString("base64url")}`;
}

export function createDeepLinkSubmissionForm(
  returnUrl: string,
  message: string,
): string {
  const escapeAttribute = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

  return `<form id="ltijs_submit" style="display: none;" action="${escapeAttribute(returnUrl)}" method="POST">
  <input type="hidden" name="JWT" value="${escapeAttribute(message)}" />
</form>
<script>document.getElementById("ltijs_submit").submit()</script>`;
}
