interface Env {
  AI: any;
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
}

const MODEL_ID = "@cf/zai-org/glm-4.7-flash";

const SYSTEM_PROMPT = `
You are the AI Drama Studio Production Engine.

Your job is to help create ORIGINAL AI drama productions.

Never copy an existing movie, drama, creator, or copyrighted story.

Maintain:
- Character consistency
- Visual consistency
- Timeline consistency
- Location consistency
- Emotional continuity
- Dialogue continuity
- Selected character style
- Selected language
- Selected visual vision

The user may request:
1. Opening Scene
2. Full Drama Plan
3. Production Pack

For Opening Scene requests, create ONLY:
TITLE
COVER CONCEPT
OPENING SCENE

For Full Drama Plan requests, create:
TITLE
CHARACTERS
CHARACTER DNA
STORY SUMMARY
SCENE-BY-SCENE PLAN
DIALOGUE
CAMERA
LIGHTING
EMOTION
CONTINUITY NOTES
ORIGINALITY CHECK
PACING CHECK
ENDING / CLIFFHANGER

For Production Pack requests, create production-ready scene prompts.

Make every story original, emotional, cinematic, memorable, and suitable for AI video generation.
`;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}

async function handleChat(request: Request, env: Env) {
  const body = await request.json() as {
    messages?: Array<{
      role: string;
      content: string;
    }>;
  };

  const messages = Array.isArray(body.messages) ? body.messages : [];

  const result = await env.AI.run(MODEL_ID, {
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || ""),
      })),
    ],
  });

  return new Response(JSON.stringify(result), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function handleVideo(request: Request, env: Env) {
  const body = await request.json() as {
    prompt?: string;
    duration?: number;
    resolution?: string;
    aspect_ratio?: string;
    draft?: boolean;
  };

  const prompt = String(body.prompt || "").trim();

  if (!prompt) {
    return json({
      success: false,
      error: "Video prompt is required.",
    }, 400);
  }

  const duration = Math.min(
    20,
    Math.max(1, Number(body.duration || 5))
  );

  const resolution =
    body.resolution === "1080p" ? "1080p" : "720p";

  const aspectRatio =
    typeof body.aspect_ratio === "string"
      ? body.aspect_ratio
      : "16:9";

  const draft =
    typeof body.draft === "boolean"
      ? body.draft
      : true;

  try {
    const result = await env.AI.run("pruna/p-video", {
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
      model: "pruna/p-video",
      duration,
      resolution,
      draft,
      result,
    });
  } catch (error) {
    return json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    }, 500);
  }
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        },
      });
    }

    const url = new URL(request.url);

    // AI Drama Studio chat / drama planning
    if (
      request.method === "POST" &&
      url.pathname === "/api/chat"
    ) {
      try {
        return await handleChat(request, env);
      } catch (error) {
        return json({
          error:
            error instanceof Error
              ? error.message
              : String(error),
        }, 500);
      }
    }

    // AI Drama Studio actual video generation
    if (
      request.method === "POST" &&
      url.pathname === "/api/video"
    ) {
      return await handleVideo(request, env);
    }

    // Health check
    if (
      request.method === "GET" &&
      url.pathname === "/api/health"
    ) {
      return json({
        ok: true,
        service: "AI Drama Studio",
        videoModel: "pruna/p-video",
      });
    }

    // Serve the existing AI Drama Studio frontend
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("AI Drama Studio is running.", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  },
};
