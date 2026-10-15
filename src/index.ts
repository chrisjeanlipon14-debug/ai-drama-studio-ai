
interface Env {
  AI: {
    run: (
      model: string,
      inputs: Record<string, unknown>
    ) => Promise<unknown>;
  };
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
}

const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fast";
const VIDEO_MODEL_ID = "pruna/p-video";

const SYSTEM_PROMPT = `
You are AI Drama Studio, an original drama production engine.

Create original stories. Never copy existing movies, dramas, books, or creators.

Write clear, natural language in the user's selected language.
For Tagalog, use natural Filipino grammar and avoid invented or meaningless words.
Do not repeat paragraphs to fill space.
Do not end in the middle of a sentence.
If the requested output is too large, prioritize completeness and concise details.

Maintain consistent characters, appearance, clothing, locations, props,
timeline, dialogue, emotional progression, and visual style.

Never claim a quality check passed unless you actually checked it.
Never claim a video was generated unless the video model returned a result.
`;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const value: unknown = await request.json();

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid JSON request body.");
  }

  return value as Record<string, unknown>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];

  if (rawMessages.length === 0) {
    return json({ error: "Please provide a message." }, 400);
  }

  const messages = rawMessages
    .filter(
      (item): item is { role: string; content: string } =>
        !!item &&
        typeof item === "object" &&
        typeof (item as { content?: unknown }).content === "string"
    )
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: item.content.trim(),
    }))
    .filter((item) => item.content.length > 0)
    .slice(-12);

  if (messages.length === 0) {
    return json({ error: "The message content is empty." }, 400);
  }

  const result = await env.AI.run(MODEL_ID, {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ],
    max_tokens: 1800,
    temperature: 0.6,
  });

  return json(result);
}

async function handleVideo(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);

  const prompt = typeof body.prompt === "string"
    ? body.prompt.trim()
    : "";

  if (!prompt) {
    return json({
      success: false,
      error: "A video prompt is required.",
    }, 400);
  }

  const requestedDuration = Number(body.duration ?? 5);

  if (!Number.isFinite(requestedDuration)) {
    return json({
      success: false,
      error: "Video duration must be a number from 1 to 20 seconds.",
    }, 400);
  }

  const duration = Math.min(20, Math.max(1, Math.round(requestedDuration)));
  const resolution = body.resolution === "1080p" ? "1080p" : "720p";

  const allowedRatios = ["16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "1:1"];
  const aspectRatio =
    typeof body.aspect_ratio === "string" &&
    allowedRatios.includes(body.aspect_ratio)
      ? body.aspect_ratio
      : "16:9";

  const draft = typeof body.draft === "boolean" ? body.draft : true;

  try {
    const result = await env.AI.run(VIDEO_MODEL_ID, {
      prompt,
      duration,
      resolution,
      aspect_ratio: aspectRatio,
      draft,
      save_audio: true,
      prompt_upsampling: true,
    });

    return json({
      success: true,
      model: VIDEO_MODEL_ID,
      duration,
      resolution,
      draft,
      result,
    });
  } catch (error) {
    return json({
      success: false,
      model: VIDEO_MODEL_ID,
      error: errorMessage(error),
      note: "The video request failed. Check the model availability and Workers AI response before retrying.",
    }, 500);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        },
      });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "AI Drama Studio",
        chatModel: MODEL_ID,
        videoModel: VIDEO_MODEL_ID,
        videoGenerationAvailable: true,
        note: "Endpoint configured; actual video generation still needs a real test.",
      });
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      try {
        return await handleChat(request, env);
      } catch (error) {
        return json({
          error: errorMessage(error),
        }, 500);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/video") {
      try {
        return await handleVideo(request, env);
      } catch (error) {
        return json({
          success: false,
          error: errorMessage(error),
        }, 500);
      }
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("AI Drama Studio is running.", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
};
        
