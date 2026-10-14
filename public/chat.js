
(() => {
  "use strict";

  const API_CHAT = "/api/chat";
  const $ = (selector) => document.querySelector(selector);

  const input = $("#user-input");
  const sendButton = $("#send-button");
  const chatMessages = $("#chat-messages");
  const typingIndicator = $("#typing-indicator");
  const studioPlan = $("#studio-plan");

  if (!input || !sendButton || !chatMessages) {
    console.error("AI Drama Studio: Required HTML elements not found.");
    return;
  }

  let selectedRuntime = "1 minute";
  let approvedPlan = "";
  let productionPack = [];
  let isBusy = false;

  const PARTS = [
    {
      title: "PART 1 — STORY BIBLE AND CHARACTER DNA",
      instructions: `
Create the complete story bible and character profiles.

Include:
1. Exact title, genre, language, and requested runtime.
2. Story premise, beginning, conflict, climax, and ending.
3. Every important character's age, appearance, hair, skin tone,
   body type, voice, personality, wardrobe, accessories, and props.
4. Location and timeline locks.
5. Relationships and character motivations.

Define each character only once. Keep the same age, appearance,
wardrobe, and relationships throughout the entire production pack.
Do not invent story events that contradict the approved plan.
`
    },
    {
      title: "PART 2 — COMPLETE SCENE-BY-SCENE PROMPTS",
      instructions: `
Create ALL scenes needed to tell the approved story within the
exact requested runtime.

For every scene include:
- Scene number and exact start/end timestamps.
- Duration in seconds.
- Location and time of day.
- Characters present, using their locked ages.
- Purpose and visible actions.
- Facial expressions and body language.
- A complete standalone AI video-generation prompt.
- Camera, framing, movement, lighting, atmosphere, and sound.
- Transition to the next scene.

RUNTIME IS LOCKED. Never increase, decrease, or reinterpret it.
The total scene durations MUST equal the requested runtime.
For a 1-minute story, the total must be exactly 60 seconds.
Use multiple short scenes as needed. Do not create only one scene
unless the approved story specifically requires it.

Do not leave prompts unfinished or replace details with placeholders.
`
    },
    {
      title: "PART 3 — DIALOGUE AND CINEMATOGRAPHY",
      instructions: `
Cover EVERY scene from Part 2, using the same scene numbers.

For each scene specify:
- Exact dialogue in the requested language, or explicitly say
  "No dialogue" when appropriate.
- Voice-over or narration, if needed.
- Speaker, emotion, delivery, pacing, and pauses.
- Character reactions and silent acting beats.
- Camera direction, framing, movement, and lighting.
- Sound effects, ambience, and music.
- On-screen text, if required.

Dialogue and action must fit the scene duration.
Do not describe dialogue that is missing from the actual script.
Do not invent additional characters or change the ending.
`
    },
    {
      title: "PART 4 — EDITING, NEGATIVE PROMPTS AND QUALITY CHECKS",
      instructions: `
Provide:
1. Editing timeline matching the locked runtime.
2. Scene transitions and pacing.
3. Negative prompts for unwanted visual results.
4. Character face, hair, body, wardrobe, and accessory locks.
5. Location, prop, timeline, and lighting continuity locks.
6. Audio and subtitle instructions.
7. A final checklist for reviewing the generated video.

Check every scene against Parts 1, 2, and 3.
Do not claim that a check passed if the required information is absent.
Do not alter the approved story or requested runtime.
`
    }
  ];

  function addMessage(role, text) {
    const item = document.createElement("div");
    item.className = `message ${role}-message`;
    item.textContent = text;
    chatMessages.appendChild(item);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return item;
  }

  function setBusy(value) {
    isBusy = value;
    sendButton.disabled = value;
    sendButton.textContent = value ? "Please wait..." : "Send";

    if (typingIndicator) {
      typingIndicator.style.display = value ? "block" : "none";
    }
  }

  function getRuntimeSeconds(runtime) {
    const value = String(runtime).toLowerCase().trim();

    const minuteMatch = value.match(/(\d+(?:\.\d+)?)\s*min/);
    const secondMatch = value.match(/(\d+(?:\.\d+)?)\s*sec/);
    const hourMatch = value.match(/(\d+(?:\.\d+)?)\s*hour/);

    if (secondMatch) return Math.round(Number(secondMatch[1]));
    if (hourMatch) return Math.round(Number(hourMatch[1]) * 3600);
    if (minuteMatch) return Math.round(Number(minuteMatch[1]) * 60);

    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? Math.round(number * 60) : 60;
  }

  function getLanguage() {
    const selector = $("#language");
    return selector?.selectedOptions?.[0]?.textContent?.trim()
      || selector?.value
      || "Tagalog";
  }

  function getOption(selector, fallback) {
    const element = $(selector);
    return element?.selectedOptions?.[0]?.textContent?.trim()
      || element?.value
      || fallback;
  }

  function extractText(data) {
    if (typeof data === "string") return data;

    const candidates = [
      data?.response,
      data?.result?.response,
      data?.output,
      data?.content,
      data?.message?.content,
      data?.result?.content,
      data?.choices?.[0]?.message?.content
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }

    if (Array.isArray(data?.content)) {
      const text = data.content
        .map((item) => item?.text || "")
        .filter(Boolean)
        .join("\n");

      if (text) return text;
    }

    throw new Error("Walang mabasang text sa AI response.");
  }

  async function askAI(prompt) {
    const response = await fetch(API_CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }]
      })
    });

    const raw = await response.text();

    if (!response.ok) {
      throw new Error(`AI request failed (${response.status}): ${raw.slice(0, 300)}`);
    }

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("Hindi valid JSON ang sagot ng AI.");
    }

    return extractText(data);
  }

  function buildPlanPrompt(idea, runtime, language) {
    const seconds = getRuntimeSeconds(runtime);

    return `
You are the story planner for an original AI drama production studio.

Create an ORIGINAL drama plan based on the user's idea.

USER'S IDEA:
${idea}

LOCKED SETTINGS:
- Requested runtime: ${runtime}
- Exact runtime in seconds: ${seconds}
- Language: ${language}
- Visual style: ${getOption("#character-style", "Cinematic realistic")}
- Visual direction: ${getOption("#visual-vision", "Emotional cinematic")}

RULES:
1. The requested runtime is authoritative and must not be changed.
2. Do not recommend a longer runtime as a required fix.
3. Make the story achievable within the requested duration.
4. Define character ages, appearance, wardrobe, and timeline clearly.
5. Keep the locations, props, and events consistent.
6. Give the story a clear beginning, conflict, and ending.
7. Make the story original. Do not copy an existing story.
8. For short videos, prioritize a clear visual story and concise dialogue.

Return a practical, detailed plan with:
- Title and logline
- Runtime and language
- Story summary
- Character profiles
- Location and timeline
- Scene outline with durations that add up to exactly ${seconds} seconds
- Dialogue or voice-over direction
- Ending
- Continuity locks

End with: PLAN READY FOR REVIEW
`;
  }

  function getPlanText() {
    return approvedPlan;
  }

  function showPlan(text) {
    approvedPlan = text;

    if (studioPlan) {
      studioPlan.style.display = "block";
      studioPlan.textContent = "";

      const heading = document.createElement("h3");
      heading.textContent = "Drama Plan — For Review";

      const content = document.createElement("pre");
      content.style.whiteSpace = "pre-wrap";
      content.textContent = text;

      const approve = document.createElement("button");
      approve.type = "button";
      approve.textContent = "Approve Plan & Build Complete Production Pack";
      approve.addEventListener("click", buildProductionPack);

      studioPlan.append(heading, content, approve);
      studioPlan.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      addMessage("assistant", text);

      const approve = document.createElement("button");
      approve.type = "button";
      approve.textContent = "Approve Plan & Build Complete Production Pack";
      approve.addEventListener("click", buildProductionPack);
      chatMessages.appendChild(approve);
    }
  }

  async function generatePlan() {
    const idea = input.value.trim();

    if (!idea) {
      addMessage("assistant", "Ilagay muna ang drama idea bago magpatuloy.");
      return;
    }

    selectedRuntime =
      document.querySelector(".length-btn.active")?.dataset?.length
      || document.querySelector(".length-btn.active")?.textContent?.trim()
      || selectedRuntime;

    const language = getLanguage();

    setBusy(true);
    addMessage("user", `${idea}\nRuntime: ${selectedRuntime}\nLanguage: ${language}`);

    try {
      const plan = await askAI(buildPlanPrompt(idea, selectedRuntime, language));

      if (!plan || plan.length < 100) {
        throw new Error("Masyadong maikli ang drama plan. Hindi ito tinanggap.");
      }

      showPlan(plan);
      addMessage("assistant", "Nagawa na ang drama plan. Suriin muna ito bago i-approve.");
    } catch (error) {
      addMessage("assistant", `Hindi nagawa ang plan: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  function buildPartPrompt(part, index) {
    const previous = productionPack.length
      ? productionPack.join("\n\n")
      : "Wala pang naunang section.";

    return `
You are producing one section of a complete AI drama production package.

APPROVED DRAMA PLAN — SOURCE OF TRUTH:
${getPlanText()}

LOCKED SETTINGS:
- Runtime: ${selectedRuntime}
- Runtime seconds: ${getRuntimeSeconds(selectedRuntime)}
- Language: ${getLanguage()}

PREVIOUS COMPLETED SECTIONS:
${previous}

TASK:
${part.title}

${part.instructions}

NON-NEGOTIABLE CONTINUITY RULES:
- The approved plan is the source of truth.
- Do not change the title, runtime, language, ending, character ages,
  relationships, or established events.
- Do not introduce a conflicting location, prop, or timeline.
- Keep names and scene numbers consistent across sections.
- Do not repeat the whole previous section.
- Return this section only, with complete details.
- Never stop in the middle of a sentence or bullet.
- If something is not established in the plan, choose one reasonable
  detail and keep it consistent in this section and later sections.
- Do not ask the user to increase the runtime.

This is section ${index + 1} of ${PARTS.length}.
`;
  }

  function updatePackDisplay(status) {
    const text = [
      status,
      "",
      ...productionPack
    ].join("\n\n");

    if (studioPlan) {
      studioPlan.style.display = "block";
      studioPlan.textContent = "";

      const heading = document.createElement("h3");
      heading.textContent = status;

      const content = document.createElement("pre");
      content.style.whiteSpace = "pre-wrap";
      content.textContent = text;

      studioPlan.append(heading, content);
    } else {
      addMessage("assistant", text);
    }
  }

  function auditPrompt() {
    return `
You are the final continuity auditor for an AI drama production package.

APPROVED PLAN:
${getPlanText()}

LOCKED REQUESTED RUNTIME:
${selectedRuntime}
Exact seconds: ${getRuntimeSeconds(selectedRuntime)}

PRODUCTION PACKAGE:
${productionPack.join("\n\n")}

Audit only. Do not rewrite the story. Do not change the requested runtime.

Check:
1. Do all scene durations add up to the requested runtime?
2. Are all required parts present and sufficiently complete?
3. Are character ages, appearances, wardrobe, and props consistent?
4. Are locations, events, and timeline consistent with the approved plan?
5. Does every scene have a video prompt?
6. Are dialogue, audio, and cinematography covered for every scene?
7. Are there incomplete sentences, missing sections, or placeholders?

IMPORTANT:
A 1-minute request is valid. Never mark it as invalid merely because
you believe a longer story would have more emotional depth.
Do not require a 10–15 minute runtime unless the user requested it.

Return exactly this format:

FINAL CONTINUITY AUDIT
AUDIT RESULT: PASS or NEEDS REPAIR

RUNTIME CHECK:
[Findings]

COMPLETENESS CHECK:
[Findings]

CONTINUITY CHECK:
[Findings]

REQUIRED FIXES:
[List specific problems. If none, write None.]

Only use PASS if the pack is complete and has no material continuity
conflicts. Do not claim a check passed without evidence.
`;
  }

  async function buildProductionPack() {
    if (isBusy) return;

    if (!getPlanText()) {
      addMessage("assistant", "Walang approved plan. Gumawa muna ng drama plan.");
      return;
    }

    const confirmed = window.confirm(
      "I-build ang Production Pack gamit ang approved plan at locked runtime na " +
      selectedRuntime + "?"
    );

    if (!confirmed) return;

    setBusy(true);
    productionPack = [];
    updatePackDisplay("PRODUCTION PACK — IN PROGRESS");

    try {
      for (let i = 0; i < PARTS.length; i++) {
        updatePackDisplay(`PRODUCTION PACK — GENERATING PART ${i + 1} OF ${PARTS.length}`);

        const result = await askAI(buildPartPrompt(PARTS[i], i));

        if (!result || result.trim().length < 150) {
          throw new Error(
            `Part ${i + 1} (${PARTS[i].title}) ay kulang ang output.`
          );
        }

        productionPack.push(`${PARTS[i].title}\n\n${result.trim()}`);
        updatePackDisplay(`PRODUCTION PACK — PART ${i + 1} COMPLETE`);
      }

      updatePackDisplay("PRODUCTION PACK — RUNNING FINAL AUDIT");

      const audit = await askAI(auditPrompt());

      productionPack.push(audit.trim());

      const passed = /\bAUDIT RESULT:\s*PASS\b/i.test(audit)
        && !/\bAUDIT RESULT:\s*NEEDS REPAIR\b/i.test(audit);

      updatePackDisplay(
        passed
          ? "PRODUCTION PACK — COMPLETE (AUDIT PASSED)"
          : "PRODUCTION PACK — NEEDS REPAIR (NOT APPROVED)"
      );

      const finalText = productionPack.join("\n\n");

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.textContent = "Copy Production Pack";
      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(finalText);
          copyButton.textContent = "Copied!";
        } catch {
          addMessage("assistant", "Hindi makopya automatically. Piliin at kopyahin ang text.");
        }
      });

      if (studioPlan) studioPlan.appendChild(copyButton);
      else chatMessages.appendChild(copyButton);

      addMessage(
        "assistant",
        passed
          ? "Tapos na ang Production Pack at pumasa sa audit. Suriin pa rin ang output bago mag-generate ng video."
          : "Nagawa ang mga section, pero hindi pumasa sa audit. Huwag munang gamitin sa video generation."
      );
    } catch (error) {
      updatePackDisplay("PRODUCTION PACK — INCOMPLETE");

      addMessage(
        "assistant",
        `Hindi kumpleto ang Production Pack: ${error.message}\n` +
        "Napanatili ang mga section na nagawa. Hindi ito mamarkahang kumpleto."
      );
    } finally {
      setBusy(false);
    }
  }

  sendButton.addEventListener("click", generatePlan);

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      generatePlan();
    }
  });

  document.querySelectorAll(".length-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".length-btn").forEach((item) => {
        item.classList.remove("active");
      });

      button.classList.add("active");

      selectedRuntime =
        button.dataset.length || button.textContent.trim();
    });
  });
})();
      
