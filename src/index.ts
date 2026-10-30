
interface Env {
  AI: {
    run: (
      model: string,
      input: Record<string, unknown>
    ) => Promise<any>;
  };
  AI_MODEL?: string;
}

type Action = "opening" | "full";

const MODEL_DEFAULT = "@cf/meta/llama-3.1-8b-instruct-fast";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function systemPrompt(
  genre: string,
  language: string,
  style: string,
  aspect: string
): string {
  return `You are AI DRAMA STUDIO, a professional original film and animation writer.

GENRE: ${genre}
LANGUAGE: ${language}
VISUAL STYLE: ${style}
VIDEO FORMAT: ${aspect}

GENRE RULES:
- Love Story: romance, chemistry, emotional conflict and meaningful relationships.
- Horror: suspense, mystery, frightening atmosphere and logical reveals.
- Family Drama: family conflict, sacrifice, secrets and emotional relationships.
- Revenge: betrayal, consequences and a satisfying resolution.
- Fantasy: imaginative worlds, magic and consistent world rules.
- Comedy: natural humor, funny situations and entertaining dialogue.
- Roblox Story: create an original Roblox-inspired blocky 3D game world, avatars, environments, adventures and game-like actions. Do not describe realistic human characters for this genre.
- Action / Adventure: exciting challenges, clear stakes and cinematic action.
- Kids / Animal Learning: child-friendly stories, lovable animal characters and simple educational lessons.
- Inspirational Story: struggles, hope, courage and meaningful life lessons.

IMPORTANT RULES:
1. Follow the user's story idea and selected genre.
2. Write natural, grammatically correct ${language}.
3. Create original stories. Do not copy existing movies, games or shows.
4. Keep character appearance, age, clothing, personality and identity consistent.
5. Never change a character's physical features between scenes.
6. Every scene must move the story forward.
7. Avoid repetitive actions, filler dialogue and confusing revelations.
8. Make dialogue natural and emotionally believable.
9. Maintain logical chronological and location continuity.
10. Include camera directions, lighting, atmosphere and sound.
11. Give detailed video prompts with consistent character descriptions.
12. Make the opening interesting and give the ending a strong emotional impact.
13. Do not claim that text prompts are already rendered videos.
14. All romantic characters must be adults.

Return polished, clear, production-ready writing.`;
}

async function runAI(
  env: Env,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const model = env.AI_MODEL || MODEL_DEFAULT;

  const result = await env.AI.run(model, {
    messages,
    max_tokens: 7000,
    temperature: 0.7
  });

  const output =
    typeof result === "string"
      ? result
      : result?.response ||
        result?.result?.response ||
        "";

  if (typeof output !== "string" || !output.trim()) {
    throw new Error("AI returned an empty response.");
  }

  return output.trim();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (
      request.method === "GET" &&
      url.pathname === "/api/health"
    ) {
      return json({
        ok: true,
        service: "AI Drama Studio",
        mode: "genre-based-story-generation",
        model: env.AI_MODEL || MODEL_DEFAULT,
        videoGeneration: false
      });
    }

    if (
      request.method !== "POST" ||
      url.pathname !== "/api/chat"
    ) {
      return json({ error: "Not found" }, 404);
    }

    if (!env.AI) {
      return json({
        error: "Hindi naka-configure ang Cloudflare Workers AI binding."
      }, 503);
    }

    let body: any;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON request." }, 400);
    }

    const action = body?.action as Action;
    const idea =
      typeof body?.idea === "string"
        ? body.idea.trim()
        : "";

    const settings = body?.settings || {};

    const genre = String(settings.genre || "Love Story");
    const language = String(
      settings.language || "Filipino / natural Tagalog"
    );
    const style = String(
      settings.visualStyle || "Realistic cinematic human"
    );
    const aspect = String(settings.aspectRatio || "9:16");

    const duration = Math.max(
      1,
      Math.min(20, Number(settings.duration) || 5)
    );

    if (!["opening", "full"].includes(action)) {
      return json({ error: "Unsupported action." }, 400);
    }

    if (!idea) {
      return json({
        error: "Ilagay muna ang story idea."
      }, 400);
    }

    if (idea.length > 18000) {
      return json({
        error: "Maximum 18,000 characters lamang."
      }, 413);
    }

    if (action === "full" && body?.approved !== true) {
      return json({
        error: "Approval required before full plan generation."
      }, 403);
    }

    const system = systemPrompt(
      genre,
      language,
      style,
      aspect
    );

    const user =
      action === "opening"
        ? `SELECTED GENRE: ${genre}

STORY IDEA:
${idea}

TARGET MOVIE LENGTH: ${duration} minutes.

TASK:
Create ONLY the opening scene.

Include:
1. Original movie title.
2. Short story premise.
3. Character descriptions.
4. Scene location and duration.
5. Cinematic visual actions.
6. Natural and believable dialogue.
7. Camera directions.
8. Lighting and sound.
9. Continuity notes.
10. A strong ending hook.

Make the opening engaging and appropriate for the selected genre.
Do not write the complete movie yet.`
        : `SELECTED GENRE: ${genre}

STORY IDEA:
${idea}

APPROVED OPENING SCENE:
${String(body?.opening || "")}

TARGET MOVIE LENGTH: ${duration} minutes.

TASK:
Create the complete movie screenplay and production plan.

Include:
1. Final title and logline.
2. Complete story from beginning to ending.
3. Character bible with locked visual descriptions.
4. Locations and visual world.
5. Scene-by-scene screenplay.
6. For every scene: duration, location, characters, visual actions, dialogue, camera, lighting, sound and continuity.
7. Detailed standalone video-generation prompts for every scene.
8. Emotional climax and satisfying ending.

Keep the story consistent with the selected genre.
Make the scenes logical and connected.
Make total scene duration approximately ${duration} minutes.
Do not use repetitive filler.`;

    try {
      const text = await runAI(env, [
        { role: "system", content: system },
        { role: "user", content: user }
      ]);

      return json({
        ok: true,
        action,
        genre,
        text,
        outputType: "text-only",
        generatedAt: new Date().toISOString()
      });

    } catch (error: any) {
      return json({
        error:
          error?.message ||
          "AI generation failed. Check the Cloudflare Workers AI model and binding."
      }, 502);
    }
  }
};
