
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
type Mode = "movie" | "short";

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

function getText(result: any): string {
  if (typeof result === "string") return result;

  const output =
    result?.response ??
    result?.result?.response ??
    "";

  return typeof output === "string" ? output.trim() : "";
}

async function runAI(
  env: Env,
  messages: Array<{ role: string; content: string }>,
  maxTokens = 6000
): Promise<string> {
  const model = env.AI_MODEL || MODEL_DEFAULT;

  const result = await env.AI.run(model, {
    messages,
    max_tokens: maxTokens,
    temperature: 0.65
  });

  const output = getText(result);

  if (!output) {
    throw new Error("Walang valid na response mula sa AI model.");
  }

  return output;
}

function systemPrompt(
  genre: string,
  language: string,
  style: string,
  aspect: string,
  mode: Mode
): string {
  return `
You are AI DRAMA STUDIO, an expert original film screenwriter,
story editor and cinematic pre-production assistant.

PRODUCTION MODE: ${mode === "movie" ? "FULL MOVIE" : "SHORT DRAMA"}
GENRE: ${genre}
LANGUAGE: ${language}
VISUAL STYLE: ${style}
ASPECT RATIO: ${aspect}

LANGUAGE QUALITY RULES:
- Write natural, grammatically correct ${language}.
- If Tagalog is selected, use natural Filipino expressions.
- Never use awkward literal translations or meaningless phrases.
- Never repeat dialogue simply to fill a scene.
- Use clear, simple and emotionally believable sentences.
- Avoid phrases such as "malakas na pagtibay ng liwanag"
  or other unnatural machine-generated wording.
- Use proper character names and natural dialogue tags.

GENRE RULES:
- Love Story: romance, chemistry, emotional conflict and believable relationships.
- Horror: suspense, mystery, frightening atmosphere and logical reveals.
- Family Drama: family conflict, secrets, sacrifice and relationships.
- Revenge: betrayal, consequences and a meaningful resolution.
- Fantasy: imaginative worlds, magic and consistent world rules.
- Comedy: natural humor, funny situations and entertaining dialogue.
- Roblox Story: original Roblox-inspired blocky 3D game world,
  avatars, environments, game mechanics and adventures.
- Action / Adventure: exciting challenges, clear stakes and cinematic action.
- Kids / Animal Learning: child-friendly animal characters and simple lessons.
- Inspirational Story: struggles, hope, courage and life lessons.

CHARACTER CONSISTENCY:
- Create a fixed character bible.
- Give each character clear, sensible physical traits.
- Describe eyes using realistic colors such as brown, black or blue.
- Never use descriptions such as "eyes of a man".
- Keep face, hair, age, body type, clothes and personality consistent.
- Repeat the same locked visual description in every relevant video prompt.
- For Roblox, keep avatar design, clothing, colors and proportions consistent.

STORY QUALITY:
- Follow the user's original premise and requested ending.
- Create original material. Do not copy existing films, shows or games.
- Every scene must advance the story.
- Give every character a believable motivation.
- Establish causes before consequences.
- Make conflicts understandable.
- Do not introduce unexplained twists.
- Each scene must connect logically to the next.
- Dialogue must sound like real people speaking.
- Do not repeat an earlier scene with different wording.
- Give the story a strong beginning, rising conflict, climax and resolution.
- Make the ending consistent with the events and relationships.

CINEMATIC PRODUCTION:
- Give filmable actions, not vague descriptions.
- Specify camera framing and movement.
- Include lighting, environment and sound design.
- Video prompts must describe one coherent scene.
- Avoid contradictory visual instructions.
- Keep the requested aspect ratio.

OUTPUT HONESTY:
- You generate text, screenplays and video prompts only.
- Never claim an MP4 has been rendered.
- Never invent a completed video or download link.

SAFETY:
- Do not create sexual content involving minors.
- All romantic characters must be adults.

Return clear, polished and production-ready writing.
`;
}

function openingTask(
  idea: string,
  duration: number,
  mode: Mode
): string {
  return `
USER STORY IDEA:
${idea}

TARGET LENGTH: ${duration} minutes.
PRODUCTION MODE: ${mode}

TASK:
Create ONLY the opening scene.

Include:
1. Original working title.
2. One-sentence logline.
3. Main character descriptions.
4. Location and atmosphere.
5. Opening scene duration.
6. Clear visual actions.
7. Natural dialogue appropriate to the characters.
8. Camera directions.
9. Lighting and sound.
10. Continuity notes.
11. Detailed standalone video-generation prompt.
12. A compelling ending hook.

For SHORT DRAMA:
Make the opening immediately engaging and suitable for a short episode.
Use a strong hook within the first few seconds.

For FULL MOVIE:
Establish the main character, setting and central conflict.
Create curiosity without revealing the entire story.

Do not write the complete screenplay yet.
`;
}

function fullTask(
  idea: string,
  opening: string,
  duration: number,
  mode: Mode
): string {
  const shortMode = mode === "short";

  return `
USER STORY IDEA:
${idea}

APPROVED OPENING SCENE:
${opening}

TARGET LENGTH: ${duration} minutes.
PRODUCTION MODE: ${shortMode ? "SHORT DRAMA" : "FULL MOVIE"}.

TASK:
Create a complete screenplay and cinematic production plan.

REQUIRED SECTIONS:

1. FINAL TITLE AND LOGLINE

2. COMPLETE STORY SYNOPSIS
Explain the beginning, conflict, escalation, climax and ending.

3. LOCKED CHARACTER BIBLE
Give each character a fixed appearance, personality, motivation
and relationship to other characters.

4. VISUAL WORLD
Describe the locations and visual atmosphere.

5. SCENE-BY-SCENE SCREENPLAY

For every scene provide:
- Scene number and title
- Estimated duration
- Location and characters present
- Clear visual actions
- Natural dialogue
- Camera framing and movement
- Lighting and sound
- Emotional purpose
- Continuity from the previous scene
- Detailed standalone video-generation prompt
- Fixed character descriptions where applicable

6. CLIMAX
Create a meaningful confrontation or major turning point.

7. FINAL SCENE
Give the story a logical and satisfying conclusion.

8. CONTINUITY SUMMARY
Summarize the character appearances and important story facts
that must remain consistent during production.

MODE REQUIREMENTS:

${shortMode ? `
SHORT DRAMA MODE:
- Structure the story as a short episode.
- Make the first few seconds engaging.
- Use concise but meaningful scenes.
- Build an emotional hook.
- End with a memorable conclusion or episode cliffhanger.
- Respect the requested duration.
` : `
FULL MOVIE MODE:
- Develop a complete beginning, middle and ending.
- Give important characters room to develop.
- Build conflict gradually.
- Include meaningful turning points.
- Resolve the main story instead of stopping abruptly.
- Respect the requested duration.
`}

IMPORTANT:
Do not repeat the same dialogue.
Do not invent contradictory character traits.
Do not use meaningless descriptions.
Do not add scenes that do not advance the story.
Make the entire screenplay coherent and filmable.
`;
}

const REVIEW_PROMPT = `
You are the screenplay quality editor for AI DRAMA STUDIO.

Review the screenplay below.

Check:
1. Natural and grammatically correct Tagalog or selected language.
2. Awkward, meaningless or machine-translated phrases.
3. Character appearance and personality consistency.
4. Repeated dialogue or duplicated scenes.
5. Logical cause and effect.
6. Scene-to-scene continuity.
7. Consistent locations, timeline and character relationships.
8. A meaningful climax and satisfying ending.
9. Whether every scene has a clear purpose.
10. Whether the video prompts are filmable and visually consistent.

Rewrite and correct the screenplay itself.
Do not return a list of criticisms.
Do not explain your editing process.
Preserve the user's intended story and genre.
Return only the corrected screenplay.
`;

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
        mode: "full-movie-and-short-drama",
        model: env.AI_MODEL || MODEL_DEFAULT,
        qualityReview: true,
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

    const mode: Mode =
      settings.mode === "movie" ? "movie" : "short";

    const duration = Math.max(
      1,
      Math.min(20, Number(settings.duration) || 5)
    );

    if (!["opening", "full"].includes(action)) {
      return json({ error: "Unsupported action." }, 400);
    }

    if (!idea) {
      return json({ error: "Ilagay muna ang story idea." }, 400);
    }

    if (idea.length > 18000) {
      return json({
        error: "Maximum 18,000 characters lamang."
      }, 413);
    }

    if (action === "full" && body?.approved !== true) {
      return json({
        error: "Kailangan munang i-approve ang Opening Scene."
      }, 403);
    }

    if (
      action === "full" &&
      (
        typeof body?.opening !== "string" ||
        !body.opening.trim() ||
        body.opening.length > 30000
      )
    ) {
      return json({
        error: "Missing or invalid approved opening scene."
      }, 400);
    }

    const system = systemPrompt(
      genre,
      language,
      style,
      aspect,
      mode
    );

    try {
      if (action === "opening") {
        const text = await runAI(
          env,
          [
            { role: "system", content: system },
            {
              role: "user",
              content: openingTask(idea, duration, mode)
            }
          ],
          3500
        );

        return json({
          ok: true,
          action,
          mode,
          genre,
          text,
          outputType: "text-only",
          generatedAt: new Date().toISOString()
        });
      }

      const draft = await runAI(
        env,
        [
          { role: "system", content: system },
          {
            role: "user",
            content: fullTask(
              idea,
              body.opening,
              duration,
              mode
            )
          }
        ],
        6000
      );

      let finalText = draft;
      let qualityReview = "draft-only";

      try {
        finalText = await runAI(
          env,
          [
            {
              role: "system",
              content: system + "\n\n" + REVIEW_PROMPT
            },
            {
              role: "user",
              content: draft
            }
          ],
          6000
        );

        qualityReview = "reviewed";
      } catch {
        // Preserve the original draft if the review request fails.
        finalText = draft;
        qualityReview = "review-unavailable";
      }

      return json({
        ok: true,
        action,
        mode,
        genre,
        text: finalText,
        qualityReview,
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
