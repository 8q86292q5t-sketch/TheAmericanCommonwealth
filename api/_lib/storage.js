const CONTENT_PATH = "generational-commonwealth/admin-content.json";

async function readContent() {
  const { get } = await import("@vercel/blob");
  const result = await get(CONTENT_PATH, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return { version: 1, entries: [] };
  const parsed = JSON.parse(await new Response(result.stream).text());
  return { version: 1, entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
}

async function writeContent(content) {
  const { put } = await import("@vercel/blob");
  await put(CONTENT_PATH, JSON.stringify(content), {
    access: "private",
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/json",
  });
}

module.exports = { readContent, writeContent };
