(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const input = $("user-input");
  const button = $("send-button");
  const status = $("status");
  const result = $("result");
  const output = $("output");
  const copyButton = $("copy-button");
  const downloadButton = $("download-button");
  const lengthButtons = Array.from(document.querySelectorAll(".length-btn"));

  if (!input || !button || !status || !result || !output) {
    console.error("AI Drama Studio: missing required page elements.");
    return;
  }

  let selectedMinutes = 5;
  let isBusy = false;
  let lastPlan = "";

  function setStatus(text, kind = "") {
    status.textContent = text;
    status.className = "status" + (kind ? " " + kind : "");
  }

  function setBusy(busy, text) {
    isBusy = busy;
    button.disabled = busy;
    button.textContent = busy ? "⏳ Gumagawa ng plan..." : "🎬 Create Drama Plan";
    if (text) setStatus(text);
  }

  lengthButtons.forEach((item) => {
    item.addEventListener("click", () => {
      lengthButtons.forEach((other) => other.classList.remove("selected"));
      item.classList.add("selected");
      selectedMinutes = Number(item.dataset.minutes) || 5;
    });
  });

  async function createPlan() {
    if (isBusy) return;
    const idea = input.value.trim();
    if (idea.length < 8) {
      setStatus("Maglagay muna ng mas malinaw na ideya (kahit isang pangungusap).", "error");
      input.focus();
      return;
    }

    const language = $("language")?.value || "Tagalog";
    const genre = $("genre")?.value || "Horror";
    const style = $("style")?.value || "Cinematic realistic";
    const seconds = selectedMinutes * 60;

    setBusy(true, "Kumokonekta sa AI server…");
    result.style.display = "none";
    output.textContent = "";

    try {
      setStatus("Nagpapadala ng ideya sa AI server…");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);
      let response;
      try {
        response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idea, language, genre, visualStyle: style,
            durationMinutes: selectedMinutes,
            durationSeconds: seconds
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const raw = await response.text();
      let data;
      try { data = JSON.parse(raw); }
      catch { throw new Error("Hindi JSON ang sagot ng server. Baka lumang deployment ang bukas."); }

      if (!response.ok) {
        throw new Error(data.error || `Server error ${response.status}`);
      }

      const plan = typeof data.plan === "string" ? data.plan.trim() : "";
      if (!plan) throw new Error(data.error || "Walang plan text sa sagot ng AI.");

      lastPlan = plan;
      output.textContent = plan;
      result.style.display = "block";
      result.scrollIntoView({ behavior: "smooth", block: "start" });
      setStatus("Tapos na ang draft plan. Basahin at ayusin muna bago gamitin sa video.", "ok");
    } catch (error) {
      console.error("Create Drama Plan failed:", error);
      const message = error?.name === "AbortError"
        ? "Nag-timeout ang AI request matapos ang 90 segundo. Subukan ulit mamaya; hindi ito nangangahulugang may nagawang video."
        : (error?.message || "Hindi makakonekta sa AI server.");
      setStatus("Hindi nagawa ang plan: " + message, "error");
    } finally {
      setBusy(false);
    }
  }

  button.addEventListener("click", createPlan);

  input.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") createPlan();
  });

  copyButton?.addEventListener("click", async () => {
    if (!lastPlan) return;
    try {
      await navigator.clipboard.writeText(lastPlan);
      setStatus("Nakopya ang buong drama plan.", "ok");
    } catch {
      setStatus("Hindi available ang automatic copy sa browser na ito. Piliin at kopyahin ang text sa plan.", "error");
    }
  });

  downloadButton?.addEventListener("click", () => {
    if (!lastPlan) return;
    const blob = new Blob([lastPlan], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ai-drama-plan.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // Visible proof that the browser loaded this exact script.
  console.info("AI Drama Studio frontend loaded: 20261016-1");
})();
