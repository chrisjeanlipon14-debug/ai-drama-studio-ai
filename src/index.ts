
interface Env {
  AI: {
    run: (model: string, inputs: Record<string, unknown>) => Promise<unknown>;
  };
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
}

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function extractText(value: any): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";

  const candidates = [
    value.response,
    value.result?.response,
    value.output,
    value.content,
    value.message?.content,
    value.choices?.[0]?.message?.content
  ];

  for (const item of candidates) {
    if (typeof item === "string" && item.trim()) return item.trim();

    if (Array.isArray(item)) {
      const text = item
        .map((part: any) => typeof part?.text === "string" ? part.text : "")
        .join("\n")
        .trim();

      if (text) return text;
    }
  }

  return "";
}

async function handleChat(request: Request, env: Env) {
  let body: Record<string, unknown>;

  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ error: "Hindi mabasa ang request. Subukan muli." }, 400);
  }

  const idea = typeof body.idea === "string" ? body.idea.trim() : "";

  if (idea.length < 8) {
    return json({ error: "Maglagay muna ng mas malinaw na drama idea." }, 400);
  }

  const language = String(body.language || "Tagalog");
  const genre = String(body.genre || "Horror");
  const style = String(body.visualStyle || "Cinematic realistic");
  const minutes = Math.min(10, Math.max(1, Number(body.durationMinutes) || 5));

  const sceneCount =
    minutes <= 1 ? "4–6" :
    minutes <= 3 ? "8–12" :
    minutes <= 5 ? "12–16" : "18–24";

  const prompt = `
IKAW ANG:
Head screenwriter at production planner ng AI Drama Studio.
Gumagawa ka ng orihinal, emosyonal, malinaw, at de-kalidad na drama plan.

IDEYA NG USER:
${idea}

SETTINGS:
Wika: ${language}
Genre: ${genre}
Visual style: ${style}
Haba: ${minutes} minuto
Target scenes: ${sceneCount}

MAHIGPIT NA TUNTUNIN SA WIKA:
- Kung Tagalog ang pinili, gumamit ng natural at wastong Filipino.
- Huwag magsalin nang literal mula sa Ingles.
- Huwag gumamit ng sirang parirala gaya ng "relasyon na naglalayon ng kaniyang buhay",
  "pagpapahalintulad sa pag-ibig", o "nagkakaroon ng pagtatawa".
- Gumamit ng mga salitang ginagamit talaga ng mga tao sa pang-araw-araw na usapan.
- Ang dialogue ay dapat natural, may emosyon, may dahilan, at may kaugnayan sa sagot ng kausap.
- Iwasan ang paulit-ulit na "siya ay" at ang mga pangungusap na iisa ang ibig sabihin.
- Huwag ulitin ang parehong ideya sa summary, scene description, at dialogue.

PAGBUO NG KUWENTO:
1. May malinaw na pangunahing tauhan at layunin.
2. May tunay na problema na may dahilan at epekto.
3. Malakas ang opening hook sa unang bahagi ng kuwento.
4. Bawat scene ay may sariling layunin at bagong pangyayari.
5. Unti-unting tumitindi ang conflict.
6. Ang climax ay bunga ng mga naunang desisyon ng mga tauhan.
7. May makabuluhang ending o cliffhanger.
8. Huwag palitan ang ideya ng user ng kuwentong walang kaugnayan.
9. Para sa romance, ipakita kung bakit nagkakagusto ang mga tauhan sa isa't isa.
   Dapat may chemistry, tiwala, hindi pagkakaunawaan, at emosyonal na pagbabago.
10. Kung may pagtataksil, linawin kung sino ang nagtaksil at bakit mahalaga ito sa kuwento.
11. Para sa horror, bumuo ng suspense at malinaw na nakakatakot na pangyayari.
12. Para sa comedy, malinaw ang setup at punchline; iwasan ang OA na dialogue kung hindi hinihingi.
13. Huwag magdagdag ng filler scenes para lamang mapahaba ang output.

CHARACTER CONSISTENCY:
Para sa bawat pangunahing tauhan, ilagay ang:
- Pangalan at edad
- Papel sa kuwento
- Mukha, buhok, pangangatawan at kasuotan
- Personalidad at paraan ng pagsasalita
- Layunin at kinatatakutan
- Relasyon sa ibang tauhan

Dapat magkakaiba ang mga tauhan. Huwag bigyan ang lahat ng parehong buhok,
kulay ng mata, damit, personalidad o motibasyon maliban kung may dahilan.
Panatilihing pareho ang kanilang itsura at kasuotan sa bawat scene.

GAMITIN ANG MGA SEKSYONG ITO:

1. PAMAGAT
Gumawa ng maikli, natatangi at madaling tandaan na pamagat.

2. OPENING HOOK
Isang tiyak at nakakakuryosong pangyayari, hindi malabong paglalarawan.

3. STORY SUMMARY
Ilarawan ang simula, paglala ng problema, climax at ending.
Huwag ulitin ang parehong impormasyon.

4. CHARACTER BIBLE
Ibigay ang kumpleto at magkakaibang detalye ng mga tauhan.

5. LOCATION AT VISUAL CONTINUITY
Ilista ang mga lugar, oras, props, kulay, kasuotan at visual details
na dapat manatiling pareho sa buong kuwento.

6. SCENE-BY-SCENE BREAKDOWN
Gumawa ng humigit-kumulang ${sceneCount} scenes ayon sa haba ng video.

Para sa BAWAT scene, ilagay ang:
- SCENE NUMBER AT PAMAGAT
- Duration
- Layunin ng scene
- Lokasyon at oras
- Mga tauhan at kanilang consistent appearance
- Action: sunod-sunod na nakikitang kilos
- Dialogue: natural na linya na may pangalan ng nagsasalita
- Facial expression at emosyon
- Camera direction
- Lighting at sound
- AI video prompt
- Negative prompt
- Transition o pangyayaring magtutulak sa susunod na scene

7. NATURAL DIALOGUE
Magbigay ng mahahalagang linya na natural pakinggan at akma sa personalidad.

8. CAMERA, LIGHTING AT SOUND
Magbigay ng tiyak na shot, camera movement, liwanag at tunog.

9. AI VIDEO PROMPT BAWAT SCENE
Bawat prompt ay dapat sariling kumpletong paglalarawan ng tauhan,
kasuotan, lokasyon, nakikitang kilos, emosyon, camera at visual style.
Huwag gumamit ng malabong prompt gaya ng "isang babae ay umuuwi".

10. NEGATIVE PROMPT
Iwasan ang pagbabago ng mukha at damit, maling anatomy, dagdag na daliri,
hindi kailangang text, visual glitches at inconsistent na props.

11. ENDING O CLIFFHANGER
Dapat may aktuwal na pangyayari at emosyonal na epekto.
Huwag gawing ending ang simpleng pagtatawanan lamang maliban kung iyon
ang malinaw na layunin ng kuwento.

12. CONTINUITY CHECK
Ilista ang kailangang manatiling pareho.
Huwag sabihing pumasa ang quality checks kung hindi talaga napatunayan.

HULING MGA TUNTUNIN:
- Huwag mag-iwan ng placeholder gaya ng "Main Character".
- Huwag gumawa ng walang-kabuluhang o paulit-ulit na pangungusap.
- Huwag magbigay ng eksenang walang silbi sa kuwento.
- Huwag mag-claim na nakagawa ng video.
- Written drama plan lamang ang endpoint na ito.
- Unahin ang natural na wika, malinaw na kuwento at kapaki-pakinabang na scene prompts.
`;

  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        {
          role: "system",
          content:
            "You are a professional original screenwriter. " +
            "Write coherent stories with natural language, cause-and-effect plots, " +
            "specific scenes, consistent characters, and no repetitive filler. " +
            "Follow the user's selected language."
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 4500,
      temperature: 0.55
    });

    const plan = extractText(result);

    if (!plan) {
      return json({
        error: "Walang mabasang text mula sa AI response. Kailangang suriin ang model response."
      }, 502);
    }

    return json({
      success: true,
      plan,
      model: MODEL,
      durationMinutes: minutes,
      language,
      genre
    });
  } catch (error) {
    return json({ error: errorText(error) }, 500);
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
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
        }
      });
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "AI Drama Studio",
        model: MODEL
      });
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      return handleChat(request, env);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Missing static asset configuration.", {
      status: 500
    });
  }
};
