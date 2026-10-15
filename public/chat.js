
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const input = $("#user-input");
  const sendButton = $("#send-button");
  const chat = $("#chat-messages");
  const planBox = $("#studio-plan");
  const indicator = $("#typing-indicator");

  if (!input || !sendButton || !chat) {
    console.error("AI Drama Studio: Required HTML elements are missing.");
    return;
  }

  let busy = false;
  let runtime = "5 min";
  let language = "Tagalog";
  let characterStyle = "Realistic Human";
  let visualVision = "Cinematic";
  let completePlan = "";

  function message(role, text) {
    const el = document.createElement("div");
    el.className = `message ${role}-message`;
    const p = document.createElement("p");
    p.textContent = text;
    el.appendChild(p);
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
  }

  function setBusy(value, status = "AI is creating your drama...") {
    busy = value;
    sendButton.disabled = value;
    sendButton.textContent = value
      ? "Creating Drama..."
      : "🎬 Create Drama Plan";

    if (indicator) {
      indicator.textContent = status;
      indicator.style.display = value ? "block" : "none";
    }
  }

  function selectedText(selector, fallback) {
    const el = $(selector);
    return el?.selectedOptions?.[0]?.textContent?.trim()
      || el?.value
      || fallback;
  }

  function getRuntime() {
    const el = document.querySelector(
      ".length-btn.selected, .length-btn.active, .length-btn[aria-pressed='true']"
    );
    return el?.textContent?.trim() || runtime || "5 min";
  }

  function runtimeSeconds(value) {
    if (/custom/i.test(value)) return 300;
    const match = String(value).match(/(\d+(?:\.\d+)?)/);
    const number = match ? Number(match[1]) : 5;

    if (/sec/i.test(value)) return Math.max(1, Math.round(number));
    if (/hour|hr/i.test(value)) return Math.round(number * 3600);

    return Math.max(60, Math.round(number * 60));
  }

  async function askAI(prompt) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }]
      })
    });

    const raw = await response.text();

    if (!response.ok) {
      throw new Error(`AI server ${response.status}: ${raw.slice(0, 250)}`);
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("Hindi valid JSON ang sagot ng AI server.");
    }

    const candidates = [
      data?.response,
      data?.result?.response,
      data?.output,
      data?.content,
      data?.message?.content,
      data?.choices?.[0]?.message?.content
    ];

    for (const item of candidates) {
      if (typeof item === "string" && item.trim()) return item.trim();

      if (Array.isArray(item)) {
        const text = item.map((part) => part?.text || "").join("\n").trim();
        if (text) return text;
      }
    }

    throw new Error(
      "Walang mabasang text sa AI response. Kailangang suriin ang server response format."
    );
  }

  function renderOutput(titleText, text) {
    const container = planBox || chat;
    container.style.display = "block";
    container.replaceChildren();

    const heading = document.createElement("h3");
    heading.textContent = titleText;
    heading.style.marginBottom = "12px";

    const output = document.createElement("pre");
    output.style.whiteSpace = "pre-wrap";
    output.style.overflowWrap = "anywhere";
    output.style.fontFamily = "inherit";
    output.style.fontSize = "14px";
    output.style.lineHeight = "1.65";
    output.textContent = text;

    container.append(heading, output);
    return { container, output };
  }

  function makeSceneSchedule(totalSeconds) {
    // Aim for scenes around 12–15 seconds for short-form drama.
    const count = Math.max(2, Math.ceil(totalSeconds / 15));
    const base = Math.floor(totalSeconds / count);
    const remainder = totalSeconds % count;

    return Array.from({ length: count }, (_, i) =>
      base + (i < remainder ? 1 : 0)
    );
  }

  function validateText(text, minimum, label) {
    if (!text || text.trim().length < minimum) {
      throw new Error(`${label} ay masyadong maikli.`);
    }

    const lower = text.toLowerCase();
    const broken = [
      "as an ai language model",
      "i cannot fulfill",
      "i can't help with that"
    ];

    if (broken.some((phrase) => lower.includes(phrase))) {
      throw new Error(`${label} ay hindi nagawa nang tama.`);
    }
  }

  function sceneHeadingExists(text, number) {
    const n = String(number).padStart(2, "0");
    const pattern = new RegExp(
      `(?:SCENE|EKSENA)\\s*0?${number}\\b|(?:SCENE|EKSENA)\\s*${n}\\b`,
      "i"
    );
    return pattern.test(text);
  }

  async function createPlan() {
    if (busy) return;

    const idea = input.value.trim();
    if (!idea) {
      message("assistant", "Ilagay muna ang drama idea.");
      input.focus();
      return;
    }

    runtime = getRuntime();
    language = selectedText("#language", "Tagalog");
    characterStyle = selectedText("#character-style", "Realistic Human");
    visualVision = selectedText("#visual-vision", "Cinematic");

    const totalSeconds = runtimeSeconds(runtime);
    const durations = makeSceneSchedule(totalSeconds);
    const totalScenes = durations.length;

    setBusy(true, "Yugto 1/3: Binubuo ang kuwento...");
    message("user", `${idea}\nHaba: ${runtime}`);

    try {
      // STAGE 1: A complete, coherent story before scene writing.
      const story = await askAI(`
Ikaw ay isang mahusay na screenwriter ng orihinal na drama.

IDEYA NG USER:
${idea}

SETTINGS:
Wika: ${language}
Character style: ${characterStyle}
Visual vision: ${visualVision}
Kabuuang runtime: ${totalSeconds} seconds.

GUMAWA NG STORY BLUEPRINT. Huwag munang isulat ang detalyadong scenes.

Gamitin ang mga heading na ito:
TITLE
GENRE
CENTRAL HOOK
PROTAGONIST AT LAYUNIN
PANGUNAHING PANGANIB O CONFLICT
SIMULA
PAGTAAS NG TENSIYON
CLIMAX
ENDING
CHARACTER BIBLE
LOCATION BIBLE
CONTINUITY RULES

MGA MAHALAGANG TUNTUNIN:
- Gumamit ng natural, tama at madaling maintindihang ${language}.
- Huwag isalin nang literal ang mga salitang Ingles kung magiging mali ang pangungusap.
- Huwag gumamit ng walang-kabuluhang paglalarawan.
- Bawat tauhan ay may malinaw na edad, mukha, buhok, pangangatawan, kasuotan at personalidad.
- Ang kuwento ay may tiyak na sanhi at bunga.
- Ang ending ay isang totoong pangyayari, hindi paulit-ulit na buod.
- Para sa horror, dapat may unti-unting kakaibang pangyayari, tumitinding panganib, at malinaw na reveal o nakakatakot na ending.
- Huwag magdagdag ng eksenang walang silbi sa kuwento.
- Huwag ulitin ang parehong ideya para lang pahabain ang sagot.
- Maging maikli ngunit kumpleto.
`);

      validateText(story, 350, "Story Blueprint");

      let plan = [
        "# AI DRAMA STUDIO — DRAMA PLAN",
        "## STORY BLUEPRINT",
        story,
        `\n## RUNTIME\n${totalSeconds} seconds (${runtime})`,
        `\n## SCENE SCHEDULE\n${durations.map((d, i) =>
          `Scene ${String(i + 1).padStart(2, "0")}: ${d} seconds`
        ).join("\n")}`,
        "\n## COMPLETE SCENES"
      ];

      renderOutput("Building Story Blueprint", plan.join("\n\n"));

      // STAGE 2: Define a different dramatic purpose for every scene.
      setBusy(true, "Yugto 2/3: Binabalangkas ang magkakaibang scenes...");

      const sceneMap = await askAI(`
Ikaw ay isang drama story editor. Gumawa ng SCENE MAP batay sa story blueprint.

STORY BLUEPRINT — ITO ANG SUSUNDIN:
${story}

KABUUANG HABA: ${totalSeconds} seconds.
KABUUANG SCENES: ${totalScenes}.

ITO ANG MGA NAKATAKDANG DURATION:
${durations.map((d, i) => `Scene ${i + 1}: ${d} seconds`).join("\n")}

Gumawa ng eksaktong ${totalScenes} entries. Para sa bawat scene, ilagay:
SCENE NUMBER
SHORT TITLE
DRAMATIC PURPOSE
ANO ANG BAGONG PANGYAYARI
ANO ANG GUSTONG MAKAMIT NG TAUHAN
ANO ANG HUMAHADLANG
ANONG BAGONG IMPORMASYON ANG MALALAMAN
ENDING BEAT / TRANSITION TO NEXT SCENE

RULES:
- Bawat scene ay dapat may ibang pangunahing pangyayari.
- Huwag ulitin ang parehong pag-uusap, paglalakad o reaksyon.
- Dapat lumala o magbago ang sitwasyon sa bawat scene.
- Ang huling scene lamang ang magdadala sa ending o cliffhanger.
- Huwag gumawa ng bagong ending na sumasalungat sa blueprint.
- Gumamit ng natural na ${language}.
- Ibalik lamang ang scene map, walang mahabang introduction.
`);

      validateText(sceneMap, totalScenes * 45, "Scene Map");

      plan.push("\n## SCENE MAP\n" + sceneMap);
      renderOutput("Creating Individual Scenes", plan.join("\n\n"));

      // STAGE 3: Generate two scenes at a time using their assigned purpose.
      const batchSize = 2;

      for (let first = 1; first <= totalScenes; first += batchSize) {
        const last = Math.min(totalScenes, first + batchSize - 1);

        setBusy(
          true,
          `Yugto 3/3: Isinusulat ang scenes ${first}–${last} sa ${totalScenes}...`
        );

        const requested = [];

        for (let n = first; n <= last; n++) {
          requested.push(`SCENE ${String(n).padStart(2, "0")} — EXACTLY ${durations[n - 1]} SECONDS`);
        }

        const prompt = `
Ikaw ay isang bihasang screenwriter at AI video scene planner.

STORY BLUEPRINT — LOCKED:
${story}

SCENE MAP — LOCKED:
${sceneMap}

IDEYA NG USER:
${idea}

SETTINGS:
Language: ${language}
Character style: ${characterStyle}
Visual direction: ${visualVision}
Total runtime: ${totalSeconds} seconds.

ISULAT LAMANG ANG MGA SCENE NA ITO:
${requested.join("\n")}

Para sa BAWAT scene, gamitin ang mga heading:
SCENE NUMBER AND TITLE
DURATION
DRAMATIC PURPOSE
LOCATION AND TIME
CHARACTERS PRESENT
ACTION IN SEQUENTIAL ORDER
DIALOGUE
FACIAL EXPRESSIONS AND EMOTION
CAMERA DIRECTION
LIGHTING AND COLOR
SOUND
AI VIDEO PROMPT
NEGATIVE PROMPT
CONTINUITY TO NEXT SCENE

QUALITY RULES:
1. Sundin ang eksaktong dramatic purpose ng bawat scene map entry.
2. Ang bawat scene ay dapat may bagong pangyayari at malinaw na pagbabago sa sitwasyon.
3. Huwag ulitin ang opening shot sa lahat ng scenes.
4. Huwag ulitin ang dialogue o action mula sa naunang scene.
5. Gumamit ng natural at tamang ${language}; iwasan ang literal na salin mula sa Ingles.
6. Huwag gumamit ng mga heading na walang kabuluhan o maling Filipino.
7. Ang character details ay dapat tumugma sa blueprint. Banggitin lamang ang mahahalagang detalye sa scene, huwag kopyahin ang buong character bible.
8. Ang dialogue ay dapat may dahilan, may natural na sagot, at may epekto sa kuwento.
9. Ang visual prompt ay dapat malinaw na naglalarawan ng nakikitang aksyon, itsura, setting at camera.
10. Ang negative prompt ay dapat tumukoy sa mga posibleng visual inconsistency, hindi sa malabong parirala.
11. Huwag maglagay ng bagong pangunahing karakter o bagong ending na wala sa blueprint.
12. Kumpletuhin ang lahat ng requested scenes at pangungusap.
13. Huwag magsulat ng ibang scene numbers.
14. Huwag magbigay ng quality-check claim na hindi napatunayan.

Para sa huling scene, isagawa ang ending na nasa blueprint.
`);

        let batch = "";
        let batchError = null;

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            batch = await askAI(
              prompt +
              (attempt === 2
                ? "\nRETRY: Isulat nang mas malinaw at kumpleto ang bawat requested scene. Iwasan ang pag-uulit."
                : "")
            );

            validateText(batch, 180, `Scenes ${first}–${last}`);

            const missing = [];
            for (let n = first; n <= last; n++) {
              if (!sceneHeadingExists(batch, n)) missing.push(n);
            }

            if (missing.length) {
              throw new Error(
                `Hindi nakita ang scene heading: ${missing.join(", ")}`
              );
            }

            batchError = null;
            break;
          } catch (error) {
            batchError = error;
          }
        }

        if (batchError) {
          throw new Error(
            `Hindi nakumpleto ang scenes ${first}–${last}: ${batchError.message}`
          );
        }

        plan.push("\n" + batch);
        renderOutput("Creating Individual Scenes", plan.join("\n\n"));
      }

      completePlan = plan.join("\n\n");

      // Structural validation only; this is not a guarantee of story quality.
      const missingScenes = [];
      for (let n = 1; n <= totalScenes; n++) {
        if (!sceneHeadingExists(completePlan, n)) missingScenes.push(n);
      }

      if (missingScenes.length) {
        throw new Error(
          `May nawawalang scene number: ${missingScenes.join(", ")}`
        );
      }

      const finalText =
        completePlan +
        "\n\n## REVIEW STATUS\n" +
        `Nakita ang lahat ng ${totalScenes} planned scene headings.\n` +
        "Hindi pa awtomatikong napatutunayan ang kalidad ng dialogue o eksaktong runtime. Suriin ang lahat bago aprubahan.\n" +
        "VIDEO GENERATION: NOT STARTED";

      const rendered = renderOutput("Drama Plan — Ready for Review", finalText);

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.textContent = "Copy Complete Drama Plan";
      copyButton.style.marginTop = "12px";
      copyButton.style.padding = "10px";

      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(finalText);
          copyButton.textContent = "Copied!";
        } catch {
          message("assistant", "Piliin at kopyahin ang text kung hindi gumana ang automatic copy.");
        }
      });

      rendered.container.appendChild(copyButton);

      message(
        "assistant",
        `Tapos na ang structural scene check: ${totalScenes} scene headings ang nakita. Basahin ang buong kuwento at scenes; hindi pa nagsisimula ang video generation.`
      );
    } catch (error) {
      console.error("Drama plan error:", error);
      message("assistant", `Hindi pa kumpleto ang plan: ${error.message}`);

      const container = planBox || chat;
      const warning = document.createElement("p");
      warning.style.color = "#a15c00";
      warning.style.marginTop = "10px";
      warning.textContent =
        "INCOMPLETE — Huwag munang aprubahan. Tingnan ang error sa chat.";
      container.appendChild(warning);
    } finally {
      setBusy(false);
    }
  }

  sendButton.addEventListener("click", createPlan);

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      createPlan();
    }
  });

  document.querySelectorAll(".length-btn").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      button.classList.contains("selected") ? "true" : "false"
    );

    button.addEventListener("click", () => {
      document.querySelectorAll(".length-btn").forEach((item) => {
        item.classList.remove("selected", "active");
        item.setAttribute("aria-pressed", "false");
      });

      button.classList.add("selected");
      button.setAttribute("aria-pressed", "true");
      runtime = button.textContent.trim();
    });
  });

  console.log("AI Drama Studio: story-first scene workflow loaded.");
})();
                   
