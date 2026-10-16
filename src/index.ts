
interface Env {
  AI: {
    run(
      model: string,
      inputs: Record<string, unknown>
    ): Promise<unknown>;
  };
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function extractText(result: unknown): string {
  if (typeof result === "string") return result;

  if (result && typeof result === "object") {
    const value = result as Record<string, unknown>;

    if (typeof value.response === "string") {
      return value.response;
    }

    if (typeof value.text === "string") {
      return value.text;
    }

    if (Array.isArray(value.content)) {
      return value.content
        .map((part) => {
          if (typeof part === "string") return part;

          if (part && typeof part === "object") {
            const item = part as Record<string, unknown>;
            return typeof item.text === "string" ? item.text : "";
          }

          return "";
        })
        .filter(Boolean)
        .join("\n");
    }
  }

  return "";
}

async function generate(
  env: Env,
  system: string,
  prompt: string,
  maxTokens = 1800
): Promise<string> {
  const result = await env.AI.run(MODEL, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.65,
  });

  const text = extractText(result).trim();

  if (!text) {
    throw new Error("Walang tekstong ibinalik ang AI model.");
  }

  return text;
}

function getSceneCount(minutes: number): number {
  if (minutes <= 1) return 4;
  if (minutes <= 3) return 8;
  if (minutes <= 5) return 10;
  return 16;
}

function getLanguageRules(language: string): string {
  if (language.toLowerCase().includes("english")) {
    return `
Write all story content and dialogue in natural, fluent English.
Avoid literal translations and repetitive expressions.
`;
  }

  if (language.toLowerCase().includes("taglish")) {
    return `
Use natural Filipino Taglish, the way real Filipinos speak.
Use English only where it sounds natural.
Do not force English words into every sentence.
`;
  }

  return `
Write in natural, conversational Filipino Tagalog.
Use words that ordinary Filipinos genuinely say.
Avoid awkward, literal, robotic, or overly formal translations.
Do not use random English words just to sound dramatic.
`;
}

function looksRepetitive(text: string): boolean {
  const lines = text
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length > 25);

  const seen = new Set<string>();
  let repeats = 0;

  for (const line of lines) {
    if (seen.has(line)) repeats++;
    seen.add(line);
  }

  return repeats >= 3;
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const idea = String(body.idea || "").trim();
    const language = String(body.language || "Tagalog");
    const genre = String(body.genre || "Drama");
    const style = String(body.visualStyle || "Cinematic realistic");

    const requestedMinutes = Number(
      body.durationMinutes || 1
    );

    const minutes = Number.isFinite(requestedMinutes)
      ? Math.min(10, Math.max(1, Math.round(requestedMinutes)))
      : 1;

    const sceneCount = getSceneCount(minutes);

    if (idea.length < 8) {
      return json(
        {
          success: false,
          error: "Maglagay ng mas malinaw na ideya ng drama. Gumamit ng hindi bababa sa 8 character.",
        },
        400
      );
    }

    const languageRules = getLanguageRules(language);

    const system = `
You are an experienced original short-drama screenwriter and video production planner.

QUALITY RULES:
- Create a coherent, original story with cause and effect.
- Every character must have a clear motivation.
- Dialogue must sound like real people speaking.
- Never translate English expressions word-for-word into Filipino.
- Never repeat dialogue just to fill space.
- Every scene must change the situation, reveal information, or raise the stakes.
- Give characters distinct voices and reactions.
- Do not add random actions, body parts, objects, or visual details that have no story purpose.
- Avoid generic filler such as "biglang may nangyari" without explaining what happened.
- Keep the characters, clothing, locations, and timeline consistent.
- Follow the requested genre and visual style.
- Do not copy existing movies, dramas, or copyrighted characters.
- Follow the user's story idea instead of replacing it with an unrelated plot.
${languageRules}
`;

    // STAGE 1: Build a specific story and continuity guide.
    const storyGuide = await generate(
      env,
      system,
      `
Create the STORY BLUEPRINT for this original drama.

USER'S IDEA:
${idea}

GENRE: ${genre}
LANGUAGE: ${language}
VISUAL STYLE: ${style}
TARGET LENGTH: ${minutes} minute(s)
EXACT SCENE COUNT: ${sceneCount}

Write these sections:

1. TITLE
Create one short, memorable title.

2. STORY PREMISE
Explain the specific central conflict in 3–5 sentences.
Include what the lead character wants, what blocks them, and what is at risk.

3. CHARACTER BIBLE
Create 2–4 important characters.
For each, state their name, approximate age, appearance, personality, motivation, and relationship to the other characters.

4. CONTINUITY LOCK
Specify the consistent clothing, locations, important objects, time of day, and relationships.

5. BEGINNING, MIDDLE, ENDING
Give a concrete event for each part.
The ending must resolve the central conflict or deliver a meaningful twist.

6. SCENE MAP
List exactly ${sceneCount} numbered scenes.
Each scene must have a distinct purpose and a specific event.
Show how the result of one scene causes the next.
Do not write the full dialogue yet.

Keep this blueprint compact but specific.
Do not use vague filler or repeat the same event.
`,
      1900
    );

    // STAGE 2: Generate scenes in small batches for better control.
    const batchSize = 4;
    const batches: string[] = [];

    for (let start = 1; start <= sceneCount; start += batchSize) {
      const end = Math.min(start + batchSize - 1, sceneCount);

      const scenePrompt = `
Use the following approved story blueprint as the source of truth.
Do not change the characters, their motivations, the setting, or the main plot.

STORY BLUEPRINT:
${storyGuide}

TASK:
Write scenes ${start} through ${end} only, out of ${sceneCount} total scenes.

For EVERY scene, use this exact structure:

SCENE [number] — [short, specific title]
DURATION: [estimated seconds]

STORY ACTION:
Describe what the audience actually sees. Include a clear action, reaction, and meaningful change in the situation. Avoid vague descriptions.

DIALOGUE:
Write 2–4 short, natural lines when dialogue is appropriate.
Format each line as CHARACTER NAME: spoken words.
Make each character sound different.
Do not repeat a line from another scene.
If silence is more powerful, briefly explain why.

CAMERA:
Give one practical camera direction that matches the action.

LIGHTING AND SOUND:
Specify appropriate lighting and one or two relevant sound details.

VIDEO GENERATION PROMPT:
Write one self-contained visual prompt in ${style} style.
Include the characters present, their consistent appearance, location, action, emotion, camera movement, lighting, and atmosphere.
Describe only what should be visible in this scene.
Do not include subtitles, logos, watermarks, or extra characters unless the story requires them.

NEGATIVE PROMPT:
List visual errors to avoid, such as distorted hands, changing faces, inconsistent clothing, duplicate characters, flickering, and unwanted text.

IMPORTANT:
- Follow the scene map in the blueprint.
- Scenes must be different from one another.
- Keep dialogue believable and concise.
- Do not summarize future scenes.
- Do not add a new twist that contradicts the blueprint.
- Do not write scenes outside ${start}–${end}.
- Keep each video prompt usable on its own.
${languageRules}
`;

      let batch = await generate(
        env,
        system,
        scenePrompt,
        1800
      );

      // One targeted retry if the batch contains obvious repeated lines.
      if (looksRepetitive(batch)) {
        batch = await generate(
          env,
          system,
          `
Rewrite these scenes with natural, distinct dialogue and clearer actions.
Keep the approved blueprint and scene numbers unchanged.
Remove repeated dialogue and redundant descriptions.
Do not invent new plot events.

BLUEPRINT:
${storyGuide}

SCENES TO IMPROVE:
${batch}

Write only the improved scenes ${start} through ${end}.
${languageRules}
`,
          1800
        );
      }

      batches.push(batch);
    }

    const plan = `
AI DRAMA STUDIO
COMPLETE DRAMA PRODUCTION PLAN

TITLE AND STORY BLUEPRINT
${storyGuide}

==================================================

SCENE-BY-SCENE PRODUCTION PLAN

${batches.join("\n\n==================================================\n\n")}

==================================================

FINAL CONTINUITY CHECK
Before production, confirm that the same character names, appearance, clothing, locations, and important objects remain consistent throughout the scenes. If the video generator changes a character's appearance, use the character bible as the reference.
`.trim();

    return json({
      success: true,
      plan,
      model: MODEL,
      durationMinutes: minutes,
      language,
      genre,
      sceneCount,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Hindi inaasahang error sa pagbuo ng drama.";

    return json(
      {
        success: false,
        error: `Hindi nabuo ang drama plan. ${message}`,
      },
      500
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "AI Drama Studio",
        model: MODEL,
      });
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return json({ success: false, error: "Hindi nahanap ang page." }, 404);
  },
};
