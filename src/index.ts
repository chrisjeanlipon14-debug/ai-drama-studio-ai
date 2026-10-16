
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
    return value.content.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const part = item as Record<string, unknown>;
        if (typeof part.text === "string") return part.text;
      }
      return "";
    }).filter(Boolean).join("\n");
  }

  return "";
}

async function generate(
  env: Env,
  system: string,
  prompt: string,
  maxTokens = 1400
): Promise<string> {
  const result = await env.AI.run(MODEL, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.4,
  });

  const output = extractText(result).trim();
  if (!output) throw new Error("Walang output mula sa AI model.");
  return output;
}

function getSceneCount(minutes: number): number {
  if (minutes === 1) return 4;
  if (minutes <= 3) return 8;
  if (minutes <= 5) return 10;
  return 16;
}

function languageRules(language: string): string {
  const lang = language.toLowerCase();

  if (lang.includes("english")) {
    return "Write in natural, fluent English. Avoid repetition and literal translations.";
  }

  if (lang.includes("taglish")) {
    return "Use natural Filipino Taglish, like real Filipinos speak. Do not force English into every sentence.";
  }

  return `
Write in natural, conversational Filipino Tagalog.
Use words ordinary Filipinos actually say.
Avoid literal translations, awkward grammar, and robotic dialogue.
Never use phrases like "mata ng lawak", "kotseng naka-tatag",
or "bakit mo nangangako ng mga tanong".
Describe appearance clearly and briefly.
Do not repeat the same physical trait again and again.
`;
}

function normalize(text: string): string {
  return text.toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasExcessiveRepetition(text: string): boolean {
  const normalized = normalize(text);
  const lines = text.split("\n")
    .map((line) => normalize(line))
    .filter((line) => line.length >= 35);

  const counts = new Map<string, number>();

  for (const line of lines) {
    const count = (counts.get(line) || 0) + 1;
    counts.set(line, count);
    if (count >= 3) return true;
  }

  const words = normalized.split(" ");
  const phrases = new Map<string, number>();

  for (let i = 0; i <= words.length - 6; i++) {
    const phrase = words.slice(i, i + 6).join(" ");
    if (phrase.length < 25) continue;

    const count = (phrases.get(phrase) || 0) + 1;
    phrases.set(phrase, count);
    if (count >= 4) return true;
  }

  return false;
}

function sceneHeadingsPresent(
  text: string,
  start: number,
  end: number
): boolean {
  for (let number = start; number <= end; number++) {
    const pattern = new RegExp(
      "SCENE\\s+" + number + "\\s*[-—:]",
      "i"
    );
    if (!pattern.test(text)) return false;
  }
  return true;
}

function sceneDurations(minutes: number, count: number): number[] {
  const totalSeconds = minutes * 60;
  const base = Math.floor(totalSeconds / count);
  const remainder = totalSeconds % count;

  return Array.from({ length: count }, (_, index) =>
    base + (index < remainder ? 1 : 0)
  );
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
    const style = String(body.visualStyle || "Cinematic realistic");

    const requestedMinutes = Number(body.durationMinutes || 1);
    const minutes = Number.isFinite(requestedMinutes)
      ? Math.min(10, Math.max(1, Math.round(requestedMinutes)))
      : 1;

    if (idea.length < 8) {
      return json({
        success: false,
        error: "Maglagay ng mas malinaw na ideya ng drama.",
      }, 400);
    }

    const count = getSceneCount(minutes);
    const durations = sceneDurations(minutes, count);
    const lang = languageRules(language);

    const system = `
You are a professional original drama screenwriter and video production planner.

STORY:
Create a logical, emotional, specific story with a beginning, escalation, reveal, and ending.
Every scene must change the situation or reveal important information.
Never replace the user's story idea with an unrelated story.
Characters must have consistent identities, relationships, knowledge, and motivations.

DIALOGUE:
Write natural, believable dialogue.
Never repeat the same question, answer, or sentence in different scenes.
No filler conversations.
Do not make every character smile or ask questions constantly.

VISUALS:
Describe only things a camera can show.
Keep faces, clothing, locations, and props consistent.
Do not repeat descriptions of eyes, faces, roads, lighting, or other details.
Negative prompts must describe visual errors to avoid, not negate the main characters.

${lang}
`;

    // PHASE 1: Establish story logic before writing scenes.
    const blueprint = await generate(
      env,
      system,
      `
Create the complete story bible and scene outline.

USER'S IDEA:
${idea}

GENRE: ${genre}
LANGUAGE: ${language}
VISUAL STYLE: ${style}
LENGTH: ${minutes} minute(s)
EXACT SCENE COUNT: ${count}

Write these sections:

1. TITLE
One memorable title.

2. CENTRAL STORY
Explain the protagonist, goal, conflict, stakes, and specific central secret in 4–6 sentences.

3. CHARACTER BIBLE
Create 2–4 characters. For each, provide name, age, concise appearance, clothing, personality, motivation, relationships, and what the character knows.
Describe each physical trait only once. Never repeat a trait to fill space.

4. CONTINUITY LOCK
Fix the clothing, locations, time, important props, and relationships.

5. COMPLETE PLOT
State the actual truth, reveal, and ending clearly. Do not use vague phrases like "she discovers a secret" without explaining the secret.

6. SCENE MAP
List exactly ${count} scenes. Give every scene a different event, purpose, and consequence. Scene 1 must hook the viewer. The final scene must resolve the central question or deliver a logical twist.

Avoid repetition. Do not invent contradictory relationships or confuse whose mother, diary, or secret is involved.
Keep the output concise enough to use as a guide for every scene.
`,
      1400
    );

    const sceneBatches: string[] = [];
    const batchSize = 2;

    // PHASE 2: Generate small batches to reduce repetition.
    for (let start = 1; start <= count; start += batchSize) {
      const end = Math.min(start + batchSize - 1, count);

      const scenePrompt = `
Write scenes ${start} through ${end} only.

APPROVED STORY BIBLE:
${blueprint}

Use the story bible as fixed canon. Do not change the characters, central secret, relationships, or ending.

Required duration for each scene:
${Array.from({ length: end - start + 1 }, (_, i) =>
  "Scene " + (start + i) + ": " + durations[start + i - 1] + " seconds"
).join("\n")}

For each scene, use exactly this structure:

SCENE [number] — [specific title]
DURATION: [use the exact duration above]

STORY ACTION:
Write 2–4 concrete sentences. Show what happens and how it changes the situation.

DIALOGUE:
Write 2–4 short, natural lines when appropriate.
Format: CHARACTER NAME: spoken words.
Each line must reveal something, show emotion, or move the plot forward.
Do not repeat dialogue from any previous scene.

CAMERA:
Give one practical camera shot or movement.

LIGHTING AND SOUND:
Specify the lighting and relevant ambient sound or effects for this scene.

VIDEO GENERATION PROMPT:
Write a self-contained visual prompt in ${style} style.
Include only the characters present, their consistent appearance and clothing, location, visible action, emotion, camera movement, lighting, and atmosphere.
Avoid vague descriptions and repeated phrases.

NEGATIVE PROMPT:
Give a concise list of visual errors to avoid, such as distorted hands, face changes, duplicate characters, flickering, inconsistent clothing, unwanted text, logos, or watermarks.
Do not say to remove the main characters or required objects.

STRICT RULES:
- Include every requested scene number.
- Each scene must contain a distinct event.
- Do not repeat a character description unnecessarily.
- Do not replace important story events with unrelated small talk.
- Do not add random details to fill space.
- Do not repeat the story bible word-for-word.
- Follow the requested language naturally.
${lang}
`;

      let batch = await generate(
        env,
        system,
        scenePrompt,
        1300
      );

      // Repair once when scene headings are missing or output repeats.
      if (
        !sceneHeadingsPresent(batch, start, end) ||
        hasExcessiveRepetition(batch)
      ) {
        batch = await generate(
          env,
          system,
          `
REWRITE AND REPAIR the draft below.
Required scene numbers: ${start} through ${end}.
Keep the approved story, character identities, continuity, and reveal unchanged.
Remove repeated phrases, repetitive dialogue, awkward language, and irrelevant details.
Use the exact scene structure and durations in the draft instructions.
Return only the repaired scenes.

APPROVED STORY BIBLE:
${blueprint}

DRAFT:
${batch}

${lang}
`,
          1300
        );
      }

      if (!sceneHeadingsPresent(batch, start, end)) {
        throw new Error(
          "Hindi kumpleto ang mga eksena " + start + "–" + end +
          ". Subukan muli. Hindi ibinalik ang kulang na plano."
        );
      }

      if (hasExcessiveRepetition(batch)) {
        throw new Error(
          "May sobrang pag-uulit sa mga eksena " + start + "–" + end +
          ". Hindi ibinalik ang output na may nakitang depekto."
        );
      }

      sceneBatches.push(batch.trim());
    }

    const plan = [
      "AI DRAMA STUDIO — COMPLETE DRAMA PRODUCTION PLAN",
      "",
      "STORY BIBLE AND CONTINUITY",
      blueprint,
      "",
      "SCENE-BY-SCENE PRODUCTION PLAN",
      sceneBatches.join("\n\n========================================\n\n"),
      "",
      "FINAL PRODUCTION CHECK",
      "Scene count: " + count,
      "Total planned duration: " + (minutes * 60) + " seconds",
      "Use the character bible as the visual reference for all generated clips.",
    ].join("\n");

    return json({
      success: true,
      plan,
      model: MODEL,
      durationMinutes: minutes,
      language,
      genre,
      sceneCount: count,
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Hindi inaasahang error sa pagbuo ng drama.";

    return json({
      success: false,
      error: "Hindi nabuo ang drama plan. " + message,
    }, 500);
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

    return env.ASSETS.fetch(request);
  },
};