
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

  const getLanguage = () => $("language")?.value || "Tagalog";
  const getCharacterStyle = () =>
    $("character-style")?.value || "realistic";
  const getVisualVision = () =>
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
      status.appendChild(document.createElement("p"));

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
    if (typeof data?.output_text === "string") return data.output_text;

    if (Array.isArray(data?.content)) {
      return data.content.map((item) => item?.text || "").join("\n");
    }

    if (data?.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }

    return "";
  }

  async function requestAI(prompt) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }]
      })
    });

    const raw = await response.text();
    let data;

    try {
      data = JSON.parse(raw);
    } catch (_) {
      throw new Error("Hindi valid JSON ang sagot ng server.");
    }

    if (!response.ok) {
      throw new Error(
        data.error || `AI request failed (${response.status}).`
      );
    }

    const text = extractText(data).trim();
    if (!text) throw new Error("Walang text na ibinalik ang AI.");
    return text;
  }

  function buildPlanPrompt(idea) {
    return `You are Premium AI Drama Studio.
Create an original drama plan.

IDEA: ${idea}
REQUESTED RUNTIME: ${selectedDuration}
LANGUAGE: ${getLanguage()}
CHARACTER STYLE: ${getCharacterStyle()}
VISUAL STYLE: ${getVisualVision()}

Return:
1. Title and opening hook.
2. Story summary and ending.
3. Characters with ages, appearance, clothes and relationships.
4. Scene-by-scene outline.
5. Dialogue and emotional progression.
6. Locations, props and timeline.
7. Continuity, originality and pacing notes.

IMPORTANT:
The requested runtime is authoritative. Do not change it.
Keep every character's age and appearance consistent.
Write in the requested language.
Do not claim that a video has been generated.`;
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
            <div class="card-description">Review your story</div>
          </div>
          <div class="plan-badge">PLAN READY</div>
        </div>
        <label for="generated-plan">Review or edit your drama plan</label>
        <textarea id="generated-plan"
          style="width:100%;min-height:320px;padding:12px;
          border:1px solid #ddd;border-radius:10px;
          font:14px/1.5 inherit;"></textarea>
        <div class="approval-buttons">
          <button class="secondary-btn" id="copy-plan" type="button">
            📋 Copy Plan
          </button>
          <button class="approve-btn" id="approve-plan" type="button">
            ✓ Approve Plan
          </button>
          <button class="approve-btn" id="build-production-pack"
            type="button" disabled>
            🎬 Build Complete Production Pack
          </button>
        </div>
        <p id="plan-approval-status"></p>
      </section>`;

    $("generated-plan").value = plan;

    $("copy-plan").addEventListener("click", async () => {
      const editor = $("generated-plan");
      try {
        await navigator.clipboard.writeText(editor.value);
        setStatus("Nakopya ang drama plan.");
      } catch (_) {
        editor.focus();
        editor.select();
        setStatus("Napili ang text. Piliin ang Copy sa menu ng device.");
      }
    });

    $("approve-plan").addEventListener("click", () => {
      const editor = $("generated-plan");
      lastPlan = editor.value.trim();

      if (!lastPlan) {
        setStatus("Walang drama plan na maaaprubahan.", true);
        return;
      }

      planApproved = true;
      $("plan-approval-status").textContent =
        "Plan approved. Maaari nang buuin ang Production Pack.";
      $("build-production-pack").disabled = isProcessing;
      setStatus("Naaprubahan ang drama plan.");
    });

    $("build-production-pack").addEventListener(
      "click",
      createProductionPack
    );

    planPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function getSections() {
    return [
      {
        title: "PART 1 — STORY BIBLE AND CHARACTER DNA",
        task: `Create the authoritative Story Bible.
Include:
- Exact title, genre, requested runtime and language.
- One canonical age for every character.
- Face, hair, skin tone, body type, voice and personality.
- Exact wardrobe, accessories and recurring props.
- Relationships, locations, timeline and plot facts.
- Master visual style and color palette.
- Explicit locked facts that later sections must not change.

Resolve contradictions in the approved plan conservatively.
The selected runtime is authoritative.
Choose one coherent version of conflicting story details.
State the chosen facts clearly.
Do not write scenes yet.`
      },
      {
        title: "PART 2 — COMPLETE SCENE-BY-SCENE PROMPTS",
        task: `Using the Story Bible and previous output, create
the complete scene list for the approved story.

For every scene include:
- Scene number, purpose and duration.
- Location and time of day.
- Characters present and their locked appearance.
- Specific visible actions and facial expressions.
- A detailed standalone AI video-generation prompt.
- Camera framing and movement.
- Lighting, atmosphere, sound and transition.
- Continuity details carried into the next scene.

Cover the selected runtime. Scene durations must add up
approximately to the requested runtime.
Do not replace actual scenes with a summary.
Do not change character ages, clothes or locations
unless the Story Bible explicitly allows it.`
      },
      {
        title: "PART 3 — DIALOGUE AND CINEMATOGRAPHY",
        task: `Create dialogue and audio instructions for every
scene listed in Part 2.

For each scene include:
- Exact dialogue, with the correct speaker identified.
- Voice-over when needed.
- Emotion, delivery, pauses and speaking pace.
- Character reactions and silent acting beats.
- Camera direction, framing and movement.
- Lighting and visual emphasis.
- Music, ambience and sound effects.
- Transitions and timing guidance.

Follow the Story Bible and Part 2 exactly.
Do not change the plot, ages or character identities.
Do not end mid-sentence or omit later scenes.
If dialogue is not appropriate for a scene, say so.`
      },
      {
        title: "PART 4 — EDITING, NEGATIVE PROMPTS AND QUALITY CHECKS",
        task: `Complete the production package.

Include:
- Negative prompts for unwanted visual results.
- Character face, hair, body and wardrobe locks.
- Location, prop, timeline and emotional continuity.
- Editing order, transitions, captions and sound placement.
- Opening hook and ending or cliffhanger.
- Originality, story logic and pacing review.
- Final pre-generation checklist.
- Any unresolved issues that need human review.

Compare the entire package with the Story Bible and
all earlier parts. Identify contradictions rather than
silently ignoring them. Do not claim external verification
or that an actual video has been generated.`
      }
    ];
  }

  async function createProductionPack() {
    if (isProcessing) return;

    const editor = $("generated-plan");
    if (editor && planApproved) lastPlan = editor.value.trim();

    if (!planApproved || !lastPlan) {
      setStatus("Aprubahan muna ang drama plan.", true);
      return;
    }

    const sections = getSections();
    const completed = [];

    setBusy(true);
    lastProductionPack = "";

    try {
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];

        setBusy(
          true,
          `Production Pack: bahagi ${i + 1} sa ${sections.length}...`
        );

        setStatus(
          `Ginagawa ang ${section.title} (${i + 1}/${sections.length})...`
        );

        const previousOutput = completed.length
          ? completed.join("\n\n")
          : "Wala pang naunang output.";

        const prompt = `You are the production engine of Premium AI Drama Studio.

APPROVED DRAMA PLAN:
${lastPlan}

REQUESTED RUNTIME: ${selectedDuration}
LANGUAGE: ${getLanguage()}
CHARACTER STYLE: ${getCharacterStyle()}
VISUAL STYLE: ${getVisualVision()}

PREVIOUS COMPLETED SECTIONS:
${previousOutput}

CURRENT TASK:
${section.title}

${section.task}

STRICT RULES:
- Treat the approved plan and Part 1 Story Bible as the
  authoritative source of truth.
- Once Part 1 defines a fact, never contradict it.
- Preserve every established character and plot event.
- Do not invent a different runtime.
- Write the requested section itself, not an outline of it.
- Keep the answer detailed but finish the entire section.
- Do not claim video generation.`;

        const result = await requestAI(prompt);
        completed.push(`${section.title}\n\n${result}`);

        // Save progress immediately in case a later request fails.
        lastProductionPack =
          "PRODUCTION PACK — IN PROGRESS\n\n" +
          completed.join("\n\n");

        showProductionPack(lastProductionPack);
      }

      setBusy(true, "Checking continuity and completeness...");

      const auditPrompt = `You are the final quality auditor.

Compare the complete Production Pack below with its
approved drama plan.

APPROVED PLAN:
${lastPlan}

PRODUCTION PACK:
${lastProductionPack}

Check:
1. Runtime matches ${selectedDuration}.
2. Character ages, appearance and wardrobe agree.
3. Scene locations, props and timeline agree.
4. Every scene has its corresponding dialogue/audio plan.
5. All four parts are present and end cleanly.
6. There are no obvious contradictions or unfinished sentences.

Return:
A. AUDIT RESULT: PASS or NEEDS REPAIR
B. ISSUES: list each concrete issue, or NONE
C. REQUIRED FIXES: exact changes needed

Do not rewrite the entire pack.
Do not claim checks were externally verified.`;

      const audit = await requestAI(auditPrompt);

      lastProductionPack +=
        "\n\nFINAL CONTINUITY AUDIT\n\n" + audit;

      showProductionPack(lastProductionPack);

      const needsRepair = /NEEDS REPAIR/i.test(audit);

      setStatus(
        needsRepair
          ? "Nagawa ang apat na bahagi, pero may issues pa. Tingnan ang Final Continuity Audit bago gamitin."
          : "Nagawa ang apat na bahagi at nagbalik ang audit ng PASS. Suriin pa rin bago mag-generate ng video."
      );

      addMessage(
        "Production Pack text generation finished. Hindi pa ito nangangahulugang generated na ang video."
      );
    } catch (error) {
      console.error("Production Pack error:", error);

      if (completed.length) {
        lastProductionPack =
          "PARTIAL PRODUCTION PACK — NOT COMPLETE\n\n" +
          completed.join("\n\n");

        showProductionPack(lastProductionPack);

        setStatus(
          `Bahagyang natapos: ${completed.length} sa 4 na bahagi. ` +
          (error.message || "May AI request na pumalya."),
          true
        );
      } else {
        setStatus(
          "Hindi nagawa ang Production Pack: " +
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
        Four-part production package with continuity audit.
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
      <p id="production-pack-status"></p>`;

    $("production-pack-editor").value = pack;

    $("copy-production-pack").addEventListener(
      "click",
      async () => {
        const current = $("production-pack-editor").value;

        try {
          await navigator.clipboard.writeText(current);
          $("production-pack-status").textContent =
            "Nakopya ang Production Pack.";
        } catch (_) {
          const box = $("production-pack-editor");
          box.focus();
          box.select();
          $("production-pack-status").textContent =
            "Napili ang text. Piliin ang Copy sa device menu.";
        }
      }
    );
  }

  async function createDramaPlan() {
    if (isProcessing) return;

    const idea = input?.value.trim() || "";
    if (!idea) {
      setStatus("Ilagay muna ang drama idea.", true);
      input?.focus();
      return;
    }

    setBusy(true, "Creating drama plan...");
    setStatus("Ginagawa ang drama plan...");

    addMessage(
      `Drama idea: ${idea}\nDuration: ${selectedDuration}`,
      "user"
    );

    try {
      const plan = await requestAI(buildPlanPrompt(idea));
      lastPlan = plan;
      showPlan(plan);
      setStatus("Handa na ang drama plan. Suriin at aprubahan ito.");
    } catch (error) {
      console.error("Drama plan error:", error);
      setStatus(
        "Hindi nagawa ang drama plan: " +
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
    console.error("AI Drama Studio: #send-button missing.");
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
    "AI Drama Studio: continuity-aware Production Pack loaded."
  );
})();
  
