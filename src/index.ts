
interface Env {
  AI: {
    run: (
      model: string,
      input: Record<string, unknown>
    ) => Promise<any>;
  };
  AI_MODEL?: string;
}

type Mode = "movie" | "short";

const TEXT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const VIDEO_MODEL = "pruna/p-video";

const STYLES = [
  "2D Anime",
  "2D Cartoon",
  "2D Cinematic Animation",
  "3D Cartoon Animation",
  "3D Realistic Animation",
  "3D Cinematic Animation",
  "Realistic cinematic human",
  "Roblox-inspired 3D game style"
];

const ASPECTS = ["9:16", "16:9", "1:1", "4:3", "3:4", "3:2", "2:3"];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function extractText(result: any): string {
  const candidates = [
    result,
    result?.response,
    result?.result?.response,
    result?.output_text,
    result?.result?.output_text,
    result?.choices?.[0]?.message?.content
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function extractVideoUrl(result: any): string {
  const candidates = [
    result?.result?.video,
    result?.video,
    result?.result?.result?.video,
    result?.output?.video
  ];

  for (const value of candidates) {
    if (typeof value === "string") {
      try {
        const url = new URL(value);
        if (url.protocol === "https:") return url.toString();
      } catch {
        // Ignore invalid URL.
      }
    }
  }

  return "";
}

async function textAI(
  env: Env,
  messages: Array<{ role: string; content: string }>,
  maxTokens = 4000
): Promise<string> {
  const result = await env.AI.run(
    env.AI_MODEL || TEXT_MODEL,
    {
      messages,
      max_tokens: maxTokens,
      temperature: 0.65
    }
  );

  const output = extractText(result);

  if (!output) {
    throw new Error("Walang valid na response mula sa text AI model.");
  }

  return output;
}

async function handleVideo(request: Request, env: Env): Promise<Response> {
  let body: any;

  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON request." }, 400);
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

  if (!prompt) {
    return json({ ok: false, error: "Ilagay muna ang video prompt." }, 400);
  }

  if (prompt.length > 5000) {
    return json({ ok: false, error: "Maximum 5,000 characters ang prompt." }, 413);
  }

  const duration = Math.max(1, Math.min(20, Number(body.duration) || 5));
  const resolution = body.resolution === "1080p" ? "1080p" : "720p";
  const aspectRatio = ASPECTS.includes(body.aspectRatio) ? body.aspectRatio : "9:16";
  const draft = body.draft !== false;

  const input: Record<string, unknown> = {
    prompt,
    duration,
    resolution,
    fps: 24,
    aspect_ratio: aspectRatio,
    draft,
    save_audio: true,
    prompt_upsampling: true
  };

  try {
    const result = await env.AI.run(VIDEO_MODEL, input);
    const videoUrl = extractVideoUrl(result);

    if (!videoUrl) {
      return json({
        ok: false,
        error: "Hindi pa nakatanggap ng playable video URL ang Studio.",
        model: VIDEO_MODEL,
        state: result?.state || "unknown",
        details: result?.error || result?.result?.error || null
      }, 502);
    }

    return json({
      ok: true,
      videoUrl,
      model: VIDEO_MODEL,
      duration,
      resolution,
      aspectRatio,
      draft
    });

  } catch (error: any) {
    return json({
      ok: false,
      error: error?.message || "Video generation failed. Tingnan ang Workers AI access at billing."
    }, 502);
  }
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  let body: any;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON request." }, 400);
  }

  const action = body.action;
  const idea = typeof body.idea === "string" ? body.idea.trim() : "";
  const settings = body.settings || {};

  if (!["opening", "full"].includes(action)) {
    return json({ error: "Invalid action." }, 400);
  }

  if (!idea || idea.length > 18000) {
    return json({ error: "Ilagay ang story idea. Maximum 18,000 characters." }, 400);
  }

  const mode: Mode = settings.mode === "movie" ? "movie" : "short";
  const duration = Math.max(1, Math.min(20, Number(settings.duration) || 5));
  const genre = String(settings.genre || "Family Drama");
  const language = String(settings.language || "Filipino / natural Tagalog");
  const style = STYLES.includes(settings.visualStyle) ? settings.visualStyle : "Realistic cinematic human";
  const aspect = ASPECTS.includes(settings.aspectRatio) ? settings.aspectRatio : "9:16";

  if (action === "full" && body.approved !== true) {
    return json({ error: "I-approve muna ang Opening Scene." }, 403);
  }

  const system = `
You are AI DRAMA STUDIO, an expert film screenwriter.

Write natural, grammatically correct ${language}.
Genre: ${genre}
Visual style: ${style}
Aspect ratio: ${aspect}
Production mode: ${mode}

Create original stories. Maintain consistent character faces,
hairstyles, clothing, personalities and locations.
Use filmable actions, clear camera directions and cinematic lighting.
Avoid repetitive scenes and unnatural dialogue.
Do not claim that a video has been rendered unless the video endpoint returns it.
`;

  const task = action === "opening"
    ? `
Create ONLY the opening scene based on this story:

${idea}

Target screenplay length: ${duration} minutes.

Include:
Title, logline, character descriptions, location,
visual actions, dialogue, camera directions, lighting,
sound, continuity notes and a standalone video prompt.
`
    : `
Create the complete screenplay based on this story:

${idea}

Approved opening:
${String(body.opening || "").slice(0, 30000)}

Include:
1. Final title and logline
2. Synopsis
3. Locked character bible
4. Visual world
5. Scene-by-scene screenplay
6. Video-generation prompt for every scene
7. Climax and ending
8. Continuity summary

Target length: ${duration} minutes.
Make every scene logically connected and filmable.
`;

  try {
    const text = await textAI(env, [
      { role: "system", content: system },
      { role: "user", content: task }
    ], action === "opening" ? 3500 : 6000);

    return json({
      ok: true,
      action,
      text,
      mode,
      style,
      aspect,
      outputType: "text"
    });

  } catch (error: any) {
    return json({
      error: error?.message || "AI screenplay generation failed."
    }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "AI Drama Studio",
        textModel: env.AI_MODEL || TEXT_MODEL,
        videoModel: VIDEO_MODEL,
        videoGeneration: true,
        supportedVisualStyles: STYLES
      });
    }

    if (!env.AI) {
      return json({ error: "Workers AI binding is not configured." }, 503);
    }

    if (request.method === "POST" && url.pathname === "/api/video") {
      return handleVideo(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      return handleChat(request, env);
    }

    return json({ error: "Not found." }, 404);
  }
};
