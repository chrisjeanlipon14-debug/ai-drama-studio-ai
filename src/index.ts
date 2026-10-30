
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

const MODEL_DEFAULT = "@cf/meta/llama-3.1-8b-instruct";

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
  language: string,
  style: string,
  aspect: string
): string {
  return `You are AI DRAMA STUDIO, a professional original drama screenwriter and film pre-production assistant.

OUTPUT LANGUAGE: ${language}.
Use natural, grammatically correct language. If Filipino/Tagalog is selected, write natural conversational Filipino, not literal machine translation.

VISUAL STYLE: ${style}.
VIDEO ASPECT: ${aspect}.

NON-NEGOTIABLE RULES:

- Follow the user's supplied blueprint and preserve its intended premise, characters, relationships and requested ending.
- Do not invent contradictory character facts. Resolve obvious typos and contradictions sensibly; list any important assumptions briefly.
- Create original material. Do not copy existing films, shows or scripts.
- Keep character identity consistent: name, age, gender, facial features, hair, eye color, body type, signature clothing and personality.
- Never assign two eye colors or incompatible physical traits unless explicitly explained.
- Every scene must advance plot or character.
- No repeated filler, generic placeholder actions, repetitive dialogue or unexplained revelations.
- Dialogue must sound natural and match each character's age, personality and relationship.
- Maintain chronological and spatial continuity.
- Every scene's ending must connect logically to the next.
- Provide filmable actions, specific camera framing/movement, lighting, atmosphere and sound design.
- Distinguish story/screenplay output from actual generated video.
- You only create text and prompts; never claim to render a video.
- Avoid sexual content involving minors. All romantic characters must be adults.

Return polished, production-ready writing with clear headings.`;
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

  const text =
    typeof result === "string"
      ? result
      : (
          result?.response ||
          result?.result?.response ||
          ""
        );

  if (typeof text !== "string" || !text.trim()) {
    throw new Error("AI model returned an empty response.");
  }

  return text.trim();
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
        mode: "story-and-screenplay",
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
        error: "Hindi naka-configure ang Cloudflare Workers AI binding. Sundin ang README at wrangler.toml."
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

    const language = String(
      settings.language || "Filipino / natural Tagalog"
    );

    const style = String(
      settings.visualStyle || "Realistic cinematic human"
    );

    const aspect = String(
      settings.aspectRatio || "9:16"
    );

    const duration = Math.max(
      1,
      Math.min(60, Number(settings.duration) || 5)
    );

    if (!["opening", "full"].includes(action)) {
      return json({ error: "Unsupported action." }, 400);
    }

    if (!idea) {
      return json({ error: "Ilagay muna ang story idea." }, 400);
    }

    if (idea.length > 18000) {
      return json({
        error: "Input is too long (maximum 18,000 characters)."
      }, 413);
    }

    if (action === "full" && body?.approved !== true) {
      return json({
        error: "Approval required before generating the full plan."
      }, 403);
    }

    const system = systemPrompt(language, style, aspect);

    const user =
      action === "opening"
        ? `USER STORY BLUEPRINT:
${idea}

TARGET LENGTH: ${duration} minutes.

TASK:
Create ONLY the opening scene for this film.

Include:
1. Working title
2. One-sentence logline
3. Concise character bible with fixed visual traits
4. Opening scene duration
5. Location
6. Characters present
7. Visual action
8. Natural dialogue
9. Camera
10. Lighting
11. Sound
12. Continuity notes
13. Strong end hook

Make it specific and cinematic, not generic.
Do not write the full movie yet.`
        : `USER STORY BLUEPRINT:
${idea}

APPROVED OPENING SCENE:
${String(
  body?.opening ||
  "The user approved the opening scene generated in the previous step."
)}

TARGET LENGTH: ${duration} minutes.

TASK:
Create the COMPLETE film plan, not merely a summary.

Include:
1. Final title and logline.
2. Complete story synopsis with beginning, escalating conflict, climax, resolution and ending.
3. Locked character bible.
4. Locations and visual world.
5. Scene-by-scene screenplay covering the requested duration.
6. For EVERY scene include:
   - Duration
   - Location
   - Characters
   - Visual action
   - Natural dialogue
   - Camera
   - Lighting
   - Sound
   - Emotional purpose
   - Continuity from previous scene
   - Detailed standalone video-generation prompt including fixed character descriptions.
7. Final ending and optional sequel hook.

Estimate scene count and duration realistically.
Ensure the total scene durations approximately equal ${duration} minutes.
Do not repeat the same generic action or dialogue.`;

    try {
      const text = await runAI(env, [
        { role: "system", content: system },
        { role: "user", content: user }
      ]);

      return json({
        ok: true,
        action,
        text,
        generatedAt: new Date().toISOString(),
        outputType: "text-only"
      });

    } catch (error: any) {
      return json({
        error:
          error?.message ||
          "AI generation failed. Check Workers AI model availability and binding."
      }, 502);
    }
  }
};
