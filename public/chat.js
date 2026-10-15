
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
  let approvedPlan = "";
  let runtime = "1 minute";
  let language = "Tagalog";

  function addMessage(role, text) {
    const el = document.createElement("div");
    el.className = `message ${role}-message`;
    el.textContent = text;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
  }

  function setBusy(value) {
    busy = value;
    sendButton.disabled = value;
    sendButton.textContent = value
      ? "Creating Plan..."
      : "🎬 Create Drama Plan";

    if (indicator) {
      indicator.style.display = value ? "block" : "none";
    }
  }

  function getRuntime() {
    const selected = document.querySelector(
      ".length-btn.active, .length-btn.selected, .length-btn[aria-pressed='true']"
    );

    if (!selected) return runtime;

    return selected.dataset.length
      || selected.dataset.duration
      || selected.textContent.trim()
      || runtime;
  }

  function getValue(selector, fallback) {
    const el = $(selector);
    if (!el) return fallback;

    return el.selectedOptions?.[0]?.textContent?.trim()
      || el.value
      || fallback;
  }

  function runtimeSeconds(value) {
    const s = String(value).toLowerCase();
    const n = Number.parseFloat(s) || 1;

    if (/sec|second/.test(s)) return Math.round(n);
    if (/hour|hr/.test(s)) return Math.round(n * 3600);

    return Math.round(n * 60);
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
        `Server error ${response.status}: ${raw.slice(0, 200)}`
      );
    }

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("Hindi valid JSON ang sagot ng server.");
    }

    const result =
      data?.response ??
      data?.result?.response ??
      data?.output ??
      data?.content ??
      data?.message?.content ??
      data?.choices?.[0]?.message?.content;

    if (typeof result === "string" && result.trim()) {
      return result.trim();
    }

    if (Array.isArray(result)) {
      const text = result
        .map((item) => item?.text || "")
        .join("\n")
        .trim();

      if (text) return text;
    }

    throw new Error("Walang mabasang text sa AI response.");
  }

  function displayPlan(text) {
    approvedPlan = text;

    const container = planBox || chat;
    container.style.display = "block";
    container.replaceChildren();

    const title = document.createElement("h3");
    title.textContent = "Your Drama Plan";

    const content = document.createElement("pre");
    content.style.whiteSpace = "pre-wrap";
    content.style.overflowWrap = "anywhere";
    content.textContent = text;

    const approve = document.createElement("button");
    approve.type = "button";
    approve.textContent = "Approve Plan & Build Production Pack";

    approve.addEventListener("click", buildPack);

    container.append(title, content, approve);
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
    language = getValue("#language", "Tagalog");

    const seconds = runtimeSeconds(runtime);

    setBusy(true);
    addMessage("user", `${idea}\nRuntime: ${runtime}`);

    try {
      const plan = await askAI(`
You are AI Drama Studio, an original drama production planner.

USER'S DRAMA IDEA:
${idea}

SETTINGS:
Runtime: ${runtime}
Required total duration: exactly ${seconds} seconds.
Language: ${language}
Character style: ${getValue("#character-style", "Realistic Human")}
Visual direction: ${getValue("#visual-vision", "Cinematic")}

Create a complete, original drama plan.

Include:
1. Title, genre, and hook.
2. Complete story from beginning to ending.
3. Character DNA: appearance, age, clothing, personality.
4. Locations, props, and continuity rules.
5. Numbered scenes with start, end, and duration.
6. Dialogue and important actions.
7. Climax and ending.

The scene durations must total exactly ${seconds} seconds.
Use the selected language. Do not copy existing stories.
Do not stop after the opening scene.

Finish with: PLAN READY FOR REVIEW
`);

      if (!plan || plan.length < 100) {
        throw new Error("Masyadong maikli ang AI plan. Subukan ulit.");
      }

      displayPlan(plan);
      addMessage("assistant", "Nagawa ang plan. Suriin bago i-approve.");
    } catch (error) {
      console.error("Create Plan failed:", error);
      addMessage(
        "assistant",
        `Hindi nagawa ang plan: ${error.message}`
      );
    } finally {
      setBusy(false);
    }
  }

  async function buildPack() {
    if (busy || !approvedPlan) return;

    setBusy(true);

    const container = planBox || chat;
    container.replaceChildren();

    const title = document.createElement("h3");
    title.textContent = "Building Complete Production Pack...";

    const output = document.createElement("pre");
    output.style.whiteSpace = "pre-wrap";
    output.textContent = "Generating Story Bible, scenes, dialogue, and continuity...";

    container.append(title, output);

    try {
      const pack = await askAI(`
You are the AI Drama Studio production engine.

APPROVED PLAN — KEEP THIS STORY:
${approvedPlan}

Create a complete production pack in ${language}.

Include:
1. Complete story bible.
2. Character DNA and locked appearances.
3. Every scene in sequential order.
4. Each scene's duration, action, location, and visual prompt.
5. Dialogue, expressions, camera, lighting, and sound.
6. Character, wardrobe, prop, and location continuity.
7. Editing timeline and negative prompts.
8. Final completeness and continuity audit.

The total runtime must remain ${runtime}.
Do not omit the ending or stop after the first scenes.
Keep characters consistent across all scenes.
Do not claim a check passed if it was not performed.
Write complete, usable production instructions.
`);

      if (!pack || pack.length < 200) {
        throw new Error("Kulang ang Production Pack.");
      }

      title.textContent = "Production Pack";
      output.textContent = pack;

      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "Copy Production Pack";

      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(pack);
          copy.textContent = "Copied!";
        } catch {
          addMessage(
            "assistant",
            "Hindi makopya automatic. Piliin at kopyahin ang Production Pack."
          );
        }
      });

      container.appendChild(copy);
      addMessage("assistant", "Nagawa ang Production Pack. Suriin muna bago gamitin.");
    } catch (error) {
      console.error("Production Pack failed:", error);
      title.textContent = "Production Pack — Error";
      output.textContent = error.message;
      addMessage("assistant", `Production Pack error: ${error.message}`);
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
    button.addEventListener("click", () => {
      document.querySelectorAll(".length-btn").forEach((item) => {
        item.classList.remove("active");
        item.classList.remove("selected");
        item.setAttribute("aria-pressed", "false");
      });

      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");

      runtime =
        button.dataset.length ||
        button.dataset.duration ||
        button.textContent.trim();
    });
  });

  console.log("AI Drama Studio: chat.js loaded successfully.");
})();

