
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

const TEXT_MODEL_DEFAULT =
  "@cf/meta/llama-3.1-8b-instruct-fast";

const VIDEO_MODEL = "pruna/p-video";

const MAX_IDEA_LENGTH = 18000;
const MAX_OPENING_LENGTH = 30000;
const MAX_VIDEO_PROMPT_LENGTH = 5000;
const MAX_REFERENCE_LENGTH = 8_000_000;

const ALLOWED_ASPECTS = [
  "9:16",
  "16:9",
  "1:1",
  "4:3",
  "3:4",
  "3:2",
  "2:3"
];

const ALLOWED_RESOLUTIONS = ["720p", "1080p"];

const ALLOWED_STYLES = [
  "2D Anime",
  "2D Cartoon",
  "2D Cinematic Animation",
  "3D Cartoon Animation",
  "3D Realistic Animation",
  "3D Cinematic Animation",
  "Realistic cinematic human",
  "Roblox-inspired 3D game style"
];

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
  if (typeof result === "string") {
    return result.trim();
  }

  const candidates = [
    result?.response,
    result?.result?.response,
    result?.output_text,
    result?.result?.output_text,
    result?.choices?.[0]?.message?.content,
    result?.result?.choices?.[0]?.message?.content
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function getVideoUrl(result: any): string {
  const candidates = [
    result?.result?.video,
    result?.video,
    result?.result?.result?.video,
    result?.output?.video
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      try {
        const url = new URL(value);

        if (url.protocol === "https:") {
          return url.toString();
        }
      } catch {
        // Ignore invalid video URLs.
      }
    }
  }

  return "";
}

async function runAI(
  env: Env,
  messages: Array<{
    role: string;
    content: string;
  }>,
  maxTokens = 6000
): Promise<string> {
  const model =
    env.AI_MODEL || TEXT_MODEL_DEFAULT;

  const result = await env.AI.run(model, {
    messages,
    max_tokens: maxTokens,
    temperature: 0.65
  });

  const output = getText(result);

  if (!output) {
    throw new Error(
      "Walang valid na response mula sa AI model."
    );
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

PRODUCTION MODE: ${
    mode === "movie" ? "FULL MOVIE" : "SHORT DRAMA"
  }

GENRE: ${genre}
LANGUAGE: ${language}
VISUAL STYLE: ${style}
ASPECT RATIO: ${aspect}

LANGUAGE QUALITY:
- Write natural, grammatically correct ${language}.
- If Tagalog is selected, use natural Filipino expressions.
- Avoid awkward literal translations.
- Never invent meaningless words or phrases.
- Write dialogue that sounds like real people.
- Use correct character names and dialogue tags.

GENRE RULES:
- Love Story: romance, chemistry and believable relationships.
- Horror: suspense, mystery and frightening atmosphere.
- Family Drama: family conflict, secrets and sacrifice.
- Revenge: betrayal, consequences and meaningful resolution.
- Fantasy: imaginative worlds and consistent world rules.
- Comedy: natural humor and entertaining situations.
- Roblox Story: original blocky 3D game world and avatars.
- Action / Adventure: exciting challenges and cinematic action.
- Kids / Animal Learning: child-friendly characters and lessons.
- Inspirational Story: struggle, courage, hope and life lessons.

CHARACTER BIBLE:
- Create a fixed character identity for every main character.
- Specify name, age, face, eyes, hairstyle, hair color,
  body type, clothing, colors and personality.
- Keep these details consistent in all scenes.
- Never change a character's face, hairstyle or clothes
  without a story reason.
- Repeat the locked character appearance in every
  relevant standalone video-generation prompt.
- Keep each character visually distinguishable.

VISUAL FORMAT INSTRUCTIONS:

2D ANIME:
Use clearly illustrated 2D anime artwork,
expressive anime faces, hand-drawn appearance,
anime backgrounds and controlled cinematic movement.
Do not use 3D rendering or live action.

2D CARTOON:
Use flat or layered 2D cartoon illustration,
clean outlines, expressive shapes and smooth
cartoon animation. Do not use 3D rendering.

2D CINEMATIC ANIMATION:
Use detailed 2D illustrated environments,
cinematic composition, layered backgrounds
and smooth animated movement.

3D CARTOON ANIMATION:
Use stylized three-dimensional animated characters,
expressive faces, detailed 3D environments
and polished cartoon rendering.

3D REALISTIC ANIMATION:
Use realistic 3D character anatomy,
detailed materials, natural lighting,
realistic environments and cinematic movement.

3D CINEMATIC ANIMATION:
Use cinematic 3D environments,
detailed character models, dramatic lighting,
depth and polished film-style composition.

REALISTIC CINEMATIC HUMAN:
Use photorealistic human appearance,
natural skin texture, realistic anatomy,
natural expressions and live-action film aesthetics.

ROBLOX-INSPIRED 3D:
Use original blocky game avatars,
recognizable game-like proportions,
consistent clothing and colorful 3D environments.
Do not copy protected characters or assets.

STORY QUALITY:
- Follow the user's original premise.
- Create original stories.
- Give every character a believable motivation.
- Establish causes before consequences.
- Make conflicts understandable.
- Do not introduce unexplained twists.
- Connect every scene logically.
- Include a strong beginning, rising conflict,
  climax and meaningful resolution.
- Avoid repetitive dialogue and duplicate scenes.

CINEMATIC PRODUCTION:
- Give filmable visual actions.
- Specify camera framing and movement.
- Include lighting, environment and sound design.
- Keep video prompts focused on one coherent scene.
- Follow the selected aspect ratio.

OUTPUT HONESTY:
You generate screenplays and prompts.
Do not claim a video has been rendered unless
the video-generation endpoint actually returns a result.

SAFETY:
- No sexual content involving minors.
- Romantic characters must be adults.

Return polished, clear and production-ready writing.
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
7. Natural dialogue.
8. Camera directions.
9. Lighting and sound.
10. Continuity notes.
11. Detailed standalone video-generation prompt.
12. A compelling ending hook.

For SHORT DRAMA:
Make the opening immediately engaging.

For FULL MOVIE:
Establish the main character, setting and conflict.
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
PRODUCTION MODE: ${mode}

TASK:
Create a complete screenplay and cinematic production plan.

REQUIRED SECTIONS:

1. FINAL TITLE AND LOGLINE

2. COMPLETE STORY SYNOPSIS
Explain beginning, conflict, escalation, climax and ending.

3. LOCKED CHARACTER BIBLE
Give each character a fixed appearance, personality,
motivation and relationships.

4. VISUAL WORLD
Describe locations and visual atmosphere.

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
- Continuity from previous scene
- Detailed standalone video-generation prompt
- Locked character appearance where applicable

6. CLIMAX
Create a meaningful confrontation or turning point.

7. FINAL SCENE
Give the story a logical and satisfying conclusion.

8. CONTINUITY SUMMARY
Summarize character appearances and important story facts.

MODE REQUIREMENTS:

${
    shortMode
      ? `
SHORT DRAMA:
- Make the first seconds engaging.
- Use concise but meaningful scenes.
- Build an emotional hook.
- End with a memorable conclusion or cliffhanger.
`
      : `
FULL MOVIE:
- Develop a complete beginning, middle and ending.
- Give characters room to develop.
- Build conflict gradually.
- Include meaningful turning points.
- Resolve the main story.
`
  }

IMPORTANT:
Do not repeat dialogue.
Do not invent contradictory character traits.
Do not use meaningless descriptions.
Do not add scenes that do not advance the story.
Make the screenplay coherent and filmable.
`;
}

const REVIEW_PROMPT = `
You are the screenplay quality editor for AI DRAMA STUDIO.

Review and correct the screenplay.

Check:
1. Natural and grammatically correct language.
2. Awkward or meaningless phrases.
3. Character appearance consistency.
4. Repeated dialogue and duplicate scenes.
5. Logical cause and effect.
6. Scene-to-scene continuity.
7. Consistent locations and timeline.
8. Meaningful climax and satisfying ending.
9. Clear purpose for every scene.
10. Filmable and visually consistent prompts.

Rewrite the screenplay itself.
Preserve the user's intended story and genre.
Return only the corrected screenplay.
`;

async function handleVideo(
  request: Request,
  env: Env
): Promise<Response> {
  if (!env.AI) {
    return json({
      error: "Hindi naka-configure ang Workers AI binding."
    }, 503);
  }

  let body: any;

  try {
    body = await request.json();
  } catch {
    return json({
      error: "Invalid JSON video request."
    }, 400);
  }

  const prompt =
    typeof body?.prompt === "string"
      ? body.prompt.trim()
      : "";

  if (!prompt) {
    return json({
      error: "Ilagay muna ang video-generation prompt."
    }, 400);
  }

  if (prompt.length > MAX_VIDEO_PROMPT_LENGTH) {
    return json({
      error: "Maximum 5,000 characters lamang ang video prompt."
    }, 413);
  }

  const duration = Math.max(
    1,
    Math.min(20, Number(body.duration) || 5)
  );

  const resolution = ALLOWED_RESOLUTIONS.includes(
    body.resolution
  )
    ? body.resolution
    : "720p";

  const aspectRatio = ALLOWED_ASPECTS.includes(
    body.aspectRatio
  )
    ? body.aspectRatio
    : "9:16";

  const draft = body.draft !== false;

  const referenceImage =
    typeof body.referenceImage === "string"
      ? body.referenceImage.trim()
      : "";

  if (referenceImage) {
    if (referenceImage.length > MAX_REFERENCE_LENGTH) {
      return json({
        error: "Masyadong malaki ang reference image."
      }, 413);
    }

    const validImage =
      /^https:\/\/[^\s]+$/i.test(referenceImage) ||
      /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(
        referenceImage
      );

    if (!validImage) {
      return json({
        error:
          "Ang reference image ay dapat HTTPS image URL o valid image data URI."
      }, 400);
    }
  }

  const input: Record<string, unknown> = {
    prompt,
    duration,
    resolution,
    aspect_ratio: aspectRatio,
    draft,
    save_audio: true,
    prompt_upsampling: true
  };

  if (referenceImage) {
    input.image = referenceImage;
  }

  try {
    const result = await env.AI.run(
      VIDEO_MODEL,
      input
    );

    const videoUrl = getVideoUrl(result);

    if (!videoUrl) {
      return json({
        ok: false,
        error:
          "Hindi nakatanggap ng video URL mula sa video model.",
        model: VIDEO_MODEL,
        state: result?.state || "unknown",
        details:
          result?.error ||
          result?.result?.error ||
          null
      }, 502);
    }

    return json({
      ok: true,
      videoUrl,
      model: VIDEO_MODEL,
      duration,
      resolution,
      aspectRatio,
      draft,
      referenceImageUsed: !!referenceImage,
      billing:
        "Cloudflare Workers AI pay-per-use. Check current pricing before generating."
    });

  } catch (error: any) {
    return json({
      ok: false,
      error:
        error?.message ||
        "Video generation failed. Check model availability and Workers AI billing."
    }, 502);
  }
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    const url = new URL(request.url);

    if (
      request.method === "GET" &&
      url.pathname === "/api/health"
    ) {
      return json({
        ok: true,
        service: "AI Drama Studio",
        mode: "full-movie-and-short-drama",
        textModel:
          env.AI_MODEL || TEXT_MODEL_DEFAULT,
        videoModel: VIDEO_MODEL,
        qualityReview: true,
        videoGeneration: true,
        supportedVisualStyles: ALLOWED_STYLES
      });
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/video"
    ) {
      return handleVideo(request, env);
    }

    if (
      request.method !== "POST" ||
      url.pathname !== "/api/chat"
    ) {
      return json({
        error: "Not found"
      }, 404);
    }

    if (!env.AI) {
      return json({
        error:
          "Hindi naka-configure ang Cloudflare Workers AI binding."
      }, 503);
    }

    let body: any;

    try {
      body = await request.json();
    } catch {
      return json({
        error: "Invalid JSON request."
      }, 400);
    }

    const action = body?.action as Action;

    const idea =
      typeof body?.idea === "string"
        ? body.idea.trim()
        : "";

    const settings = body?.settings || {};

    const genre = String(
      settings.genre || "Love Story"
    );

    const language = String(
      settings.language ||
      "Filipino / natural Tagalog"
    );

    const requestedStyle = String(
      settings.visualStyle ||
      settings.visual ||
      "Realistic cinematic human"
    );

    const style = ALLOWED_STYLES.includes(requestedStyle)
      ? requestedStyle
      : "Realistic cinematic human";

    const aspect = ALLOWED_ASPECTS.includes(
      settings.aspectRatio
    )
      ? settings.aspectRatio
      : "9:16";

    const mode: Mode =
      settings.mode === "movie"
        ? "movie"
        : "short";

    const duration = Math.max(
      1,
      Math.min(20, Number(settings.duration) || 5)
    );

    if (!["opening", "full"].includes(action)) {
      return json({
        error: "Unsupported action."
      }, 400);
    }

    if (!idea) {
      return json({
        error: "Ilagay muna ang story idea."
      }, 400);
    }

    if (idea.length > MAX_IDEA_LENGTH) {
      return json({
        error: "Maximum 18,000 characters lamang."
      }, 413);
    }

    if (
      action === "full" &&
      body?.approved !== true
    ) {
      return json({
        error:
          "Kailangan munang i-approve ang Opening Scene."
      }, 403);
    }

    if (
      action === "full" &&
      (
        typeof body?.opening !== "string" ||
        !body.opening.trim() ||
        body.opening.length > MAX_OPENING_LENGTH
      )
    ) {
      return json({
        error:
          "Missing or invalid approved opening scene."
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
            {
              role: "system",
              content: system
            },
            {
              role: "user",
              content: openingTask(
                idea,
                duration,
                mode
              )
            }
          ],
          3500
        );

        return json({
          ok: true,
          action,
          mode,
          genre,
          style,
          aspect,
          text,
          outputType: "text-only",
          generatedAt: new Date().toISOString()
        });
      }

      const draft = await runAI(
        env,
        [
          {
            role: "system",
            content: system
          },
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
              content:
                system + "\n\n" + REVIEW_PROMPT
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
        finalText = draft;
        qualityReview = "review-unavailable";
      }

      return json({
        ok: true,
        action,
        mode,
        genre,
        style,
        aspect,
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
