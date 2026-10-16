
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
  maxTokens: number
): Promise<string> {
  const result = await env.AI.run(MODEL, {
    messages: [
      {
        role: "system",
        content:
          "You are a professional Filipino short-film screenwriter. " +
          "Write natural, fluent, grammatically correct Tagalog when Tagalog is requested. " +
          "Create original, coherent stories with specific actions, believable dialogue, " +
          "clear cause and effect, and strong visual storytelling. " +
          "Never repeat paragraphs, descriptions, dialogue, or scenes to fill space. " +
          "Follow the user's requested format and length.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.45,
    top_p: 0.85,
    repetition_penalty: 1.15,
    frequency_penalty: 0.6,
    presence_penalty: 0.15,
  });

  return getText(result).trim();
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasExcessiveRepetition(text: string): boolean {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(normalize)
    .filter((p) => p.length > 50);

  const seen = new Set<string>();

  for (const paragraph of paragraphs) {
    if (seen.has(paragraph)) return true;
    seen.add(paragraph);
  }

  const lines = text
    .split("\n")
    .map(normalize)
    .filter((line) => line.length > 65);

  const lineCounts = new Map<string, number>();

  for (const line of lines) {
    const count = (lineCounts.get(line) || 0) + 1;
    lineCounts.set(line, count);
    if (count >= 3) return true;
  }

  const words = normalize(text).split(" ");
  const phraseCounts = new Map<string, number>();

  for (let i = 0; i <= words.length - 7; i++) {
    const phrase = words.slice(i, i + 7).join(" ");
    const count = (phraseCounts.get(phrase) || 0) + 1;
    phraseCounts.set(phrase, count);

    if (count >= 4) return true;
  }

  return false;
}


function hasSceneHeadings(text: string, expected: number): boolean {
  const matches = [
    ...text.matchAll(
      /^\s*(?:#{1,6}\s*)?(?:SCENE|EKSENA)\s*#?\s*(\d+)\b/gim
    ),
  ];

  const numbers = matches.map((match) => Number(match[1]));
  const unique = new Set(numbers);

  return (
    unique.size === expected &&
    Array.from({ length: expected }, (_, i) => i + 1)
      .every((number) => unique.has(number))
  );
}


function getSceneCount(minutes: number): number {
  if (minutes === 1) return 4;
  if (minutes === 3) return 8;
  if (minutes === 5) return 12;
  return 20;
}

function cleanInput(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, 5000) || fallback;
}

function buildPrompt(
  idea: string,
  language: string,
  genre: string,
  visualStyle: string,
  minutes: number,
  sceneCount: number,
  retry: boolean
): string {
  const seconds = minutes * 60;
  const baseSeconds = Math.floor(seconds / sceneCount);
  const remainder = seconds % sceneCount;

  const timings = Array.from(
    { length: sceneCount },
    (_, i) => baseSeconds + (i < remainder ? 1 : 0)
  );

  return `
GUMAWA NG KUMPLETONG SHORT-FILM DRAMA PLAN.

IDEYA NG USER:
${idea}

WIKA: ${language}
GENRE: ${genre}
VISUAL STYLE: ${visualStyle}
KABUUANG HABA: ${minutes} minuto (${seconds} segundo)
BILANG NG EKSENA: eksaktong ${sceneCount}

${retry ? `
PAGWAWASTO:
Nabigo ang naunang draft dahil sa pag-uulit o maling format.
Gumawa ng BAGONG draft. Huwag kopyahin ang naunang output.
` : ""}

MAHIGPIT NA PANUNTUNAN:
1. Sundin ang ideya ng user. Huwag palitan ang pangunahing kuwento.
2. Gumamit ng natural at malinaw na ${language}.
3. Ang bawat eksena ay dapat may bagong pangyayari, aksiyon,
   impormasyon, o pagbabago sa sitwasyon.
4. Huwag ulitin ang parehong dialogue, pangungusap, o paglalarawan.
5. Panatilihing pare-pareho ang pangalan, edad, itsura, damit,
   relasyon at motibasyon ng mga karakter.
6. Ang horror ay dapat may malinaw na suspense, nakikitang detalye,
   at lohikal na dahilan sa mga pangyayari. Iwasan ang random na
   detalye at hindi magkakaugnay na eksena.
7. Walang mahabang paliwanag na walang aksiyon.
8. Walang eksenang lampas sa nakatalagang oras.
9. Huwag magdagdag ng eksena sa labas ng ${sceneCount}.
10. Huwag magdagdag ng pambungad o paliwanag bago ang output.
11. Ang kabuuan ng tagal ng lahat ng eksena ay eksaktong
    ${seconds} segundo.

FORMAT:

DRAMA TITLE:
Maikli, kapansin-pansin at orihinal.

LOGLINE:
Isang pangungusap tungkol sa pangunahing tunggalian.

CHARACTERS:
Para sa bawat karakter, ilagay ang pangalan, edad,
pisikal na itsura, pananamit, personalidad at motibasyon.

STORY SUMMARY:
Maikli ngunit kumpleto: simula, tunggalian, paglala at ending.

SCENE PLAN:

Para sa bawat eksena, gamitin ang format na ito:

SCENE 1 — [maikling pamagat]
DURATION: ${timings[0]} seconds
LOCATION:
CHARACTERS PRESENT:
VISUAL ACTION:
DIALOGUE:
CAMERA:
SOUND:
ENDING HOOK:

Ulitin ang parehong format para sa eksaktong ${sceneCount}
na eksena. Gamitin ang mga sumusunod na tagal ayon sa pagkakasunod:
${timings.map((t, i) => `Eksena ${i + 1}: ${t} segundo`).join("\n")}

Mahalagang panuntunan sa dialogue:
- Magkakaiba ang boses at paraan ng pagsasalita ng mga karakter.
- Huwag ipasabi sa lahat ang parehong linya.
- Ang dialogue ay dapat makatulong sa kuwento.
- Kung walang kailangang sabihin, gumamit ng katahimikan o aksiyon.

ENDING:
Ilarawan ang malinaw na huling pangyayari at ang emosyonal
o nakagugulat na epekto nito.

CONTINUITY CHECK:
Ilista nang maikli ang mahahalagang detalye na hindi dapat magbago.

FINAL CHECK:
Bago isumite, tiyaking eksakto ang bilang ng eksena,
walang inuulit na eksena, at natural ang wika.
`.trim();
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
    const seconds = Number(body.durationSeconds);
    minutes = seconds === 180 ? 3
      : seconds === 300 ? 5
      : seconds === 600 ? 10
      : 1;
  }

  const sceneCount = getSceneCount(minutes);
  let lastReason = "Hindi pumasa sa quality checks.";

  for (let attempt = 0; attempt < 3; attempt++) {
    const prompt = buildPrompt(
      idea,
      language,
      genre,
      visualStyle,
      minutes,
      sceneCount,
      attempt > 0
    );

    const plan = await generate(
      env,
      prompt,
      minutes === 10 ? 8192 : 4096
    );

    if (!plan) {
      lastReason = "Walang text na ibinalik ang AI.";
      continue;
    }

    const correctHeadings = hasSceneHeadings(plan, sceneCount);
const repeated = hasExcessiveRepetition(plan);

// Tanggapin ang plan kung kumpleto ang mga eksena.
// Huwag agad tanggihan dahil lang sa repetition checker.
if (correctHeadings) {
  return plan;
}

    lastReason = [
      !correctHeadings
        ? `Hindi eksaktong ${sceneCount} ang mga heading ng eksena.`
        : "",
      repeated ? "May sobrang pag-uulit." : "",
    ].filter(Boolean).join(" ");
  }

  throw new Error(
    `Hindi pa makabuo ng maayos na drama plan matapos ang 3 pagsubok. ${lastReason} Subukan ulit o paikliin ang ideya.`
  );
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

        return json({
          success: true,
          plan,
        });
      } catch (error) {
        const message =
          error instanceof Error
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
