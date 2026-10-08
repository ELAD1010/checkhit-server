type MoodleParamValue = string | number | boolean;
type MoodleParams = Record<string, MoodleParamValue>;

const DEFAULT_MOODLE_API_TIMEOUT_MS = 10_000;

const moodleApiTimeoutMs = (): number => {
  const configured = Number(process.env.MOODLE_API_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_MOODLE_API_TIMEOUT_MS;
};

async function callMoodleAPI(
  functionName: string,
  params: MoodleParams = {},
): Promise<unknown> {
  const MOODLE_URL = process.env.MOODLE_URL; // e.g., https://your-moodle.com
  const MOODLE_TOKEN = process.env.MOODLE_WS_TOKEN;

  // Moodle's REST API expects form-urlencoded data
  const url = new URL(`${MOODLE_URL}/webservice/rest/server.php`);
  url.searchParams.append("wstoken", MOODLE_TOKEN ?? "");
  url.searchParams.append("wsfunction", functionName);
  url.searchParams.append("moodlewsrestformat", "json");

  // Append any specific parameters (like course ID)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, String(value));
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    signal: AbortSignal.timeout(moodleApiTimeoutMs()),
  });
  if (!response.ok) {
    throw new Error(
      `Moodle API ${functionName} failed with status ${response.status}`,
    );
  }

  const body: unknown = await response.json();
  // Moodle reports web-service failures as HTTP 200 with an exception payload.
  if (body && typeof body === "object" && "exception" in body) {
    const { errorcode, message } = body as {
      errorcode?: unknown;
      message?: unknown;
    };
    throw new Error(
      `Moodle API ${functionName} failed: ${String(errorcode ?? "error")} ${String(message ?? "")}`.trim(),
    );
  }
  return body;
}

export default callMoodleAPI;
