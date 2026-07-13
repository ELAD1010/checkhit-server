type MoodleParamValue = string | number | boolean;
type MoodleParams = Record<string, MoodleParamValue>;

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

  const response = await fetch(url.toString(), { method: "POST" });
  return await response.json();
}

export default callMoodleAPI;
