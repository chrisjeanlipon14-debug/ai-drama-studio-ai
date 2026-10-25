
interface Env {
  AI: {
    run: (
      model: string,
      input: Record<string, unknown>
    ) => Promise<unknown>;
  };
  MAGIC_HOUR_API_KEY: string;
  VIDEO_ACCESS_CODE: string;
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Video-Access",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
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
      const choice = value.choices[0] as
        | Record<string, unknown>
        | undefined;
      const message = choice?.message as
        | Record<string, unknown>
        | undefined;

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
                  "You are a professional screenwriter who creates original, cinematic stories. " +
        "When the requested language is Tagalog, use natural, fluent Filipino as spoken in everyday life in the Philippines. " +
        "Never use awkward literal translations, invented words, or unnatural phrasing. " +
        "Write realistic dialogue that matches each character's age, personality, emotions, and social background. " +
        "Keep every character's name, age, appearance, clothing, relationships, and personality consistent throughout the story. " +
        "Follow the user's story idea and requested genre. Give every scene a clear purpose, believable actions, and natural transitions. " +
        "Use correct grammar, clear scene directions, and meaningful dialogue. Avoid repetitive crying, repetitive lines, and unnecessary narration. " +
        "Do not copy existing films or scripts. Return only the requested content.",
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

function cleanInput(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, 3000) || fallback;
}

function getSettings(body: Record<string, unknown>) {
  const idea = cleanInput(body.idea);
  const language = cleanInput(body.language, "Tagalog");
  const genre = cleanInput(body.genre, "Drama");
  const visualStyle = cleanInput(body.visualStyle, "Cinematic realistic");

  let minutes = Number(body.durationMinutes);
  if (![1, 3, 5, 10].includes(minutes)) minutes = 1;

  if (!idea || idea.length < 8) {
    throw new Error("Maglagay muna ng mas malinaw na ideya ng kuwento.");
  }

  return { idea, language, genre, visualStyle, minutes };
}

function getSceneCount(minutes: number): number {
  if (minutes === 1) return 4;
  if (minutes === 3) return 8;
  if (minutes === 5) return 12;
  return 20;
}

async function createBlueprint(
  env: Env,
  settings: ReturnType<typeof getSettings>
): Promise<string> {
  const { idea, language, genre, visualStyle, minutes } = settings;
  const sceneCount = getSceneCount(minutes);

  const blueprint = await generate(
    env,
    `Create an original short-film story blueprint.

USER IDEA: ${idea}
LANGUAGE: ${language}
GENRE: ${genre}
VISUAL STYLE: ${visualStyle}
RUNTIME: ${minutes} minutes
SCENE COUNT: ${sceneCount}

Write in ${language}. Include:
1. Original title and logline.
2. Character bible: names, ages, appearance, clothing, personality,
   motivations, relationships, and speaking style.
3. Setting and important objects.
4. Beginning, conflict, climax, and ending.
5. Numbered outline for exactly ${sceneCount} scenes.
6. Logical transitions between scenes.

Keep every character and story fact consistent.
Do not write full scene dialogue yet.`,
    2200
  );

  if (!blueprint) {
    throw new Error("Hindi nagawa ang story blueprint. Subukan ulit.");
  }

  return blueprint;
}

async function createOpening(
  env: Env,
  settings: ReturnType<typeof getSettings>,
  blueprint: string
): Promise<string> {
  const scene = await generate(
    env,
    `Write ONLY the opening scene of this original film.

STORY BLUEPRINT:
${blueprint}

IDEA: ${settings.idea}
LANGUAGE: ${settings.language}
GENRE: ${settings.genre}
VISUAL STYLE: ${settings.visualStyle}

Write in ${settings.language}.
Keep all character and setting details consistent.

Required format:
SCENE 1 — [short title]
DURATION: ${Math.floor(settings.minutes * 60 / getSceneCount(settings.minutes))} seconds
LOCATION:
CHARACTERS PRESENT:
VISUAL ACTION:
DIALOGUE:
CAMERA:
SOUND:
ENDING HOOK:

Make the opening engaging, filmable, and logically connected to the
story. Use natural dialogue and return only Scene 1.`,
    1200
  );

  if (!scene || !/^\s*(?:#{1,6}\s*)?(?:SCENE|EKSENA)\s*#?\s*1\b/im.test(scene)) {
    throw new Error("Hindi nagawa nang tama ang Opening Scene. Subukan ulit.");
  }

  return scene;
}

async function createRemainingScenes(
  env: Env,
  settings: ReturnType<typeof getSettings>,
  blueprint: string,
  opening: string
): Promise<string> {
  const sceneCount = getSceneCount(settings.minutes);
  const totalSeconds = settings.minutes * 60;
  const baseDuration = Math.floor(totalSeconds / sceneCount);
  const extraSeconds = totalSeconds % sceneCount;
  const scenes = [opening];

  for (let i = 2; i <= sceneCount; i++) {
    const duration = baseDuration + (i <= extraSeconds ? 1 : 0);
    const previousScene = scenes[scenes.length - 1];

    const scene = await generate(
      env,
      `Write ONLY SCENE ${i} of this original film.

FIXED STORY BLUEPRINT:
${blueprint}

USER IDEA: ${settings.idea}
LANGUAGE: ${settings.language}
GENRE: ${settings.genre}
VISUAL STYLE: ${settings.visualStyle}

PREVIOUS SCENE:
${previousScene.slice(-1800)}

Write in ${settings.language}. Preserve all established character,
appearance, relationship, location, and story facts. Continue naturally.

Required format:
SCENE ${i} — [short title]
DURATION: ${duration} seconds
LOCATION:
CHARACTERS PRESENT:
VISUAL ACTION:
DIALOGUE:
CAMERA:
SOUND:
ENDING HOOK:

The last scene must deliver a real ending. Do not repeat the previous
scene. Return only Scene ${i}.`,
      1000
    );

     if (
  !scene ||
  !scene.trim() ||
  !/(?:SCENE|EKSENA)\s*#?\s*1\b/i.test(scene)
) {
  throw new Error("Hindi nagawa nang tama ang Opening Scene. Subukan ulit.");
}

    scenes.push(scene);
  }

  return [
    "DRAMA TITLE AND STORY PLAN",
    "",
    "STORY BLUEPRINT:",
    blueprint,
    "",
    "SCENE PLAN:",
    "",
    scenes.join("\n\n"),
    "",
    "CONTINUITY NOTE:",
    "The scenes follow the supplied story blueprint.",
  ].join("\n");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "AI Drama Studio",
        model: MODEL,
      });
    }

    if (url.pathname === "/api/opening" && request.method === "POST") {
      try {
        const body = await request.json() as Record<string, unknown>;
        const settings = getSettings(body);
        const blueprint = await createBlueprint(env, settings);
        const opening = await createOpening(env, settings, blueprint);

        return json({
          success: true,
          blueprint,
          opening,
          settings,
        });
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "Hindi nagawa ang Opening Scene.";

        return json({ success: false, error: message }, 500);
      }
    }

    if (url.pathname === "/api/continue" && request.method === "POST") {
      try {
        const body = await request.json() as Record<string, unknown>;
        const settings = getSettings(body);
        const blueprint = cleanInput(body.blueprint);
        const opening = cleanInput(body.opening);

        if (!blueprint || !opening) {
          return json({
            success: false,
            error: "Kulang ang blueprint o Opening Scene. Gumawa muna ng bagong draft.",
          }, 400);
        }

        if (
          !/^\s*(?:#{1,6}\s*)?(?:SCENE|EKSENA)\s*#?\s*1\b/im.test(opening)
        ) {
          return json({
            success: false,
            error: "Hindi valid ang Opening Scene.",
          }, 400);
        }

        const plan = await createRemainingScenes(
          env,
          settings,
          blueprint,
          opening
        );

        return json({ success: true, plan });
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "Hindi nakumpleto ang drama plan.";

        return json({ success: false, error: message }, 500);
      }
    }

    /*
     * Video generation is intentionally disabled in this workflow.
     * This prevents accidental paid requests while the approval flow
     * is being tested. Restore the video endpoint only after its
     * provider request and job-status workflow have been verified.
     */
    if (url.pathname === "/api/video" && request.method === "POST") {
      return json({
        success: false,
        error: "Pansamantalang naka-disable ang video generation habang sinusubukan ang approval workflow.",
      }, 503);
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return json({
        success: false,
        error: "Gamitin ang /api/opening para sa Opening Scene.",
      }, 400);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
