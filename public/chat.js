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

  function addMessage(text, who = "assistant") {
    if (!chatMessages) return;
    const wrapper = document.createElement("div");
    wrapper.className = `message ${ who === "user" ? "user-message" : "assistant-message" }`;
    const p = document.createElement("p");
    p.textContent = text;
    wrapper.appendChild(p);
    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  function setBusy(busy, message = "") {
    isProcessing = busy;
    if (sendButton) {
      sendButton.disabled = busy;
      sendButton.textContent = busy
        ? "⏳ Creating Drama Plan..."
        : "🎬 Create Drama Plan";
    }
    if (typing) {
      typing.classList.toggle("visible", busy);
      if (message) typing.textContent = message;
    }
  }
  function setStatus(text, isError = false) {
    let status = $("drama-status");
    if (!status) {
      status = document.createElement("div");
      status.id = "drama-status";
      status.className = "message assistant-message";
      status.appendChild(document.createElement("p"));
      const parent = sendButton && sendButton.parentElement;
      if (parent) parent.appendChild(status);
      else if (planPanel && planPanel.parentElement)
        planPanel.parentElement.insertBefore(status, planPanel);
    }
    status.className = `message ${ isError ? "user-message" : "assistant-message" }`;
    status.firstElementChild.textContent = text;
  }
  function extractText(data) {
    if (typeof data === "string") return data;
    if (data && typeof data.response === "string") return data.response;
    if (data && typeof data.result === "string") return data.result;
    if (data && typeof data.output_text === "string") return data.output_text;
    if (data && Array.isArray(data.content))
      return data.content.map((x) => (x && x.text) || "").join("\n");
    if (data && data.choices && data.choices[0] && data.choices[0].message)
      return data.choices[0].message.content || "";
    return "";
  }
  async function requestAI(prompt) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
    });
    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      throw new Error(
        "Hindi JSON response ang server. Tingnan ang Worker backend."
      );
    }
    if (!response.ok)
      throw new Error(data.error || `AI request failed (${response.status}).`);
    const text = extractText(data);
    if (!text.trim())
      throw new Error(
        "Walang text na ibinalik ang AI. Posibleng may problema sa AI model."
      );
    return text.trim();
  }
  function selectedValue(id, fallback) {
    const el = $(id);
    return el && el.value ? el.value : fallback;
  }
  function buildPrompt(idea) {
    return `You are Premium AI Drama Studio. Create an original drama plan, not copied from existing work. DRAMA IDEA: ${idea} VIDEO LENGTH: ${selectedDuration} LANGUAGE: ${selectedValue("language", "tagalog")} CHARACTER STYLE: ${selectedValue("character-style", "realistic")} VISUAL VISION: ${selectedValue("visual-vision", "cinematic")} Return a detailed production plan with: 1. TITLE AND OPENING HOOK 2. STORY SUMMARY AND EMOTIONAL PAYOFF 3. CHARACTERS AND CHARACTER DNA (appearance, age range, personality, clothes, relationships; keep designs consistent) 4. SCENE-BY-SCENE BREAKDOWN (duration, location, visible action, dialogue, camera direction, sound and transition) 5. CONTINUITY RULES (appearance, wardrobe, props, locations, timeline) 6. ENDING OR CLIFFHANGER 7. QUALITY CHECK (originality, pacing, story continuity and dialogue) Write in the requested language. Do not claim that a video has been generated.`;
  }
  function showPlan(plan) {
    if (!planPanel) {
      addMessage(plan);
      return;
    }
    planPanel.style.display = "block";
    planPanel.hidden = false;
    planPanel.innerHTML = `<section class="card"> <div class="plan-header"><div><div class="card-title">🎬 DRAMA PLAN</div><div class="card-description">AI-generated production blueprint</div></div><div class="plan-badge">PLAN READY</div></div> <label for="generated-plan">Review or edit your drama plan</label> <textarea id="generated-plan" style="width:100%;min-height:320px;padding:12px;border:1px solid #e5e7eb;border-radius:10px;font:14px/1.5 inherit;"></textarea> <div class="approval-buttons"><button class="secondary-btn" id="copy-plan" type="button">📋 Copy Plan</button><button class="approve-btn" id="approve-plan" type="button">✓ Approve Plan</button></div> <p id="plan-approval-status" style="margin-top:10px;color:#16803c;font-weight:700;"></p></section>`;
    const editor = $("generated-plan");
    editor.value = plan;
    $("copy-plan").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(editor.value);
        setStatus("Nakopya ang drama plan.");
      } catch (_) {
        editor.focus();
        editor.select();
        setStatus("Napili ang text. Piliin ang Copy mula sa menu ng tablet.");
      }
    });
    $("approve-plan").addEventListener("click", () => {
      lastPlan = editor.value;
      $("plan-approval-status").textContent =
        "Plan approved. Maaari mo nang gamitin ang plan para sa scene production.";
      addMessage(
        "Naaprubahan ang drama plan. Hindi pa gumagawa ng video ang website; production plan pa lamang ito."
      );
    });
    planPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function createDramaPlan() {
    if (isProcessing) return;
    const idea = input ? input.value.trim() : "";
    if (!idea) {
      setStatus(
        "Ilagay muna ang drama idea bago pindutin ang Create Drama Plan.",
        true
      );
      if (input) input.focus();
      return;
    }
    setBusy(true, "AI Drama Engine is creating your plan...");
    setStatus("Ginagawa ang drama plan. Sandali lang…");
    addMessage(`Drama idea: ${idea}\nDuration: ${selectedDuration}`, "user");
    try {
      const plan = await requestAI(buildPrompt(idea));
      lastPlan = plan;
      showPlan(plan);
      setStatus("Tapos na ang drama plan. Suriin ito sa ibaba.");
    } catch (error) {
      console.error("AI Drama Studio error:", error);
      const message =
        error && error.message ? error.message : "Hindi nagawa ang drama plan.";
      setStatus(`Hindi nagawa ang drama plan: ${message}`, true);
      addMessage(`Error: ${message}`);
    } finally {
      setBusy(false);
    }
  }
  document.querySelectorAll(".length-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document
        .querySelectorAll(".length-btn")
        .forEach((b) => b.classList.remove("selected"));
      button.classList.add("selected");
      selectedDuration = button.textContent.trim();
    });
  });
  if (sendButton) sendButton.addEventListener("click", createDramaPlan);
  else {
    console.error("AI Drama Studio: #send-button missing.");
    setStatus("Setup error: walang #send-button sa index.html.", true);
  }
  if (input)
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        createDramaPlan();
      }
    });
  console.info("AI Drama Studio chat.js loaded and connected.");
})();
