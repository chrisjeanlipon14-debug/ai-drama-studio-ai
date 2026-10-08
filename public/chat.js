const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");
const studioPlan = document.getElementById("studio-plan");

let selectedLength = "5 min";
let isProcessing = false;
let currentFullPlan = "";

const characterStyle = document.getElementById("character-style");
const language = document.getElementById("language");
const visualVision = document.getElementById("visual-vision");

const lengthButtons = document.querySelectorAll(
  ".length-btn, .length-button, .length-option"
);

lengthButtons.forEach((button) => {
  button.addEventListener("click", () => {
    lengthButtons.forEach((btn) => btn.classList.remove("selected"));
    button.classList.add("selected");
    selectedLength = button.textContent.trim();
  });
});

function showLoading(show, message = "AI Drama Engine is creating your plan...") {
  if (typingIndicator) {
    typingIndicator.style.display = show ? "block" : "none";
    if (show) typingIndicator.textContent = message;
  }

  if (sendButton) {
    sendButton.disabled = show;
    sendButton.textContent = show ? "Creating..." : "Create Drama Plan";
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function addActionButton(container, label, handler) {
  const button = document.createElement("button");

  button.type = "button";
  button.textContent = label;
  button.style.display = "block";
  button.style.width = "100%";
  button.style.padding = "14px";
  button.style.marginTop = "14px";
  button.style.cursor = "pointer";
  button.style.touchAction = "manipulation";
  button.style.position = "relative";
  button.style.zIndex = "9999";
  button.style.pointerEvents = "auto";

  button.addEventListener("click", handler);

  container.appendChild(button);

  return button;
}

async function callAI(prompt) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error("AI request failed");
  }

  const raw = await response.text();
  let result = "";

  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;

    const data = line.slice(5).trim();

    if (!data || data === "[DONE]") continue;

    try {
      const parsed = JSON.parse(data);

      const chunk =
        parsed.response ||
        parsed.choices?.[0]?.delta?.content ||
        "";

      if (chunk) {
        result += chunk;
      }
    } catch (_) {}
  }

  if (!result.trim()) {
    throw new Error("No AI response received");
  }

  return result.trim();
}

function settings() {
  return {
    idea: userInput?.value.trim() || "",
    length: selectedLength,
    style: characterStyle?.value || "realistic",
    lang: language?.value || "tagalog",
    vision: visualVision?.value || "cinematic"
  };
}

function renderOpening(text) {
  if (!studioPlan) return;

  const title =
    text.match(
      /\*{0,2}TITLE\*{0,2}\s*([\s\S]*?)(?=\*{0,2}COVER CONCEPT\*{0,2})/i
    )?.[1]?.trim() || "";

  const cover =
    text.match(
      /\*{0,2}COVER CONCEPT\*{0,2}\s*([\s\S]*?)(?=\*{0,2}OPENING SCENE\*{0,2})/i
    )?.[1]?.trim() || "";

  const opening =
    text.match(
      /\*{0,2}OPENING SCENE\*{0,2}\s*([\s\S]*)/i
    )?.[1]?.trim() || "";

  studioPlan.style.display = "block";

  studioPlan.innerHTML = `
    <div class="plan-card">

      <h2>🎬 OPENING SCENE</h2>

      <div class="plan-meta">
        <span>⏱️ ${escapeHtml(selectedLength)}</span>
        <span>🤖 AI Production Engine</span>
      </div>

      <div class="plan-content">

        <div class="stage-section">
          <h3>🎬 TITLE</h3>
          <div>${escapeHtml(title)}</div>
        </div>

        <div class="stage-section">
          <h3>🖼️ COVER CONCEPT</h3>
          <div>${escapeHtml(cover)}</div>
        </div>

        <div class="stage-section">
          <h3>🎥 OPENING SCENE</h3>
          <div>${escapeHtml(opening)}</div>
        </div>

      </div>

    </div>
  `;

  addActionButton(
    studioPlan,
    "✅ Approve Opening Scene",
    () => {
      isProcessing = false;
      generateFullDramaPlan();
    }
  );
}

async function createDramaPlan() {
  if (isProcessing) return;

  const s = settings();

  if (!s.idea) {
    alert("Please enter your drama idea first.");
    return;
  }

  isProcessing = true;

  showLoading(
    true,
    "AI Drama Engine is creating your opening scene..."
  );

  if (studioPlan) {
    studioPlan.style.display = "none";
  }

  const prompt = `
You are the AI Drama Studio Production Engine.

Create ONLY the OPENING SCENE first.

DRAMA IDEA:
${s.idea}

VIDEO LENGTH:
${s.length}

CHARACTER STYLE:
${s.style}

LANGUAGE:
${s.lang}

VISUAL VISION:
${s.vision}

STYLE RULES:

The selected Character Style, Language and Visual Vision are mandatory.

If Blocky / Roblox-inspired is selected,
use a clearly blocky game-like universe.

Keep the style consistent.

Do not copy existing movies, dramas,
viral stories, characters or scenes.

The story must be original.

Return ONLY:

TITLE

COVER CONCEPT

OPENING SCENE

Opening scene must include:

- strong hook
- characters
- location
- action
- emotion
- dialogue or voice-over
- camera direction
- lighting
- atmosphere
- approximate duration

Do not create later scenes.

Do not create the full story.

Do not generate an actual video.
`;

  try {
    const result = await callAI(prompt);

    renderOpening(result);

  } catch (error) {

    console.error(error);

    if (studioPlan) {
      studioPlan.style.display = "block";

      studioPlan.innerHTML = `
        <div class="plan-card">
          <h2>⚠️ Something went wrong</h2>
          <p>Please try again.</p>
        </div>
      `;
    }

  } finally {

    isProcessing = false;

    showLoading(false);
  }
}

async function generateFullDramaPlan() {
  if (isProcessing) return;

  const s = settings();

  if (!s.idea) return;

  isProcessing = true;

  showLoading(
    true,
    "AI Drama Engine is creating the complete drama plan..."
  );

  const prompt = `
You are the AI Drama Studio Production Engine.

The opening scene has already been reviewed and APPROVED.

Create the COMPLETE ORIGINAL DRAMA PRODUCTION PLAN.

DRAMA IDEA:
${s.idea}

VIDEO LENGTH:
${s.length}

CHARACTER STYLE:
${s.style}

LANGUAGE:
${s.lang}

VISUAL VISION:
${s.vision}

Create:

TITLE

CHARACTER DNA

STORY WORLD

COMPLETE SCENE PLAN

CONTINUITY CHECK

ORIGINALITY CHECK

EMOTION & PACING CHECK

CLIMAX

TWIST

ENDING

CHARACTER DNA:

For every main character define:

- appearance
- hairstyle
- clothing
- personality
- emotional traits
- relationships

Lock these details across all scenes.

SCENE PLAN:

For every scene include:

- scene number
- duration
- location
- characters
- action
- emotion
- dialogue or voice-over
- camera direction
- lighting
- atmosphere

Avoid:

- filler
- repetition
- recycled AI plots
- predictable twists
- unnecessary scenes

Maintain the selected Character Style
throughout the entire drama.

Maintain the selected Language
throughout the entire drama.

Maintain the selected Visual Vision
throughout the entire drama.

Do NOT generate an actual video.
`;

  try {

    currentFullPlan = await callAI(prompt);

    studioPlan.style.display = "block";

    studioPlan.innerHTML = `
      <div class="plan-card">

        <h2>🎬 COMPLETE DRAMA PLAN</h2>

        <div class="plan-meta">
          <span>⏱️ ${escapeHtml(s.length)}</span>
          <span>🤖 AI Production Engine</span>
        </div>

        <div class="plan-content"></div>

        <div class="approval-box">

          <h3>🔍 Review Before Generation</h3>

          <p>
            Review the complete drama plan first.
            No video is generated yet.
          </p>

        </div>

      </div>
    `;

    const content =
      studioPlan.querySelector(".plan-content");

    content.innerHTML = `
      <pre
        style="
          white-space:pre-wrap;
          font-family:inherit;
        "
      >${escapeHtml(currentFullPlan)}</pre>
    `;

    addActionButton(
      studioPlan,
      "✅ Approve Full Drama Plan",
      () => {
        showGenerationPreview();
      }
    );

    studioPlan.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  } catch (error) {

    console.error(error);

    studioPlan.style.display = "block";

    studioPlan.innerHTML = `
      <div class="plan-card">
        <h2>⚠️ Something went wrong</h2>
        <p>Please try again.</p>
      </div>
    `;

  } finally {

    isProcessing = false;

    showLoading(false);
  }
}

function showGenerationPreview() {

  if (!studioPlan) return;

  studioPlan.innerHTML = `
    <div class="plan-card">

      <h2>💰 GENERATION PREVIEW</h2>

      <div class="plan-meta">

        <span>🟢 AI Planning: ₱0</span>

        <span>
          🎬 Paid video API: NOT USED
        </span>

      </div>

      <div class="approval-box">

        <h3>🎬 Zero-Cost Video Workflow</h3>

        <p>
          The Studio will prepare a complete
          video-production package including:
        </p>

        <ul>
          <li>Locked characters</li>
          <li>Scene prompts</li>
          <li>Motion</li>
          <li>Camera</li>
          <li>Dialogue</li>
          <li>Voice-over</li>
          <li>Lighting</li>
          <li>Music</li>
          <li>SFX</li>
        </ul>

        <p>
          <strong>
            No paid video generation will start here.
          </strong>
        </p>

      </div>

    </div>
  `;

  addActionButton(
    studioPlan,
    "🎬 Create Video Production Pack",
    createVideoProductionPack
  );
}

async function createVideoProductionPack() {

  if (isProcessing) return;

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
async function generateVideoTest(prompt) {
  try {
    const response = await fetch("/api/video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt,
        duration: 5,
        resolution: "720p",
        aspect_ratio: "16:9",
        draft: true
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Video generation failed.");
    }

    const video =
      data.result?.video ||
      data.result?.video_url ||
      data.result?.url;

    if (!video) {
      throw new Error("Video was generated, but no video URL was returned.");
    }

    const resultBox = document.createElement("div");

    resultBox.className = "video-result";

    resultBox.innerHTML = `
      <div style="
        margin-top:20px;
        padding:18px;
        border-radius:16px;
        background:#171717;
        border:1px solid #333;
      ">
        <h3>🎬 VIDEO TEST READY</h3>
        <p>5-second • 720p Draft</p>

        <video
          controls
          playsinline
          style="
            width:100%;
            max-width:720px;
            border-radius:12px;
            margin-top:12px;
          "
          src="${video}">
        </video>

        <p style="margin-top:12px;">
          ✅ Actual AI video generated.
        </p>
      </div>
    `;

    document.body.appendChild(resultBox);

    resultBox.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

  } catch (error) {
    alert(
      "Video generation error:\n\n" +
      (error?.message || error)
    );
  }
}
(() => {
  const button = document.createElement("button");

  button.textContent = "🎬 Generate 5-Second Test Video";

  button.style.cssText = `
    display:block;
    width:100%;
    max-width:520px;
    margin:24px auto;
    padding:16px 20px;
    border:none;
    border-radius:14px;
    background:#8b5cf6;
    color:white;
    font-size:16px;
    font-weight:700;
    cursor:pointer;
  `;

  button.addEventListener("click", async () => {
    const confirmed = confirm(
      "🎬 5-Second AI Video Test\n\n" +
      "720p Draft • 16:9\n" +
      "This test may use AI video credits.\n\n" +
      "Generate now?"
    );

    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "⏳ Generating 5-second video...";

    await generateVideoTest(
      "Cinematic emotional AI drama opening scene. " +
      "A worried mother stands alone inside a dimly lit home at night. " +
      "She suddenly receives a mysterious video message from her missing daughter. " +
      "Her expression changes from confusion to shock. " +
      "Realistic cinematic acting, dramatic lighting, subtle camera movement, " +
      "emotional atmosphere, suspenseful mystery."
    );

    button.disabled = false;
    button.textContent = "🎬 Generate 5-Second Test Video";
  });

  const target =
    document.querySelector("#studio-plan") ||
    document.querySelector(".plan-content") ||
    document.body;

  target.appendChild(button);
})();
