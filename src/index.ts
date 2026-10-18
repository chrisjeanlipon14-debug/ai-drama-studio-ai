
interface Env {
  AI: {
    run: (
      model: string,
      input: Record<string, unknown>
    ) => Promise<unknown>;
  };
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function getText(result: unknown): string {
  if (typeof result === "string") return result;

  if (result && typeof result === "object") {
    const value = result as Record<string, unknown>;

    if (typeof value.response === "string") return value.response;
    if (typeof value.result === "string") return value.result;
    if (typeof value.output === "string") return value.output;

    if (Array.isArray(value.choices)) {
      const choice = value.choices[0] as Record<string, unknown>;
      const message = choice?.message as Record<string, unknown>;
      if (typeof message?.content === "string") {
        return message.content;
      }
    }
  }

  return "";
}

async function generate(
  env: Env,
  prompt: string,
  maxTokens = 2048
): Promise<string> {
  const result = await env.AI.run(MODEL, {
    messages: [
      {
        role: "system",
        content:
          "You are a professional international screenwriter and film production planner. " +
          "Write original, coherent stories in the exact language requested. " +
          "Use natural, grammatically correct dialogue. Never produce gibberish. " +
          "Keep character names, ages, appearance, clothing, relationships, " +
          "motivations, locations, and important objects consistent. " +
          "Follow the requested genre and culture. Every scene must connect " +
          "logically to the story. Do not repeat dialogue or use filler. " +
          "Create filmable visual actions, practical camera directions, " +
          "appropriate sound design, and specific story-driven scene hooks. " +
          "Do not copy existing films, scripts, or copyrighted characters.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.35,
    top_p: 0.8,
    repetition_penalty: 1.15,
  });

  return getText(result).trim();
}

function cleanInput(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, 3000) || fallback;
}

function getSceneCount(minutes: number): number {
  if (minutes === 1) return 4;
  if (minutes === 3) return 8;
  if (minutes === 5) return 12;
  return 20;
}

function hasSceneHeadings(text: string, expected: number): boolean {
  const matches = [
    ...text.matchAll(
      /^\s*(?:#{1,6}\s*)?(?:SCENE|EKSENA)\s*#?\s*(\d+)\b/gim
    ),
  ];

  const numbers = new Set(matches.map((match) => Number(match[1])));

  return (
    numbers.size === expected &&
    Array.from({ length: expected }, (_, i) => i + 1)
      .every((number) => numbers.has(number))
  );
}

function hasExcessiveRepetition(text: string): boolean {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.toLowerCase().replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 80);

  const seen = new Set<string>();

  for (const paragraph of paragraphs) {
    if (seen.has(paragraph)) return true;
    seen.add(paragraph);
  }

  return false;
}

async function createDramaPlan(
  env: Env,
  body: Record<string, unknown>
): Promise<string> {
  const idea = cleanInput(body.idea, "");

  if (!idea) {
    throw new Error("Ilagay muna ang ideya ng iyong kuwento.");
  }

  const language = cleanInput(body.language, "Tagalog");
  const genre = cleanInput(body.genre, "Drama");
  const visualStyle = cleanInput(
    body.visualStyle,
    "Cinematic realistic"
  );

  let minutes = Number(body.durationMinutes);

  if (![1, 3, 5, 10].includes(minutes)) {
    minutes = 1;
  }

  const totalSeconds = minutes * 60;
  const sceneCount = getSceneCount(minutes);
  const baseDuration = Math.floor(totalSeconds / sceneCount);
  const extraSeconds = totalSeconds % sceneCount;

  const durations = Array.from(
    { length: sceneCount },
    (_, i) => baseDuration + (i < extraSeconds ? 1 : 0)
  );

  // STEP 1: Create one shared story blueprint.
  const blueprint = await generate(
    env,
    `
Create a complete ORIGINAL short-film STORY BLUEPRINT.

USER IDEA:
${idea}

LANGUAGE: ${language}
GENRE: ${genre}
VISUAL STYLE: ${visualStyle}
TOTAL RUNTIME: ${totalSeconds} seconds
EXACT SCENE COUNT: ${sceneCount}

Write all story content in ${language}.

Include:
1. Original title and one-sentence logline.
2. Character bible: name, age, appearance, clothing, personality,
   motivation, relationships, and speaking style.
3. Setting, time period, and important objects.
4. Complete beginning, escalating conflict, climax, and ending.
5. A numbered outline for exactly ${sceneCount} scenes.
6. The specific event that connects each scene to the next.
7. The final reveal or resolution.

Make every plot event logical. Keep character and location details fixed.
Do not write the full scene dialogue yet.
Return a concise but complete blueprint.
`,
    2500
  );

  if (!blueprint) {
    throw new Error("Hindi nakagawa ng story blueprint. Subukan ulit.");
  }

  // STEP 2: Generate each scene using the same blueprint.
  const scenes: string[] = [];

  for (let i = 0; i < sceneCount; i++) {
    const duration = durations[i];
    const previousScene = scenes.length
      ? scenes[scenes.length - 1]
      : "Wala pa. Ito ang unang eksena.";

    const scene = await generate(
      env,
      `
Write ONLY SCENE ${i + 1} of an original short film.

FIXED STORY BLUEPRINT:
${blueprint}

USER'S ORIGINAL IDEA:
${idea}

LANGUAGE: ${language}
GENRE: ${genre}
VISUAL STYLE: ${visualStyle}

SCENE NUMBER: ${i + 1} of ${sceneCount}
EXACT DURATION: ${duration} seconds

PREVIOUS SCENE FOR CONTINUITY:
${previousScene.slice(-1800)}

Write all story content in ${language}.
Use the blueprint as the source of truth. Do not change character
names, appearance, relationships, motivations, setting, or story facts.
Continue naturally from the previous scene.

Required format:

SCENE ${i + 1} — [short title]
DURATION: ${duration} seconds
LOCATION:
CHARACTERS PRESENT:
VISUAL ACTION: Specific chronological actions that can be filmed.
DIALOGUE: Natural, concise dialogue with speaker names.
CAMERA: Practical shot types and camera movement.
SOUND: Relevant ambience, effects, and music.
ENDING HOOK: A specific reveal, decision, threat, or visual event
that advances this story. For the final scene, give the real ending.

Rules:
- Every field must contain useful information.
- Do not add characters or events that contradict the blueprint.
- Do not repeat the previous scene.
- Dialogue must fit the duration.
- Avoid vague, nonsensical, or unrelated lines.
- Return only this one scene, not the entire plan.
`,
      1200
    );

    if (!scene) {
      throw new Error(
        `Hindi nabuo ang Scene ${i + 1}. Subukan ulit ang drama plan.`
      );
    }

    scenes.push(scene);
  }

  // STEP 3: Assemble the plan and check the scene count.
  const plan = [
    "DRAMA TITLE AND STORY PLAN",
    "",
    "STORY BLUEPRINT:",
    blueprint,
    "",
    "SCENE PLAN:",
    "",
    ...scenes.flatMap((scene, i) => [
      scene,
      ...(i < scenes.length - 1 ? [""] : []),
    ]),
    "",
    "CONTINUITY NOTE:",
    "All scenes follow the shared story blueprint above.",
  ].join("\n");

  if (!hasSceneHeadings(
    scenes.map((scene) => {
      const match = scene.match(/^\s*(?:#{1,6}\s*)?(?:SCENE|EKSENA)\s*#?\s*(\d+)\b/im);
      return match ? `SCENE ${match[1]}` : scene;
    }).join("\n"),
    sceneCount
  )) {
    throw new Error(
      "Hindi pumasa sa scene numbering check. Subukan ulit."
    );
  }

  if (hasExcessiveRepetition(scenes.join("\n\n"))) {
    throw new Error(
      "May magkaparehong mahahabang talata sa scenes. Subukan ulit."
    );
  }

  return plan;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "AI Drama Studio",
        model: MODEL,
      });
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const body = await request.json() as Record<string, unknown>;
        const plan = await createDramaPlan(env, body);

        return json({ success: true, plan });
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "May hindi inaasahang problema sa paggawa ng drama plan.";

        return json({
          success: false,
          error: message,
          message,
        }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
