
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

  function setStatus(text, isError = false) {
    let status = $("drama-status");

    if (!status) {
      status = document.createElement("div");
      status.id = "drama-status";
      status.className = "message assistant-message";

      const p = document.createElement("p");
      status.appendChild(p);

      const parent = sendButton && sendButton.parentElement;

      if (parent) parent.appendChild(status);
      else if (planPanel && planPanel.parentElement) {
        planPanel.parentElement.insertBefore(status, planPanel);
      }
    }

    status.className =
      "message " +
      (isError ? "user-message" : "assistant-message");

    status.firstElementChild.textContent = text;
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

    if (data && typeof data.response === "string") {
      return data.response;
    }

    if (data && typeof data.result === "string") {
      return data.result;
    }

    if (data && typeof data.output_text === "string") {
      return data.output_text;
    }

    if (data && Array.isArray(data.content)) {
      return data.content
        .map((item) => (item && item.text) || "")
        .join("\n");
    }

    if (
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message
    ) {
      return data.choices[0].message.content || "";
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
        "Hindi valid JSON ang server response."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error || `AI request failed (${response.status}).`
      );
    }

    const text = extractText(data);

    if (!text.trim()) {
      throw new Error(
        "Walang text na ibinalik ang AI model."
      );
    }

    return text.trim();
  }

  function selectedValue(id, fallback) {
    const element = $(id);
    return element && element.value
      ? element.value
      : fallback;
  }

  function buildPlanPrompt(idea) {
    return `You are Premium AI Drama Studio.

Create an original drama production plan.
Do not copy existing stories or creators.

DRAMA IDEA: ${idea}
VIDEO LENGTH: ${selectedDuration}
LANGUAGE: ${selectedValue("language", "Tagalog")}
CHARACTER STYLE: ${selectedValue("character-style", "realistic")}
VISUAL VISION: ${selectedValue("visual-vision", "cinematic")}

Include:
1. Title and opening hook.
2. Story summary and emotional payoff.
3. Character profiles and Character DNA.
4. Scene-by-scene breakdown with duration,
   location, visible actions and dialogue.
5. Camera, lighting, sound and transitions.
6. Character, wardrobe, prop and location continuity.
7. Ending or cliffhanger.
8. Originality, pacing and continuity checks.

Write the complete plan in the selected language.
Do not claim a video has been generated.`;
  }

  function buildProductionPrompt(plan) {
    return `You are the Complete Production Pack Engine
inside Premium AI Drama Studio.

Create a COMPLETE, production-ready prompt package
using ONLY the approved drama plan below.

APPROVED DRAMA PLAN:
${plan}

VIDEO LENGTH: ${selectedDuration}
LANGUAGE: ${selectedValue("language", "Tagalog")}
CHARACTER STYLE: ${selectedValue("character-style", "realistic")}
VISUAL VISION: ${selectedValue("visual-vision", "cinematic")}

OUTPUT REQUIREMENTS:

1. PRODUCTION OVERVIEW
- Final title, genre, target emotion and story hook.
- Intended runtime and visual style.

2. CHARACTER DNA LOCK
- Each character's age range, face, hair, skin tone,
  body type, voice, personality and identifying details.
- Exact wardrobe and accessories.
- Relationships and emotional state.
- Repeat essential descriptions in scene prompts.
- Never change character identity between scenes.

3. MASTER VISUAL LOCK
- Art direction, color palette, aspect ratio,
  lighting style, environment and visual realism.
- Keep locations, props, weather and time consistent.

4. COMPLETE SCENE-BY-SCENE PRODUCTION PROMPTS
For EVERY scene provide:
- Scene number and purpose.
- Suggested duration.
- Location and time of day.
- Characters visible in frame.
- Character actions and facial expressions.
- Detailed, standalone AI video prompt.
- Dialogue or voice-over, with speaker identified.
- Camera framing, movement and composition.
- Lighting, ambience, music and sound effects.
- Transition to the next scene.
- Continuity details required from the previous scene.

Ensure scene durations fit the selected runtime.
Do not omit scenes from the approved story.

5. NEGATIVE PROMPTS
List unwanted results such as inconsistent faces,
changing clothes, extra fingers, duplicate characters,
unwanted text, flicker, distorted anatomy and
unintended changes to props or locations.

6. EDITING BLUEPRINT
- Scene order and transitions.
- Pacing, sound placement and music cues.
- Opening hook, captions and ending.
- Cliffhanger or emotional payoff when appropriate.

7. CONTINUITY CHECK
Check character identity, wardrobe, props,
location, timeline, dialogue and emotional progression.
List any unresolved continuity issues honestly.

8. ORIGINALITY AND QUALITY CHECK
Check originality, pacing, clarity and story logic.
Do not claim checks were externally verified.
Identify anything that needs human review.

9. FINAL GENERATION CHECKLIST
Provide a checklist to review before generating video.

IMPORTANT:
- Preserve the approved story and its characters.
- Do not invent unrelated plot changes.
- Make prompts detailed enough to use individually.
- Write in the selected language.
- This is a text production package only.
- Do not claim that an MP4 or video was generated.
- Do not omit sections to make the answer shorter.`;
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
      <div class="card-title">
        🎬 COMPLETE PRODUCTION PACK
      </div>
      <p class="card-description">
        Production-ready prompts based on your approved plan.
      </p>
      <label for="production-pack-editor">
        Review or edit your Production Pack
      </label>
      <textarea
        id="production-pack-editor"
        style="width:100%;min-height:360px;padding:12px;
        border:1px solid #ddd;border-radius:10px;
        font:14px/1.5 inherit;"
      ></textarea>
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
        const editor = $("production-pack-editor");

        try {
          await navigator.clipboard.writeText(editor.value);
          $("production-pack-status").textContent =
            "Production Pack copied.";
        } catch (_) {
          editor.focus();
          editor.select();
          $("production-pack-status").textContent =
            "Text selected. Choose Copy from your tablet menu.";
        }
      }
    );

    panel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
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
              AI-generated production blueprint
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
        setStatus("Nakopya ang drama plan.");
      } catch (_) {
        editor.focus();
        editor.select();
        setStatus("Napili ang text. Piliin ang Copy sa menu.");
      }
    });

    $("approve-plan").addEventListener("click", () => {
      lastPlan = $("generated-plan").value.trim();

      if (!lastPlan) {
        setStatus("Walang plan na maaaprubahan.", true);
        return;
      }

      planApproved = true;

      $("plan-approval-status").textContent =
        "Plan approved. Maaari ka nang bumuo ng Production Pack.";

      $("build-production-pack").disabled = isProcessing;

      setStatus("Naaprubahan ang drama plan.");
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

  async function createDramaPlan() {
    if (isProcessing) return;

    const idea = input ? input.value.trim() : "";

    if (!idea) {
      setStatus(
        "Ilagay muna ang drama idea bago gumawa ng plan.",
        true
      );
      if (input) input.focus();
      return;
    }

    setBusy(true, "Creating your drama plan...");
    setStatus("Ginagawa ang drama plan. Sandali lang...");

    addMessage(
      `Drama idea: ${idea}\nDuration: ${selectedDuration}`,
      "user"
    );

    try {
      const plan = await requestAI(buildPlanPrompt(idea));
      lastPlan = plan;
      showPlan(plan);
      setStatus("Tapos na ang drama plan. Suriin at aprubahan ito.");
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

  async function createProductionPack() {
    if (isProcessing) return;

    if (!planApproved || !lastPlan.trim()) {
      setStatus(
        "Aprubahan muna ang drama plan bago gumawa ng Production Pack.",
        true
      );
      return;
    }

    // Keep any edits made before approval.
    const approvedEditor = $("generated-plan");
    if (approvedEditor) {
      lastPlan = approvedEditor.value.trim();
    }

    setBusy(true, "Building Complete Production Pack...");
    setStatus(
      "Binubuo ang Production Pack mula sa approved plan..."
    );

    try {
      const pack = await requestAI(
        buildProductionPrompt(lastPlan)
      );

      showProductionPack(pack);

      setStatus(
        "Production Pack ready. Suriin at kopyahin ang prompts."
      );

      addMessage(
        "Nagawa na ang Complete Production Pack. Text prompts pa lamang ito; hindi pa generated video."
      );
    } catch (error) {
      console.error("Production Pack error:", error);
      setStatus(
        "Hindi nagawa ang Production Pack: " +
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
    console.error("Missing #send-button.");
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
    "AI Drama Studio: Production Pack workflow loaded."
  );
})();
        
