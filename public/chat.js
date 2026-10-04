const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");
const studioPlan = document.getElementById("studio-plan");

let selectedLength = "5 min";
const characterStyle = document.getElementById("character-style");
const language = document.getElementById("language");
const visualVision = document.getElementById("visual-vision");
let isProcessing = false;

const lengthButtons = document.querySelectorAll(".length-btn, .length-button, .length-option");

lengthButtons.forEach((button) => {
  button.addEventListener("click", () => {
    lengthButtons.forEach((btn) => btn.classList.remove("selected"));
    button.classList.add("selected");
    selectedLength = button.textContent.trim();
  });
});

function showLoading(show) {
  if (typingIndicator) {
    typingIndicator.style.display = show ? "block" : "none";
  }

  if (sendButton) {
    sendButton.disabled = show;
    sendButton.textContent = show ? "Creating..." : "Create Drama Plan";
  }
}

function showPlan(text) {
  if (!studioPlan) return;

  studioPlan.style.display = "block";

  studioPlan.innerHTML = `
    <div class="plan-card">
      <h2>🎬 DRAMA PLAN</h2>

      <div class="plan-meta">
        <span>⏱️ ${selectedLength}</span>
        <span>🤖 AI Production Engine</span>
      </div>

      <div class="plan-content"></div>

      <div class="approval-box">
        <h3>🔍 Review Before Generation</h3>
        <p>
          Review the drama plan first. No video will be generated
          until you approve it.
        </p>

        <button id="approve-plan" type="button">
          ✅ Approve Drama Plan
        </button>
      </div>
    </div>
  `;

  const content = studioPlan.querySelector(".plan-content");
const titleMatch = text.match(/\*{0,2}TITLE\*{0,2}\s*([\s\S]*?)(?=\*{0,2}COVER CONCEPT\*{0,2})/i);
const coverMatch = text.match(/\*{0,2}COVER CONCEPT\*{0,2}\s*([\s\S]*?)(?=\*{0,2}OPENING SCENE\*{0,2})/i);
const openingMatch = text.match(/\*{0,2}OPENING SCENE\*{0,2}\s*([\s\S]*)/i);

const title = titleMatch?.[1]?.trim() || "";
const cover = coverMatch?.[1]?.trim() || "";
const opening = openingMatch?.[1]?.trim() || "";

content.innerHTML = `
  <div class="stage-section">
    <h3>🎬 TITLE</h3>
    <div>${title}</div>
  </div>

  <div class="stage-section">
    <h3>🖼️ COVER CONCEPT</h3>
    <div>${cover}</div>
  </div>

  <div class="stage-section">
    <h3>🎥 OPENING SCENE</h3>
    <div>${opening}

  const approveButton = document.getElementById("approve-plan");

  if (approveButton) {
    approveButton.addEventListener("click", () => {
      alert(
        "Drama Plan Approved!\n\nVideo generation is not connected yet. Next step will be the Generation Cost Preview."
      );
    });
  }
}

async function createDramaPlan() {
  if (isProcessing) return;

  const idea = userInput.value.trim();

  if (!idea) {
    alert("Please enter your drama idea first.");
    return;
  }

  isProcessing = true;
  showLoading(true);

  if (studioPlan) {
    studioPlan.style.display = "none";
  }

  const productionPrompt = `
You are the AI Drama Studio Production Engine.

Create ONLY the OPENING SCENE of the drama first.

DRAMA IDEA:
${idea}

VIDEO LENGTH:
${selectedLength}
CHARACTER STYLE:
${characterStyle?.value || "realistic"}

LANGUAGE:
${language?.value || "tagalog"}

VISUAL VISION:
${visualVision?.value || "cinematic"}
STYLE ENFORCEMENT:
The selected Character Style is mandatory and must be followed throughout the entire production plan.
Do not replace, ignore, or reinterpret the selected Character Style.

The selected Language is mandatory for all dialogue, voice-over, narration, titles, and text.
Do not switch languages unless the user explicitly requests it.

The selected Visual Vision is mandatory for the overall visual direction, atmosphere, lighting, environment, camera language, and scene presentation.

Maintain the selected Character Style, Language, and Visual Vision consistently across every scene.

If the selected Character Style is Blocky / Roblox-inspired, use a clearly blocky, game-like visual universe for characters, environments, props, and scene descriptions. Do not describe realistic human characters unless explicitly requested.

If the selected Character Style is 3D Cartoon, Anime-inspired, Cute Animation, or Cinematic Stylized, maintain that exact visual direction throughout the entire drama.

Never substitute a generic cinematic style for the user's selected style.
FIRST CREATION STAGE:

Generate ONLY these three things:

1. DRAMA TITLE
Create one original, memorable title that matches the drama idea, selected language, character style, and visual vision.

2. COVER CONCEPT
Create a cinematic cover concept for the drama.
Include:
- main character(s)
- character appearance and style
- pose and emotion
- environment/background
- lighting
- atmosphere
- important visual element
- title placement
- cover composition
The cover must follow the selected Character Style and Visual Vision exactly.

3. OPENING SCENE
Create ONLY the opening scene.
Include:
- opening hook
- characters present
- location
- action
- emotion
- dialogue or voice-over
- camera direction
- lighting
- atmosphere
- approximate duration

Do NOT generate the full story yet.
Do NOT generate later scenes.
Do NOT generate the climax, twist, ending, continuity check, or full production notes yet.

The selected Character Style, Language, and Visual Vision must be followed consistently.

Do NOT generate the actual video.

Return ONLY:
TITLE
COVER CONCEPT
OPENING SCENE

Make the story unpredictable and avoid common recycled AI drama plots.
FINAL OUTPUT FORMAT:

Return ONLY these three sections:

TITLE
COVER CONCEPT
OPENING SCENE

Do not include the full drama plan.
Do not include later scenes.
`;
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: productionPrompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error("AI request failed");
    }
let fullText = "";
const rawText = await response.text();

const lines = rawText.split(/\r?\n/);

for (const line of lines) {
  if (!line.startsWith("data:")) continue;

  const data = line.slice(5).trim();

  if (!data || data === "[DONE]") continue;

  try {
    const parsed = JSON.parse(data);

    const text =
      parsed.response ||
      parsed.choices?.[0]?.delta?.content ||
      "";

    if (text) {
      fullText += text;
    }
  } catch (error) {
    // Ignore non-JSON streaming lines
  }
}
     if (!fullText.trim()) {
       throw new Error("No AI response received");
    }

    showPlan(fullText);

  } catch (error) {
    console.error(error);

    if (studioPlan) {
      studioPlan.style.display = "block";
      studioPlan.innerHTML = `
        <div class="plan-card">
          <h2>⚠️ Something went wrong</h2>
          <p>Please try creating the drama plan again.</p>
        </div>
      `;
    }
  } finally {
    isProcessing = false;
    showLoading(false);
  }
}

if (sendButton) {
  sendButton.addEventListener("click", createDramaPlan);
}

if (userInput) {
  userInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      createDramaPlan();
    }
  });
}
