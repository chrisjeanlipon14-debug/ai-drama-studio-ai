
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const input = $("user-input");
  const sendButton = $("send-button");
  const planPanel = $("studio-plan");
  const chatMessages = $("chat-messages");
  const typing = $("typing-indicator");

  let selectedDuration = "5 min";
  let isProcessing = false;
  let lastPlan = "";
  let planApproved = false;
  let lastProductionPack = "";

  const language = () =>
    $("language")?.value || "Tagalog";

  const characterStyle = () =>
    $("character-style")?.value || "realistic";

  const visualVision = () =>
    $("visual-vision")?.value || "cinematic";

  function addMessage(text, who = "assistant") {
    if (!chatMessages) return;

    const wrapper = document.createElement("div");
    wrapper.className =
      "message " +
      (who === "user" ? "user-message" : "assistant-message");

    const p = document.createElement("p");
    p.textContent = text;
    wrapper.appendChild(p);
    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function setStatus(message, isError = false) {
    let status = $("drama-status");

    if (!status) {
      status = document.createElement("div");
      status.id = "drama-status";
      status.className = "message assistant-message";

      const p = document.createElement("p");
      status.appendChild(p);

      const parent = sendButton?.parentElement;

      if (parent) parent.appendChild(status);
      else if (planPanel?.parentElement) {
        planPanel.parentElement.insertBefore(status, planPanel);
      }
    }

    status.className =
      "message " +
      (isError ? "user-message" : "assistant-message");

    status.firstElementChild.textContent = message;
  }

  function setBusy(busy, message = "") {
    isProcessing = busy;

    if (sendButton) {
      sendButton.disabled = busy;
      sendButton.textContent = busy
        ? "⏳ Processing..."
        : "🎬 Create Drama Plan";
    }

    const buildButton = $("build-production-pack");

    if (buildButton) {
      buildButton.disabled = busy || !planApproved;
    }

    if (typing) {
      typing.classList.toggle("visible", busy);
      if (message) typing.textContent = message;
    }
  }

  function extractText(data) {
    if (typeof data === "string") return data;
    if (typeof data?.response === "string") return data.response;
    if (typeof data?.result === "string") return data.result;
    if (typeof data?.output_text === "string") {
      return data.output_text;
    }

    if (Array.isArray(data?.content)) {
      return data.content
        .map((item) => item?.text || "")
        .join("\n");
    }

    if (data?.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }

    return "";
  }

  async function requestAI(prompt) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [
          { role: "user", content: prompt }
        ]
      })
    });

    const raw = await response.text();
    let data;

    try {
      data = JSON.parse(raw);
    } catch (_) {
      throw new Error(
        "Invalid server response. Check the Worker backend."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error || `AI request failed (${response.status}).`
      );
    }

    const text = extractText(data).trim();

    if (!text) {
      throw new Error(
        "The AI returned an empty response."
      );
    }

    return text;
  }

  function buildPlanPrompt(idea) {
    return `You are Premium AI Drama Studio.

Create a detailed, original drama plan.

IDEA: ${idea}
RUNTIME: ${selectedDuration}
LANGUAGE: ${language()}
CHARACTER STYLE: ${characterStyle()}
VISUAL STYLE: ${visualVision()}

Include:
1. Title and opening hook.
2. Complete story summary and ending.
3. Main and supporting character profiles.
4. Scene-by-scene story outline.
5. Dialogue and emotional progression.
6. Locations, props and timeline.
7. Continuity, originality and pacing checks.

Make the story suitable for AI video production.
Write in the selected language.
Do not claim that video has been generated.`;
  }

  function showPlan(plan) {
    if (!planPanel) {
      addMessage(plan);
      return;
    }

    planApproved = false;
    lastProductionPack = "";

    planPanel.style.display = "block";
    planPanel.hidden = false;

    planPanel.innerHTML = `
      <section class="card">
        <div class="plan-header">
          <div>
            <div class="card-title">🎬 DRAMA PLAN</div>
            <div class="card-description">
              Review your AI-generated story
            </div>
          </div>
          <div class="plan-badge">PLAN READY</div>
        </div>

        <label for="generated-plan">
          Review or edit your drama plan
        </label>

        <textarea id="generated-plan"
          style="width:100%;min-height:320px;padding:12px;
          border:1px solid #ddd;border-radius:10px;
          font:14px/1.5 inherit;"></textarea>

        <div class="approval-buttons">
          <button class="secondary-btn" id="copy-plan"
            type="button">📋 Copy Plan</button>

          <button class="approve-btn" id="approve-plan"
            type="button">✓ Approve Plan</button>

          <button class="approve-btn" id="build-production-pack"
            type="button" disabled>
            🎬 Build Complete Production Pack
          </button>
        </div>

        <p id="plan-approval-status"></p>
      </section>
    `;

    $("generated-plan").value = plan;

    $("copy-plan").addEventListener("click", async () => {
      const editor = $("generated-plan");

      try {
        await navigator.clipboard.writeText(editor.value);
        setStatus("Drama plan copied.");
      } catch (_) {
        editor.focus();
        editor.select();
        setStatus("Text selected. Choose Copy from the menu.");
      }
    });

    $("approve-plan").addEventListener("click", () => {
      lastPlan = $("generated-plan").value.trim();

      if (!lastPlan) {
        setStatus("The drama plan is empty.", true);
        return;
      }

      planApproved = true;

      $("plan-approval-status").textContent =
        "Plan approved. You can now build the Production Pack.";

      $("build-production-pack").disabled = isProcessing;

      setStatus("Drama plan approved.");
    });

    $("build-production-pack").addEventListener(
      "click",
      createProductionPack
    );

    planPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function getPackSections() {
    return [
      {
        title: "PART 1 — CHARACTER DNA AND MASTER VISUAL LOCK",
        instruction: `
Create the production foundation.

Include:
- Final title, genre, runtime and story hook.
- Every character's age range, face, hair, skin tone,
  body type, identifying details, personality and voice.
- Exact wardrobe, accessories and props.
- Character relationships and emotional arcs.
- Master visual style, color palette, aspect ratio,
  lighting approach, environment and realism.
- Location descriptions and recurring visual details.
- A reusable character consistency block.

Be specific. Do not use vague placeholders.
Preserve the approved story.`
      },
      {
        title: "PART 2 — COMPLETE SCENE-BY-SCENE VIDEO PROMPTS",
        instruction: `
Create the complete scene list for the approved story.

For EVERY scene include:
- Scene number and purpose.
- Suggested duration.
- Location and time of day.
- Characters visible in frame.
- Exact visible actions and facial expressions.
- A detailed, standalone AI video generation prompt.
- Camera framing, lens feel and camera movement.
- Lighting, atmosphere and color.
- Sound effects and background ambience.
- Transition into the next scene.
- Required character, wardrobe, prop and location locks.

Each scene prompt must be usable independently.
Repeat the relevant character appearance details in each
prompt so visual consistency does not depend on memory.

Cover the full runtime. Do not stop after the first scenes.
Do not replace actual scenes with a general summary.`
      },
      {
        title: "PART 3 — DIALOGUE, VOICE AND CINEMATOGRAPHY",
        instruction: `
Create a scene-by-scene dialogue and audio blueprint.

For each scene provide:
- Speaker names and exact dialogue.
- Voice-over where appropriate.
- Pauses, delivery, emotion and speaking pace.
- Character reactions and silent acting beats.
- Camera framing, movement and composition.
- Lighting changes and visual emphasis.
- Music cues, sound effects and ambience.
- Scene transitions and timing guidance.

Keep dialogue consistent with the approved plot.
Do not invent unrelated subplots.
Use the selected language throughout.`
      },
      {
        title: "PART 4 — NEGATIVE PROMPTS, EDITING AND QUALITY CHECKS",
        instruction: `
Complete the production package.

Include:
- Negative prompts for unwanted visual results.
- Face, hair, body, clothing and prop consistency rules.
- Location, timeline and emotional continuity checks.
- Originality and story-logic review.
- Pacing and runtime review.
- Editing order, transitions, captions and sound placement.
- Opening hook and ending or cliffhanger.
- Final pre-generation checklist.
- Unresolved issues that require human review.

Be honest about any checks that cannot be confirmed.
Do not claim external verification or generated video.
Make the package practical for AI video production.`
      }
    ];
  }

  async function createProductionPack() {
    if (isProcessing) return;

    const editor = $("generated-plan");

    if (editor && planApproved) {
      lastPlan = editor.value.trim();
    }

    if (!planApproved || !lastPlan.trim()) {
      setStatus(
        "Approve the drama plan before building the Production Pack.",
        true
      );
      return;
    }

    const sections = getPackSections();
    const completed = [];

    setBusy(true);
    lastProductionPack = "";

    try {
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];

        setBusy(
          true,
          `Creating production section ${i + 1} of ${sections.length}...`
        );

        setStatus(
          `Generating ${i + 1}/${sections.length}: ${section.title}`
        );

        const prompt = `
You are the Production Engine of Premium AI Drama Studio.

APPROVED DRAMA PLAN:
${lastPlan}

RUNTIME: ${selectedDuration}
LANGUAGE: ${language()}
CHARACTER STYLE: ${characterStyle()}
VISUAL STYLE: ${visualVision()}

TASK:
${section.title}

${section.instruction}

Requirements:
- Follow the approved plan and its established characters.
- Write the actual requested content, not an outline of it.
- Be detailed, concrete and production-ready.
- Do not repeat other sections unnecessarily.
- Do not claim that a video has been generated.
- If the source plan lacks a detail, make a reasonable
  creative choice consistent with the story.
`;

        const result = await requestAI(prompt);

        completed.push(
          `\n\n${section.title}\n\n${result}`
        );
      }

      lastProductionPack =
        `COMPLETE PRODUCTION PACK\n` +
        `Title: AI Drama Studio Production\n` +
        `Runtime: ${selectedDuration}\n` +
        `Language: ${language()}\n` +
        completed.join("\n");

      showProductionPack(lastProductionPack);

      setStatus(
        "All four sections returned. Review the complete pack."
      );

      addMessage(
        "Production Pack generation finished. This is a text package, not a generated video."
      );
    } catch (error) {
      console.error("Production Pack error:", error);

      if (completed.length) {
        lastProductionPack =
          "PARTIAL PRODUCTION PACK\n" +
          completed.join("\n");

        showProductionPack(lastProductionPack);

        setStatus(
          `Generation stopped early. ${completed.length} of 4 sections completed. ` +
          (error.message || ""),
          true
        );
      } else {
        setStatus(
          "Production Pack failed: " +
          (error.message || "Unknown error"),
          true
        );
      }
    } finally {
      setBusy(false);
    }
  }

  function showProductionPack(pack) {
    lastProductionPack = pack;

    let panel = $("production-pack-panel");

    if (!panel) {
      panel = document.createElement("section");
      panel.id = "production-pack-panel";
      panel.className = "card";
      planPanel.appendChild(panel);
    }

    panel.style.display = "block";

    panel.innerHTML = `
      <div class="card-title">🎬 COMPLETE PRODUCTION PACK</div>
      <p class="card-description">
        Four-part production package based on your approved plan.
      </p>
      <label for="production-pack-editor">
        Review or edit the Production Pack
      </label>
      <textarea id="production-pack-editor"
        style="width:100%;min-height:420px;padding:12px;
        border:1px solid #ddd;border-radius:10px;
        font:14px/1.5 inherit;"></textarea>
      <div class="approval-buttons">
        <button class="secondary-btn" id="copy-production-pack"
          type="button">📋 Copy Production Pack</button>
      </div>
      <p id="production-pack-status"></p>
    `;

    $("production-pack-editor").value = pack;

    $("copy-production-pack").addEventListener(
      "click",
      async () => {
        const text = $("production-pack-editor").value;

        try {
          await navigator.clipboard.writeText(text);
          $("production-pack-status").textContent =
            "Production Pack copied.";
        } catch (_) {
          const editor = $("production-pack-editor");
          editor.focus();
          editor.select();

          $("production-pack-status").textContent =
            "Text selected. Choose Copy from your device menu.";
        }
      }
    );

    panel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  async function createDramaPlan() {
    if (isProcessing) return;

    const idea = input?.value.trim() || "";

    if (!idea) {
      setStatus("Enter a drama idea first.", true);
      input?.focus();
      return;
    }

    setBusy(true, "Creating drama plan...");
    setStatus("Creating your drama plan...");

    addMessage(
      `Drama idea: ${idea}\nDuration: ${selectedDuration}`,
      "user"
    );

    try {
      const plan = await requestAI(buildPlanPrompt(idea));
      lastPlan = plan;
      showPlan(plan);
      setStatus("Drama plan ready. Review and approve it.");
    } catch (error) {
      console.error("Drama plan error:", error);

      setStatus(
        "Drama plan failed: " +
        (error.message || "Unknown error"),
        true
      );
    } finally {
      setBusy(false);
    }
  }

  document.querySelectorAll(".length-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".length-btn").forEach((item) => {
        item.classList.remove("selected");
      });

      button.classList.add("selected");
      selectedDuration = button.textContent.trim();
    });
  });

  if (sendButton) {
    sendButton.addEventListener("click", createDramaPlan);
  } else {
    console.error("AI Drama Studio: #send-button is missing.");
  }

  if (input) {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        createDramaPlan();
      }
    });
  }

  console.info(
    "AI Drama Studio: multi-part Production Pack workflow loaded."
  );
})();
