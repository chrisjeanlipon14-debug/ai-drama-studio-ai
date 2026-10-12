/* AI Drama Studio — corrected approval-first workflow * Drop-in replacement for public/chat.js. * Uses the existing POST /api/chat Cloudflare Worker endpoint. * Does NOT call /api/video or start video rendering. */
(() => {
  "use strict";

  const userInput = document.getElementById("user-input");
  const sendButton = document.getElementById("send-button");
  const typingIndicator = document.getElementById("typing-indicator");
  const studioPlan = document.getElementById("studio-plan");
  const characterStyle = document.getElementById("character-style");
  const language = document.getElementById("language");
  const visualVision = document.getElementById("visual-vision");

  let selectedLength = "5 min";
  let isProcessing = false;
  let project = null;

  const STORAGE_KEY = "ai-drama-studio-project-v3";

  const lengthButtons = document.querySelectorAll(
    ".length-btn, .length-button, .length-option"
  );

  lengthButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.textContent.trim().toLowerCase() === "custom") {
        const entered = window.prompt(
          "Ilang minuto ang target na drama? Maglagay ng numero mula 1 hanggang 20.",
          "5"
        );
        if (entered === null) return;
        const minutes = Number(entered);
        if (!Number.isFinite(minutes) || minutes < 1 || minutes > 20) {
          window.alert("Pumili ng haba mula 1 hanggang 20 minuto.");
          return;
        }
        selectedLength = `${minutes} min (custom)`;
        lengthButtons.forEach((btn) => btn.classList.remove("selected"));
        button.classList.add("selected");
        return;
      }

      selectedLength = button.textContent.trim();
      lengthButtons.forEach((btn) => btn.classList.remove("selected"));
      button.classList.add("selected");
    });
  });

  function showLoading(show, message = "AI Drama Studio is working...") {
    if (typingIndicator) {
      typingIndicator.style.display = show ? "block" : "none";
      typingIndicator.textContent = message;
      typingIndicator.setAttribute("aria-live", "polite");
    }
    if (sendButton) {
      sendButton.disabled = show;
      sendButton.textContent = show ? "Working..." : "🎬 Create Drama Plan";
    }
    isProcessing = show;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function settingsSnapshot() {
    return {
      idea: userInput?.value.trim() || "",
      length: selectedLength,
      style: characterStyle?.value || "realistic",
      lang: language?.value || "tagalog",
      vision: visualVision?.value || "cinematic",
    };
  }

  function saveProject() {
    if (!project) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch (error) {
      console.warn("Project could not be saved locally.", error);
    }
  }

  function extractText(payload) {
    if (typeof payload === "string") return payload.trim();
    if (!payload || typeof payload !== "object") return "";

    const candidates = [
      payload.response,
      payload.result?.response,
      payload.output_text,
      payload.text,
      payload.content,
      payload.choices?.[0]?.message?.content,
      payload.choices?.[0]?.delta?.content,
      payload.result?.choices?.[0]?.message?.content,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim())
        return candidate.trim();
      if (Array.isArray(candidate)) {
        const combined = candidate
          .map((item) => (typeof item === "string" ? item : item?.text || ""))
          .join("");
        if (combined.trim()) return combined.trim();
      }
    }
    return "";
  }

  async function callAI(prompt) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const raw = await response.text();

    if (!response.ok) {
      let message = `AI request failed (${response.status}).`;
      try {
        const errorBody = JSON.parse(raw);
        if (errorBody?.error) message = String(errorBody.error);
      } catch (_) {}
      throw new Error(message);
    }

    // Current Worker returns JSON. Parse that first.
    try {
      const payload = JSON.parse(raw);
      const text = extractText(payload);
      if (text) return text;
      // Some compatible endpoints return a direct object with generated output.
      if (payload && typeof payload === "object") {
        throw new Error(
          "Nakatanggap ng JSON ang Studio, pero walang nakitang text response mula sa AI."
        );
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        // Fall through for older SSE/streaming responses.
      } else {
        throw error;
      }
    }

    // Compatibility fallback for an SSE response.
    let streamed = "";
    for (const line of raw.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        streamed += extractText(JSON.parse(data));
      } catch (_) {
        streamed += data;
      }
    }
    if (streamed.trim()) return streamed.trim();

    // Last fallback: return plain text only if it does not look like an error page.
    if (raw.trim() && !/^\s*</.test(raw)) return raw.trim();
    throw new Error("Walang mabasang sagot mula sa AI. Subukan ulit.");
  }

  function addButton(container, label, handler, className = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = className;
    button.style.display = "block";
    button.style.width = "100%";
    button.style.padding = "13px";
    button.style.marginTop = "10px";
    button.style.cursor = "pointer";
    button.style.touchAction = "manipulation";
    button.addEventListener("click", handler);
    container.appendChild(button);
    return button;
  }

  function addButtonRow(container) {
    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "repeat(auto-fit, minmax(180px, 1fr))";
    row.style.gap = "10px";
    row.style.marginTop = "12px";
    container.appendChild(row);
    return row;
  }

  function parseSection(text, heading, nextHeadings = []) {
    const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const stops = nextHeadings.map((h) =>
      h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );
    const lookahead = stops.length
      ? `(?=\\n\\s*(?:${stops.join("|")})\\b|$)`
      : "$";
    const regex = new RegExp(
      `(?:^|\\n)\\s*(?:#{1,4}\\s*)?(?:\\*{0,2})${escapedHeading}(?:\\*{0,2})\\s*:?\\s*([\\s\\S]*?)${lookahead}`,
      "i"
    );
    return text.match(regex)?.[1]?.trim() || "";
  }

  function renderError(message, retryHandler) {
    if (!studioPlan) return;
    studioPlan.style.display = "block";
    studioPlan.innerHTML = ` <section class="card" role="alert"> <div class="card-title">⚠️ Hindi natapos ang hakbang</div> <p>${escapeHtml(message)}</p> </section> `;
    if (retryHandler) addButton(studioPlan, "Subukan ulit", retryHandler);
    studioPlan.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderOpening(text) {
    if (!studioPlan || !project) return;

    project.openingText = text;
    project.stage = "opening-review";
    project.openingApproved = false;
    saveProject();

    const title = parseSection(text, "TITLE", [
      "COVER CONCEPT",
      "OPENING SCENE",
    ]);
    const cover = parseSection(text, "COVER CONCEPT", ["OPENING SCENE"]);
    const opening = parseSection(text, "OPENING SCENE", []);
    studioPlan.style.display = "block";
    studioPlan.innerHTML = ` <section class="card"> <div class="plan-header"> <div> <div class="card-title">🎬 OPENING SCENE</div> <div class="card-description">Hakbang 1 — suriin at aprubahan muna ang opening.</div> </div> <div class="plan-badge">WAITING FOR APPROVAL</div> </div> <div class="info-grid"> <div class="info-box"><div class="info-label">TITLE</div><div class="info-value">${escapeHtml( title || "Title included in draft" )}</div></div> <div class="info-box"><div class="info-label">LENGTH</div><div class="info-value">${escapeHtml( project.settings.length )}</div></div> </div> <div class="stage-section"> <h3>🖼️ Cover Concept</h3> <pre style="white-space:pre-wrap;font:inherit;overflow-wrap:anywhere">${escapeHtml( cover || "Tingnan ang buong opening draft sa ibaba." )}</pre> </div> <div class="stage-section"> <h3>🎥 Opening Scene Details</h3> <pre style="white-space:pre-wrap;font:inherit;overflow-wrap:anywhere">${escapeHtml( opening || text )}</pre> </div> <details style="margin-top:12px"> <summary style="cursor:pointer;font-weight:700">Tingnan / i-edit ang buong opening draft</summary> <textarea id="opening-editor" rows="12" style="width:100%;margin-top:10px;padding:12px;border:1px solid #ccc;border-radius:8px;font:inherit">${escapeHtml( text )}</textarea> <button id="save-opening-edit" type="button" style="width:100%;padding:12px;margin-top:8px">I-save ang edits</button> </details> <div class="approval-box" style="margin-top:14px"> <h3>Approval Gate 1</h3> <p>Hindi pa gagawa ng Full Drama Plan hangga't hindi mo inaaprubahan ang opening. Walang video generation sa hakbang na ito.</p> </div> </section> `;

    const editor = document.getElementById("opening-editor");
    document
      .getElementById("save-opening-edit")
      ?.addEventListener("click", () => {
        const edited = editor?.value.trim() || "";
        if (!edited) {
          window.alert("Hindi puwedeng walang laman ang opening draft.");
          return;
        }
        project.openingText = edited;
        saveProject();
        window.alert("Na-save ang edits. Basahin muli bago mag-approve.");
      });

    addButton(
      studioPlan,
      "✅ Approve Opening Scene → Create Full Drama Plan",
      () => {
        const edited = editor?.value.trim() || project.openingText || "";
        if (!edited) {
          window.alert("Kailangan munang may Opening Scene.");
          return;
        }
        project.openingText = edited;
        project.openingApproved = true;
        project.stage = "opening-approved";
        saveProject();
        generateFullDramaPlan();
      }
    );

    addButton(studioPlan, "↻ Gumawa ulit ng Opening Scene", createDramaPlan);
    studioPlan.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function createDramaPlan() {
    if (isProcessing) return;
    const s = settingsSnapshot();

    if (!s.idea) {
      window.alert("Ilagay muna ang idea ng drama.");
      userInput?.focus();
      return;
    }

    project = {
      id: `drama-${Date.now()}`,
      createdAt: new Date().toISOString(),
      settings: s,
      stage: "creating-opening",
      openingText: "",
      openingApproved: false,
      fullPlan: "",
      fullPlanApproved: false,
      productionPack: "",
    };
    saveProject();

    if (studioPlan) {
      studioPlan.style.display = "none";
      studioPlan.innerHTML = "";
    }

    showLoading(true, "AI Drama Studio is creating your opening scene...");
    const prompt = ` You are the AI Drama Studio Production Engine. Create ONLY the OPENING SCENE first. Do not create the full story yet. DRAMA IDEA: ${s.idea} VIDEO LENGTH: ${s.length} CHARACTER STYLE (mandatory): ${s.style} LANGUAGE (mandatory): ${s.lang} VISUAL VISION (mandatory): ${s.vision} ORIGINALITY RULE: Create a new, original story. Do not imitate a specific existing movie, show, creator, or copyrighted character. Return these exact sections: TITLE COVER CONCEPT OPENING SCENE The opening scene must contain: - a strong visual/emotional hook - character names and concise character descriptions - location and time - visible action - emotion - dialogue or voice-over in the selected language - camera direction - lighting and atmosphere - approximate duration - a clear question or tension that makes the viewer want to continue Do not write later scenes. Do not create the full story. Do not generate video. `;
    try {
      const result = await callAI(prompt);
      renderOpening(result);
    } catch (error) {
      renderError(
        error.message || "Hindi makuha ang Opening Scene.",
        createDramaPlan
      );
    } finally {
      showLoading(false);
    }
  }

  async function generateFullDramaPlan() {
    if (isProcessing || !project) return;
    if (!project.openingApproved || !project.openingText) {
      window.alert("Kailangan munang aprubahan ang Opening Scene.");
      return;
    }

    const s = project.settings; // Keep the same settings used for the approved opening.
    showLoading(true, "AI Drama Studio is creating the complete drama plan...");

    const prompt = ` You are the AI Drama Studio Production Engine. The user has explicitly APPROVED the opening scene below. Continue from it. Preserve its title, characters, events, tone, and hook. Do not silently replace or contradict the approved opening. ORIGINAL DRAMA IDEA: ${s.idea} LOCKED SETTINGS: - Video length: ${s.length} - Character style: ${s.style} - Language: ${s.lang} - Visual vision: ${s.vision} APPROVED OPENING SCENE — CANONICAL CONTINUITY SOURCE: ${project.openingText} Create the COMPLETE ORIGINAL DRAMA PRODUCTION PLAN, including: 1. TITLE 2. LOGLINE 3. STORY SUMMARY 4. CHARACTER LIST 5. CHARACTER DNA for every main character: age range, face/skin/features, hairstyle, body/build, clothing, voice, personality, emotional traits, relationships, and visual details that must not change 6. STORY WORLD and timeline 7. COMPLETE SCENE-BY-SCENE PLAN sized appropriately for the selected total duration 8. For every scene: duration, location/time, characters, action, emotion, dialogue/voice-over, camera framing/movement, lighting, atmosphere, transition, and continuity from the previous scene 9. DIALOGUE RULES and language consistency 10. CONTINUITY CHECK: verify no contradictions with the approved opening or Character DNA 11. ORIGINALITY REVIEW: explain what makes this story distinct; do not claim a guaranteed plagiarism scan 12. PACING REVIEW: hook, escalation, midpoint, climax, emotional payoff 13. CLIMAX, TWIST, ENDING / CLIFFHANGER 14. ITEMS THAT NEED HUMAN REVIEW Avoid filler, repeated scenes, generic recycled plots, unexplained character changes, changing clothes without a story reason, and dialogue that does not match the selected language. Do not generate an actual video. `;
    try {
      project.fullPlan = await callAI(prompt);
      project.stage = "full-plan-review";
      project.fullPlanApproved = false;
      saveProject();
      renderFullPlan();
    } catch (error) {
      renderError(
        error.message || "Hindi makuha ang Full Drama Plan.",
        generateFullDramaPlan
      );
    } finally {
      showLoading(false);
    }
  }

  function structuralChecks(text) {
    const checks = [
      {
        label: "Character DNA section",
        pattern: /character\s*dna|character\s*design/i,
      },
      {
        label: "Scene-by-scene plan",
        pattern: /scene[-\s]*(by[-\s]*)?scene|scene\s*\d+/i,
      },
      { label: "Continuity notes/check", pattern: /continuity/i },
      { label: "Ending or cliffhanger", pattern: /ending|cliffhanger|finale/i },
      { label: "Pacing review", pattern: /pacing|emotion/i },
    ];
    return checks.map((check) => ({
      label: check.label,
      passed: check.pattern.test(text),
    }));
  }

  function renderFullPlan() {
    if (!studioPlan || !project) return;
    const checks = structuralChecks(project.fullPlan);
    project.qualityChecks = checks;
    saveProject();

    studioPlan.style.display = "block";
    studioPlan.innerHTML = ` <section class="card"> <div class="plan-header"> <div> <div class="card-title">📚 COMPLETE DRAMA PLAN</div> <div class="card-description">Hakbang 2 — basahin, i-edit kung kailangan, at aprubahan.</div> </div> <div class="plan-badge">REVIEW REQUIRED</div> </div> <div class="approval-box"> <h3>🔎 Basic Structure Checks</h3> <p>Mga heading/section lamang ang awtomatikong sinusuri rito. Hindi ito garantiya na walang continuity error o kaparehong kuwento; basahin at suriin pa rin ang plano.</p> <div id="quality-checks"></div> </div> <label for="full-plan-editor" style="display:block;margin-top:16px;font-weight:800">Editable Full Drama Plan</label> <textarea id="full-plan-editor" rows="22" style="width:100%;margin-top:8px;padding:12px;border:1px solid #ccc;border-radius:8px;font:inherit;white-space:pre-wrap">${escapeHtml( project.fullPlan )}</textarea> <div class="approval-box" style="margin-top:14px"> <h3>Approval Gate 2</h3> <p>Kapag naaprubahan mo ito, saka pa lamang ihahanda ang zero-cost Video Production Pack. Hindi nito tatawagin ang video-generation API.</p> </div> </section> `;

    const checksContainer = document.getElementById("quality-checks");
    checks.forEach((check) => {
      const line = document.createElement("div");
      line.className = "check";
      line.style.display = "flex";
      line.style.justifyContent = "space-between";
      line.style.gap = "12px";
      line.style.padding = "8px 0";
      const label = document.createElement("span");
      label.textContent = check.label;
      const status = document.createElement("strong");
      status.textContent = check.passed ? "FOUND" : "MISSING";
      status.style.color = check.passed ? "#16803c" : "#a15c00";
      line.append(label, status);
      checksContainer?.appendChild(line);
    });

    addButton(
      studioPlan,
      "✏️ I-save ang Edits at Aprubahan ang Full Plan",
      () => {
        const edited =
          document.getElementById("full-plan-editor")?.value.trim() || "";
        if (!edited) {
          window.alert("Hindi puwedeng walang laman ang Full Drama Plan.");
          return;
        }
        project.fullPlan = edited;
        project.qualityChecks = structuralChecks(edited);
        project.fullPlanApproved = true;
        project.stage = "full-plan-approved";
        saveProject();
        renderProductionPreview();
      }
    );

    addButton(studioPlan, "↻ Bumalik sa Opening Scene", () =>
      renderOpening(project.openingText)
    );
    studioPlan.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderProductionPreview() {
    if (!studioPlan || !project) return;
    studioPlan.style.display = "block";
    studioPlan.innerHTML = ` <section class="card"> <div class="card-title">🧾 PRODUCTION PREVIEW</div> <div class="plan-badge">PLAN APPROVED</div> <div class="approval-box" style="margin-top:12px"> <h3>Walang video generation sa hakbang na ito</h3> <p>Ang susunod na hakbang ay maghahanda lamang ng copy-ready production prompts. Hindi nito tatawagin ang <code>/api/video</code> at hindi ito magki-claim na may MP4 nang nagawa.</p> <ul> <li>Character DNA lock</li> <li>Visual style lock</li> <li>Scene-by-scene video prompts</li> <li>Camera and motion direction</li> <li>Dialogue / voice-over</li> <li>Lighting, music and SFX notes</li> <li>Negative prompt and editing order</li> </ul> </div> </section> `;
    addButton(
      studioPlan,
      "🎬 Ihanda ang Video Production Pack (walang video credits)",
      createVideoProductionPack
    );
    addButton(studioPlan, "✏️ Balikan at I-edit ang Full Plan", renderFullPlan);
    studioPlan.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function createVideoProductionPack() {
    if (isProcessing || !project) return;
    if (!project.fullPlanApproved || !project.fullPlan) {
      window.alert("Kailangan munang aprubahan ang Full Drama Plan.");
      return;
    }

    const s = projec
  const s = settings();

  isProcessing = true;

  showLoading(
    true,
    "AI Drama Engine is preparing your video production pack..."
  );

  const prompt = `
You are the AI Drama Studio Video Production Engine.

Convert this APPROVED DRAMA PLAN
into a ready-to-generate video package.

SETTINGS:

Character Style:
${s.style}

Language:
${s.lang}

Visual Vision:
${s.vision}

Video Length:
${s.length}

APPROVED DRAMA PLAN:

${currentFullPlan}

Create:

1. GLOBAL CHARACTER LOCK

2. GLOBAL VISUAL STYLE LOCK

3. SCENE-BY-SCENE VIDEO PROMPTS

4. FOR EVERY SCENE INCLUDE:

- duration
- character appearance
- location
- action/movement
- emotion
- dialogue/voice-over
- camera shot
- camera movement
- lighting
- atmosphere
- music
- SFX
- ready-to-copy VIDEO GENERATION PROMPT

5. NEGATIVE PROMPT

6. EDITING ORDER

7. CAPTION PLAN

8. FINAL HOOK

9. FINAL ENDING

CONTINUITY RULES:

Keep character appearance consistent.

Keep clothing consistent unless
the story explicitly requires a change.

Keep locations consistent.

Keep timeline consistent.

Keep relationships consistent.

Keep visual style consistent.

Keep selected language consistent.

Keep selected visual vision consistent.

Do not claim that an MP4 was generated.

This is a ZERO-COST production package.
`;

  try {

    const pack = await callAI(prompt);

    studioPlan.innerHTML = `
      <div class="plan-card">

        <h2>🎬 VIDEO PRODUCTION PACK READY</h2>

        <div class="plan-meta">

          <span>
            🟢 Planning: ₱0
          </span>

          <span>
            🎥 ${escapeHtml(s.style)}
          </span>

          <span>
            🌐 ${escapeHtml(s.lang)}
          </span>

        </div>

        <div class="approval-box">

          <h3>
            ✅ Ready for Video Generation
          </h3>

          <p>
            Your scenes are prepared with
            character locks, motion, camera,
            dialogue, lighting, sound and
            copy-ready prompts.
          </p>

          <p>
            Actual paid MP4 generation is
            <strong>NOT</strong> started.
          </p>

        </div>

        <div class="plan-content">

          <pre
            style="
              white-space:pre-wrap;
              font-family:inherit;
            "
          >${escapeHtml(pack)}</pre>

        </div>

      </div>
    `;

    addActionButton(
      studioPlan,
      "📋 Copy Production Pack",
      async () => {

        try {

          await navigator.clipboard.writeText(pack);

          alert("Production pack copied.");

        } catch (_) {

          alert(
            "Please copy the production pack manually."
          );

        }

      }
    );

    studioPlan.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  } catch (error) {

    console.error(error);

    studioPlan.innerHTML = `
      <div class="plan-card">

        <h2>⚠️ Something went wrong</h2>

        <p>
          Please try again.
        </p>

      </div>
    `;

  } finally {

    isProcessing = false;

    showLoading(false);
  }
}

if (sendButton) {

  sendButton.addEventListener(
    "click",
    createDramaPlan
  );

}

if (userInput) {

  userInput.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {

        event.preventDefault();

        createDramaPlan();

      }

    }
  );

    }
