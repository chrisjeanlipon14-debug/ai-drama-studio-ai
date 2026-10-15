
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const input = $("#user-input");
  const sendButton = $("#send-button");
  const chat = $("#chat-messages");
  const planBox = $("#studio-plan");
  const indicator = $("#typing-indicator");

  if (!input || !sendButton || !chat) {
    console.error("AI Drama Studio: Missing required HTML elements.");
    return;
  }

  let busy = false;
  let runtime = "5 min";
  let language = "Tagalog";
  let characterStyle = "Realistic Human";
  let visualVision = "Cinematic";
  let completePlan = "";

  const wait = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  function addMessage(role, text) {
    const el = document.createElement("div");
    el.className = `message ${role}-message`;

    const p = document.createElement("p");
    p.textContent = text;

    el.appendChild(p);
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
  }

  function setBusy(value, message) {
    busy = value;
    sendButton.disabled = value;
    sendButton.textContent = value
      ? "Creating Scenes..."
      : "🎬 Create Drama Plan";

    if (indicator) {
      indicator.textContent =
        message || "AI is creating your drama...";
      indicator.classList.toggle("visible", value);
      indicator.style.display = value ? "block" : "none";
    }
  }

  function selectedText(selector, fallback) {
    const el = $(selector);
    if (!el) return fallback;

    return el.selectedOptions?.[0]?.textContent?.trim()
      || el.value
      || fallback;
  }

  function getRuntime() {
    const selected = document.querySelector(
      ".length-btn.selected, .length-btn.active, .length-btn[aria-pressed='true']"
    );

    return selected?.textContent?.trim() || runtime || "5 min";
  }

  function runtimeSeconds(value) {
    const match = String(value).match(/(\d+(?:\.\d+)?)/);
    const number = match ? Number(match[1]) : 5;

    if (/custom/i.test(value)) return 300;
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
      throw new Error(
        `AI server error (${response.status}): ${raw.slice(0, 300)}`
      );
    }

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("Hindi JSON ang sagot ng AI server.");
    }

    const candidates = [
      data?.response,
      data?.result?.response,
      data?.output,
      data?.content,
      data?.message?.content,
      data?.choices?.[0]?.message?.content
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }

      if (Array.isArray(candidate)) {
        const text = candidate
          .map((item) => item?.text || "")
          .join("\n")
          .trim();

        if (text) return text;
      }
    }

    throw new Error(
      "Walang mabasang text sa AI response. Kailangan nating suriin ang server response."
    );
  }

  function showOutput(titleText, text) {
    const container = planBox || chat;
    container.style.display = "block";
    container.replaceChildren();

    const title = document.createElement("h3");
    title.textContent = titleText;
    title.style.marginBottom = "12px";

    const output = document.createElement("pre");
    output.style.whiteSpace = "pre-wrap";
    output.style.overflowWrap = "anywhere";
    output.style.fontFamily = "inherit";
    output.style.lineHeight = "1.65";
    output.style.fontSize = "14px";
    output.textContent = text;

    container.append(title, output);

    return { container, output };
  }

  function getSceneCount(seconds) {
    // Target: approximately 30 seconds per scene.
    // The final scene uses the remaining duration.
    return Math.max(2, Math.ceil(seconds / 30));
  }

  function sceneDuration(seconds, sceneNumber, totalScenes) {
    const normalDuration = Math.floor(seconds / totalScenes);
    const remainder = seconds % totalScenes;

    return normalDuration + (sceneNumber <= remainder ? 1 : 0);
  }

  function checkGeneratedBatch(text, firstScene, lastScene) {
    if (!text || text.trim().length < 100) {
      throw new Error(
        `Kulang ang output para sa scenes ${firstScene}-${lastScene}.`
      );
    }

    const lower = text.toLowerCase();

    if (
      lower.includes("i cannot") ||
      lower.includes("i can't help") ||
      lower.includes("as an ai language model")
    ) {
      throw new Error(
        `Hindi nakagawa ng scenes ${firstScene}-${lastScene}. Subukan ulit.`
      );
    }

    return text.trim();
  }

  async function createPlan() {
    if (busy) return;

    const idea = input.value.trim();

    if (!idea) {
      addMessage("assistant", "Ilagay muna ang iyong drama idea.");
      input.focus();
      return;
    }

    runtime = getRuntime();
    language = selectedText("#language", "Tagalog");
    characterStyle = selectedText(
      "#character-style",
      "Realistic Human"
    );
    visualVision = selectedText("#visual-vision", "Cinematic");

    const seconds = runtimeSeconds(runtime);
    const totalScenes = getSceneCount(seconds);
    const sceneDurations = Array.from(
      { length: totalScenes },
      (_, index) => sceneDuration(seconds, index + 1, totalScenes)
    );

    const sceneList = sceneDurations
      .map((duration, index) =>
        `SCENE ${String(index + 1).padStart(2, "0")}: ${duration} seconds`
      )
      .join("\n");

    setBusy(true, "Step 1 of 2: Creating the story and character bible...");
    addMessage("user", `${idea}\nRuntime: ${runtime}`);

    try {
      const bible = await askAI(`
ROLE: You are an experienced original drama screenwriter.

USER IDEA:
${idea}

SETTINGS:
Language: ${language}
Character style: ${characterStyle}
Visual direction: ${visualVision}
Total runtime: ${seconds} seconds.

Create a concise but complete STORY BIBLE that will be reused for every scene.

Required sections:
1. TITLE
2. GENRE AND CENTRAL HOOK
3. COMPLETE STORY: beginning, rising conflict, climax, resolution or cliffhanger
4. CHARACTER DNA: name, age, facial features, hair, body type, exact clothing, personality, voice, relationships
5. LOCATIONS: visual description, time of day, important objects
6. LOCKED CONTINUITY RULES: exact character appearances, wardrobe, props, injuries, timeline and locations
7. ENDING: the actual final outcome of this story

Rules:
- Use natural, grammatically correct ${language}.
- Make the story original and logically consistent.
- Give each character specific, recognizable physical traits.
- Do not use vague descriptions such as "beautiful woman" as complete character DNA.
- Do not invent meaningless words or repeat paragraphs.
- Make sure the ending follows from the events in the story.
- Do not write the full scenes yet.
- Keep the bible concise enough to be reused in scene prompts.
`);

      if (bible.length < 300) {
        throw new Error(
          "Masyadong maikli ang Story Bible. Hindi pa tayo magpapatuloy sa scenes."
        );
      }

      const parts = [
        "# AI DRAMA STUDIO — COMPLETE DRAMA PLAN",
        `TITLE / STORY BIBLE\n${bible}`,
        `\nRUNTIME: ${seconds} seconds (${runtime})`,
        `\nPLANNED SCENES: ${totalScenes}`,
        "\n# COMPLETE SCENE BREAKDOWN"
      ];

      showOutput(
        "Creating Drama Plan",
        parts.join("\n\n") + "\n\nNagawa ang Story Bible. Nagsisimula ang scene generation..."
      );

      // Generate two scenes per request to reduce truncation.
      const batchSize = 2;

      for (let first = 1; first <= totalScenes; first += batchSize) {
        const last = Math.min(totalScenes, first + batchSize - 1);

        setBusy(
          true,
          `Step 2 of 2: Creating scenes ${first}-${last} of ${totalScenes}...`
        );

        const batchSpec = [];

        for (let number = first; number <= last; number++) {
          batchSpec.push(
            `SCENE ${String(number).padStart(2, "0")}\n` +
            `Duration: exactly ${sceneDurations[number - 1]} seconds`
          );
        }

        let batch = "";
        let lastError = null;

        // One retry for a failed or obviously incomplete batch.
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            batch = await askAI(`
ROLE: You are writing production-ready scenes for an original drama.

STORY BIBLE — LOCKED, DO NOT CHANGE:
${bible}

USER'S ORIGINAL IDEA:
${idea}

SETTINGS:
Language: ${language}
Character style: ${characterStyle}
Visual direction: ${visualVision}
Total runtime: exactly ${seconds} seconds.
Total scenes: ${totalScenes}.

WRITE ONLY THESE SCENES:
${batchSpec.join("\n\n")}

For EACH requested scene, include all of these fields:

SCENE NUMBER AND TITLE
EXACT DURATION
LOCATION AND TIME
CHARACTERS PRESENT
CHARACTER APPEARANCE AND WARDROBE
OPENING VISUAL
ACTION: describe the events in clear sequential order
EMOTION AND FACIAL EXPRESSIONS
DIALOGUE: identify each speaker; use natural ${language}
CAMERA: framing and movement
LIGHTING AND COLOR
SOUND AND AMBIENCE
AI VIDEO VISUAL PROMPT: a detailed standalone prompt that can be used without reading the previous scene
NEGATIVE PROMPT: visual errors, extra people, face changes, wardrobe changes, distorted hands, text artifacts
CONTINUITY LINK: explain how this scene follows the previous scene and what must carry into the next

RULES:
- Write every requested scene, not just a summary.
- Do not include other scene numbers.
- Do not change character names, ages, faces, hairstyles, clothes, locations or established facts.
- Do not add a new major character unless the story bible requires one.
- Dialogue must be natural and complete, not cut off.
- Match the scene's exact assigned duration. Keep actions and dialogue realistic for that duration.
- The events must move the story forward.
- Preserve chronological order.
- Do not skip directly to the ending unless this is the final scene.
- The final scene must resolve the story or deliver the story bible's planned cliffhanger.
- Do not claim a scene is complete if it is incomplete.
- Use clear headings and concise production-ready instructions.
${attempt === 2 ? "\nIMPORTANT: The previous attempt was incomplete. Return every requested scene with all required fields and finish every sentence." : ""}
`);

            checkGeneratedBatch(batch, first, last);
            lastError = null;
            break;
          } catch (error) {
            lastError = error;
            if (attempt < 2) await wait(800);
          }
        }

        if (lastError) {
          throw new Error(
            `Hindi nakumpleto ang scenes ${first}-${last}. ${lastError.message}`
          );
        }

        parts.push(batch);
        const currentText = parts.join("\n\n");

        const container = planBox || chat;
        const output = container.querySelector("pre");

        if (output) output.textContent = currentText;

        await wait(150);
      }

      const finalPlan = parts.join("\n\n");

      // Check for every planned scene heading before marking the plan ready.
      const missingScenes = [];

      for (let number = 1; number <= totalScenes; number++) {
        const heading = new RegExp(
          `SCENE\\s*0?${number}\\b`,
          "i"
        );

        if (!heading.test(finalPlan)) {
          missingScenes.push(number);
        }
      }

      if (missingScenes.length > 0) {
        throw new Error(
          `May kulang na scene number: ${missingScenes.join(", ")}. Hindi minarkahang kumpleto ang plan.`
        );
      }

      completePlan = finalPlan;

      const container = planBox || chat;
      const output = container.querySelector("pre");

      if (output) {
        output.textContent =
          finalPlan +
          "\n\n# REVIEW STATUS\n" +
          "All planned scene numbers were found in the generated text.\n" +
          "Please review the story, dialogue, continuity and durations before approval.\n" +
          "Video generation has NOT started.";
      }

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.textContent = "Copy Complete Drama Plan";
      copyButton.style.marginTop = "12px";
      copyButton.style.padding = "10px";
      copyButton.style.cursor = "pointer";

      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(completePlan);
          copyButton.textContent = "Copied!";
        } catch {
          addMessage(
            "assistant",
            "Hindi makopya automatic. Piliin ang plan at kopyahin ito."
          );
        }
      });

      container.appendChild(copyButton);

      addMessage(
        "assistant",
        `Nagawa ang drama plan: ${totalScenes} planned scenes, ${seconds} seconds total. Suriin muna ang lahat. Hindi pa nagsisimula ang video generation.`
      );
    } catch (error) {
      console.error("Drama plan generation failed:", error);

      addMessage(
        "assistant",
        `Hindi pa kumpleto ang drama plan: ${error.message}`
      );

      const container = planBox || chat;

      if (container.style.display !== "none") {
        const status = document.createElement("p");
        status.style.color = "#a15c00";
        status.style.marginTop = "12px";
        status.textContent =
          "INCOMPLETE — Huwag munang aprubahan. Tingnan ang error sa ibaba ng chat.";
        container.appendChild(status);
      }
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

  console.log("AI Drama Studio: scene-by-scene generator loaded.");
})();
          
