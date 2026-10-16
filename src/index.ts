
interface Env {
  AI: {
    run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
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
  if (!result || typeof result !== "object") return "";

  const value = result as Record<string, unknown>;

  if (typeof value.response === "string") return value.response;
  if (typeof value.text === "string") return value.text;

  if (Array.isArray(value.content)) {
    return value.content
      .map((part) => {
        if (typeof part === "string") return part;

        if (
          part &&
          typeof part === "object" &&
          typeof (part as Record<string, unknown>).text === "string"
        ) {
          return (part as Record<string, unknown>).text as string;
        }

        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

async function generate(
  env: Env,
  system: string,
  prompt: string,
  maxTokens = 1500
): Promise<string> {
  const result = await env.AI.run(MODEL, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.45,
  });

  const output = extractText(result).trim();

  if (!output) {
    throw new Error("Walang tekstong ibinalik ang AI model.");
  }

  return output;
}

function sceneCountFor(minutes: number): number {
  if (minutes <= 1) return 4;
  if (minutes <= 3) return 8;
  if (minutes <= 5) return 10;
  return 16;
}

function languageInstruction(language: string): string {
  const value = language.toLowerCase();

  if (value.includes("english")) {
    return "Write all story text and dialogue in natural, fluent English. Avoid repetition and literal translation.";
  }

  if (value.includes("taglish")) {
    return "Write in natural Filipino Taglish, like real Filipinos speak. Do not force English into every line.";
  }

  return `
Write in natural, conversational Filipino Tagalog.
Use common words that Filipinos actually say.
Prefer short, believable dialogue.
NEVER use awkward literal translations such as:
"mata ng lawak", "lugar ng pangingibabaw",
or "bakit mo nangangako ng mga tanong".
Describe a character's appearance in ordinary, clear language.
Do not translate English idioms word-for-word.
`;
}

function hasRepeatedLines(text: string): boolean {
  const lines = text
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length >= 22);

  const counts = new Map<string, number>();

  for (const line of lines) {
    counts.set(line, (counts.get(line) || 0) + 1);
  }

  return Array.from(counts.values()).some((count) => count >= 3);
}

function hasSceneHeadings(
  text: string,
  start: number,
  end: number
): boolean {
  for (let n = start; n <= end; n++) {
    const heading = new RegExp(
      "SCENE\\s+" + n + "\\s*[-—:]",
      "i"
    );

    if (!heading.test(text)) return false;
  }

  return true;
}

async function handleChat(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await request.json() as Record<string, unknown>;

    const idea = String(body.idea || "").trim();
    const language = String(body.language || "Tagalog");
    const genre = String(body.genre || "Drama");
    const style = String(
      body.visualStyle || "Cinematic realistic"
    );

    const rawMinutes = Number(body.durationMinutes || 1);

    const minutes = Number.isFinite(rawMinutes)
      ? Math.min(10, Math.max(1, Math.round(rawMinutes)))
      : 1;

    const totalScenes = sceneCountFor(minutes);

    if (idea.length < 8) {
      return json(
        {
          success: false,
          error:
            "Maglagay ng mas malinaw na ideya ng drama (hindi bababa sa 8 character).",
        },
        400
      );
    }

    const lang = languageInstruction(language);

    const system = [
      "You are a professional original short-drama screenwriter and film production planner.",
      "STORY LOGIC: Every event must have a clear cause and consequence. Every scene changes the situation, reveals evidence, deepens a relationship, or raises stakes.",
      "CHARACTER LOGIC: Characters have distinct motivations. They do not know information unless they learned it in the story. Never confuse whose mother, diary, letter, or secret is being discussed.",
      "DIALOGUE: Short, specific, believable lines. Do not repeat the same question or answer across scenes. No filler dialogue.",
      "VISUALS: Describe things a camera can actually show. Avoid vague phrases, impossible actions, random details, and generic descriptions.",
      "ORIGINALITY: Follow the user's idea and requested genre. Do not copy existing stories or characters.",
      lang,
    ].join("\n");

    // STAGE 1: Create a specific story blueprint.
    const blueprint = await generate(
      env,
      system,
      [
        "Create a precise STORY BIBLE and scene outline for this drama.",
        "USER IDEA: " + idea,
        "GENRE: " + genre +
          " | LANGUAGE: " + language +
          " | VISUAL STYLE: " + style,
        "TARGET LENGTH: " + minutes +
          " minute(s) | EXACTLY " + totalScenes + " scenes.",
        "",
        "Return these sections:",
        "1. TITLE: a memorable title.",
        "2. CENTRAL STORY: 4–6 specific sentences: protagonist, goal, obstacle, stakes, and the actual secret or conflict.",
        "3. CHARACTER BIBLE: 2–4 characters. Give name, age, appearance, personality, motivation, relationships, and what each character knows. Use consistent names; avoid vague labels like 'unknown man' when a real name can be created.",
        "4. CONTINUITY LOCK: fixed wardrobe, location, time, important props, and relationships.",
        "5. FULL PLOT: concrete beginning, escalating middle, reveal, and a satisfying ending. Explicitly state the actual truth or reveal; do not hide it from the production plan.",
        "6. EXACT SCENE MAP: number every scene from 1 to " +
          totalScenes +
          ". Each scene gets one unique event, its consequence, and a clear purpose. Scene 1 hooks the viewer; the final scene resolves the central question or delivers a logical twist.",
        "",
        "Avoid empty phrases like 'a place of failure', 'the truth is the truth', or 'she discovers a secret' without explaining the actual secret.",
        "Make the plot specific and understandable. Keep the blueprint compact but detailed enough to guide all scenes.",
      ].join("\n"),
      1500
    );

    // STAGE 2: Generate small scene batches to help continuity.
    const batches: string[] = [];
    const batchSize = 3;

    for (
      let start = 1;
      start <= totalScenes;
      start += batchSize
    ) {
      const end = Math.min(
        start + batchSize - 1,
        totalScenes
      );

      const prompt = [
        "Write production-ready scenes " +
          start + " through " + end +
          " ONLY, out of " + totalScenes + " scenes.",
        "Use the story bible below as fixed canon. Do not change the reveal, character identities, relationships, timeline, or ending.",
        "STORY BIBLE AND SCENE MAP:\n" + blueprint,
        "",
        "For EACH scene use this exact format:",
        "SCENE [number] — [specific title]",
        "DURATION: [seconds]",
        "STORY ACTION: 2–4 concrete sentences showing visible action and how the situation changes.",
        "DIALOGUE: 2–4 short lines in this format: NAME: spoken words. Every line must sound natural and move the scene forward. Do not repeat lines from previous scenes. Use silence instead if dialogue is unnecessary.",
        "CAMERA: one clear shot or movement that suits the action.",
        "LIGHTING AND SOUND: specific lighting plus useful ambient sound or effects.",
        "VIDEO GENERATION PROMPT: a detailed standalone prompt in " +
          style +
          " style. Include the characters actually present, consistent appearance and clothes, location, visible action, emotion, camera movement, lighting, and atmosphere. Keep character appearances consistent with the story bible.",
        "NEGATIVE PROMPT: unwanted text, subtitles, logos, watermarks, face changes, duplicate people, malformed hands, flicker, inconsistent clothes, and other relevant visual errors.",
        "",
        "Rules: output every scene number requested; no skipped scenes. Do not summarize. Do not repeat the same conversation. Do not use abstract descriptions that cannot be filmed. Do not add props or characters that contradict the story bible.",
        lang,
      ].join("\n");

      let batch = await generate(
        env,
        system,
        prompt,
        1700
      );

      // STAGE 3: Retry once if scene headings are missing
      // or repeated lines are detected.
      if (
        !hasSceneHeadings(batch, start, end) ||
        hasRepeatedLines(batch)
      ) {
        batch = await generate(
          env,
          system,
          [
            "REPAIR TASK: rewrite the scene batch below.",
            "Ensure every requested scene heading is present exactly once, remove repeated lines, and use natural dialogue.",
            "Do not change the approved plot, character identities, continuity, or reveal.",
            "Required scene numbers: " + start + " through " + end + ".",
            "STORY BIBLE:\n" + blueprint,
            "DRAFT TO REPAIR:\n" + batch,
            "Use these sections for every scene: STORY ACTION, DIALOGUE, CAMERA, LIGHTING AND SOUND, VIDEO GENERATION PROMPT, NEGATIVE PROMPT.",
            lang,
          ].join("\n"),
          1700
        );
      }

      if (!hasSceneHeadings(batch, start, end)) {
        throw new Error(
          "Hindi kumpleto ang output ng eksena " +
            start + "–" + end +
            ". Subukan muli gamit ang mas maikling haba ng video."
        );
      }

      batches.push(batch.trim());
    }

    const plan = [
      "AI DRAMA STUDIO — COMPLETE DRAMA PRODUCTION PLAN",
      "",
      "STORY BIBLE AND CONTINUITY",
      blueprint,
      "",
      "SCENE-BY-SCENE PRODUCTION PLAN",
      batches.join(
        "\n\n==================================================\n\n"
      ),
      "",
      "FINAL QUALITY CHECK",
      "- Verify character names, relationships, wardrobe, props, locations, and timeline against the story bible.",
      "- Do not reuse dialogue or change the established reveal.",
      "- Keep each scene prompt self-contained for video generation.",
    ].join("\n");

    return json({
      success: true,
      plan,
      model: MODEL,
      durationMinutes: minutes,
      language,
      genre,
      sceneCount: totalScenes,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Hindi inaasahang error sa pagbuo ng drama.";

    return json(
      {
        success: false,
        error: "Hindi nabuo ang drama plan. " + message,
      },
      500
    );
  }
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
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

    if (
      url.pathname === "/api/health" &&
      request.method === "GET"
    ) {
      return json({
        ok: true,
        service: "AI Drama Studio",
        model: MODEL,
      });
    }

    if (
      url.pathname === "/api/chat" &&
      request.method === "POST"
    ) {
      return handleChat(request, env);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return json(
      { success: false, error: "Hindi nahanap ang page." },
      404
    );
  },
};
