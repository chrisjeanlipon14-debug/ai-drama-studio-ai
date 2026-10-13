(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const idea = $("idea"),
    create = $("create"),
    status = $("status");
  let duration = 5,
    lastPlan = "",
    approved = false;
  document.querySelectorAll(".duration").forEach((btn) =>
    btn.addEventListener("click", () => {
      duration = Number(btn.dataset.min);
      document
        .querySelectorAll(".duration")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    })
  );
  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle("error", error);
  }
  function extractText(data) {
    if (typeof data === "string") return data;
    if (data && typeof data.response === "string") return data.response;
    if (data && typeof data.result === "string") return data.result;
    if (data && typeof data.output_text === "string") return data.output_text;
    if (data && Array.isArray(data.content))
      return data.content.map((x) => x.text || "").join("\n");
    if (data && data.choices?.[0]?.message?.content)
      return data.choices[0].message.content;
    return "";
  }
  async function requestPlan(prompt) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
    });
    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(
        "The server returned an unexpected response. Check the Worker deployment."
      );
    }
    if (!response.ok)
      throw new Error(data.error || `Request failed (${response.status}).`);
    const text = extractText(data);
    if (!text.trim())
      throw new Error("AI returned an empty response. Please try again.");
    return text.trim();
  }
  function buildPrompt() {
    const language = $("language").value,
      style = $("style").value;
    return `Create an original, production-ready short drama plan. Do not copy any existing work. IDEA: ${idea.value.trim()} DURATION: ${duration} minutes LANGUAGE: ${language} STYLE: ${style} Write in ${language}. Structure the response with these headings: 1. TITLE AND ONE-SENTENCE HOOK 2. CORE STORY AND MORAL/EMOTIONAL PAYOFF 3. CHARACTER DNA (appearance, age range, personality, wardrobe, relationships; keep consistent) 4. SCENE-BY-SCENE PLAN (number of scenes appropriate for the duration; each scene has duration, location, visual action, dialogue, camera direction, sound, transition) 5. CONTINUITY RULES (appearance, wardrobe, props, locations, timeline) 6. OPENING HOOK AND ENDING/CLIFFHANGER 7. QUALITY CHECK (originality, pacing, understandable dialogue, continuity) Keep the plan concrete and useful for AI video production. Do not claim that a video has been generated.`;
  }
  async function createPlan() {
    if (create.disabled) return;
    if (!idea.value.trim()) {
      setStatus("Ilagay muna ang idea ng drama bago gumawa ng plan.", true);
      idea.focus();
      return;
    }
    create.disabled = true;
    create.textContent = "⏳ Creating plan…";
    setStatus("Generating your drama plan. Please wait…");
    $("plan-panel").hidden = true;
    $("production-panel").hidden = true;
    $("approval-status").textContent = "Plan not yet approved.";
    approved = false;
    try {
      lastPlan = await requestPlan(buildPrompt());
      $("plan").textContent = lastPlan;
      $("plan-panel").hidden = false;
      setStatus("Plan generated. Review it below before approving.");
      $("plan-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      console.error("Drama plan error:", e);
      setStatus(
        "Hindi nagawa ang plan: " +
          (e.message || "Unknown error") +
          "\n\nCheck that the Cloudflare Worker has its AI binding and that the latest files are deployed.",
        true
      );
    } finally {
      create.disabled = false;
      create.textContent = "🎬 Create Drama Plan";
    }
  }
  create.addEventListener("click", createPlan);
  $("revise").addEventListener("click", createPlan);
  $("approve").addEventListener("click", () => {
    if (!lastPlan) return;
    approved = true;
    $("approval-status").textContent =
      "Plan approved. Production package is ready to prepare.";
    const prompt = `Based only on this approved drama plan, create a practical production package. Preserve character appearance, wardrobe, locations, props, story events and dialogue continuity. Include: global visual style, character reference prompts, scene-by-scene image/video prompts, exact dialogue per scene, camera/action/audio notes, negative prompt/avoid list, and a final continuity checklist. Do not say video files were generated.\n\nAPPROVED PLAN:\n${lastPlan}`;
    $("production-panel").hidden = false;
    $("production").textContent = "Preparing production package…";
    requestPlan(prompt)
      .then((text) => {
        $("production").textContent = text;
      })
      .catch((e) => {
        $("production").textContent = "Could not prepare package: " + e.message;
      });
    $("production-panel").scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied to clipboard.");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      setStatus(
        ok
          ? "Copied to clipboard."
          : "Copy failed. Select and copy the text manually.",
        !ok
      );
    }
  }
  $("copy").addEventListener("click", () => copyText(lastPlan));
  $("copy-production").addEventListener("click", () =>
    copyText($("production").textContent)
  );
})();
