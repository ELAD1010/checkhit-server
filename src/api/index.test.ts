import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import callMoodleAPI from "./index.js";

const listen = async (handler: Parameters<typeof createServer>[1]) => {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}` };
};

const close = (server: Server) => {
  server.closeAllConnections();
  return new Promise<void>((resolve) => server.close(() => resolve()));
};

const withEnv = async (
  env: Record<string, string>,
  run: () => Promise<void>,
) => {
  const previous = Object.fromEntries(
    Object.keys(env).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, env);
  try {
    await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test("callMoodleAPI aborts when Moodle does not answer in time", async () => {
  const { server, url } = await listen(() => {
    // Never respond.
  });
  try {
    await withEnv({ MOODLE_URL: url, MOODLE_API_TIMEOUT_MS: "100" }, async () => {
      const startedAt = Date.now();
      await assert.rejects(callMoodleAPI("core_course_get_courses"), {
        name: "TimeoutError",
      });
      assert.ok(Date.now() - startedAt < 5_000);
    });
  } finally {
    await close(server);
  }
});

test("callMoodleAPI rejects HTTP errors and Moodle exception payloads", async () => {
  const { server, url } = await listen((req, res) => {
    if (req.url?.includes("wsfunction=broken")) {
      res.writeHead(502).end("bad gateway");
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        exception: "webservice_access_exception",
        errorcode: "accessexception",
        message: "Access control exception",
      }),
    );
  });
  try {
    await withEnv({ MOODLE_URL: url }, async () => {
      await assert.rejects(callMoodleAPI("broken"), /status 502/);
      await assert.rejects(
        callMoodleAPI("core_course_get_courses"),
        /accessexception/,
      );
    });
  } finally {
    await close(server);
  }
});

test("callMoodleAPI returns successful JSON responses", async () => {
  const { server, url } = await listen((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([{ id: 7, fullname: "Algorithms" }]));
  });
  try {
    await withEnv({ MOODLE_URL: url }, async () => {
      assert.deepEqual(await callMoodleAPI("core_course_get_courses"), [
        { id: 7, fullname: "Algorithms" },
      ]);
    });
  } finally {
    await close(server);
  }
});
