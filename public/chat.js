
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

  const approvalPanel = $("approval-panel");
  const openingScene = $("opening-scene");
  const approveButton = $("approve-opening");
  const reviseButton = $("revise-opening");
  const approvalStatus = $("approval-status");
  const videoPanel = $("video-panel");

  if (!input || !button || !status || !result || !output) {
    console.error("AI Drama Studio: missing required page elements.");
    return;
  }

  let selectedMinutes = 5;
  let isBusy = false;
  let lastPlan = "";
  let approved = false;

  function setStatus(message, kind = "") {
    status.textContent = message;
    status.className = "status" + (kind ? " " + kind : "");
  }

  function setBusy(busy) {
    isBusy = busy;
    button.disabled = busy;
    button.textContent = busy
      ? "⏳ Gumagawa ng plan..."
      : "🎬 Create Drama Plan";
  }

  function findOpeningScene(plan) {
    const match = plan.match(
      /^[ \t]*(?:#{1,6}[ \t]*)?(?:SCENE|EKSENA)[ \t]*#?[ \t]*1\b[\s\S]*?(?=^[ \t]*(?:#{1,6}[ \t]*)?(?:SCENE|EKSENA)[ \t]*#?[ \t]*2\b|$)/im
    );
    return match ? match[0].trim() : "";
  }

  lengthButtons.forEach((item) => {
    item.addEventListener("click", () => {
      lengthButtons.forEach((other) =>
        other.classList.remove("selected")
      );
      item.classList.add("selected");
      selectedMinutes = Number(item.dataset.minutes) || 5;
    });
  });

  async function createPlan() {
    if (isBusy) return;

    const idea = input.value.trim();

    if (idea.length < 8) {
      setStatus(
        "Maglagay muna ng mas malinaw na ideya ng kuwento.",
        "error"
      );
      input.focus();
      return;
    }

    const language = $("language")?.value || "Tagalog";
    const genre = $("genre")?.value || "Drama";
    const style = $("style")?.value || "Cinematic realistic";

    approved = false;
    lastPlan = "";
    result.style.display = "none";
    approvalPanel && (approvalPanel.style.display = "none");
    videoPanel && (videoPanel.style.display = "none");
    output.textContent = "";
    setBusy(true);
    setStatus("Kumokonekta sa AI server...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 240000);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          language,
          genre,
          visualStyle: style,
          durationMinutes: selectedMinutes,
          durationSeconds: selectedMinutes * 60
        }),
        signal: controller.signal
      });

      const raw = await response.text();
      let data;

      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error("Hindi mabasa ang sagot ng server. Suriin ang deployment.");
      }

      if (!response.ok) {
        throw new Error(data.error || `Server error ${response.status}`);
      }

      const plan = typeof data.plan === "string"
        ? data.plan.trim()
        : "";

      if (!plan) {
        throw new Error(data.error || "Walang drama plan sa sagot ng server.");
      }

      const opening = findOpeningScene(plan);

      if (!opening) {
        throw new Error(
          "Hindi mahanap ang Scene 1 sa plan. Subukan ulit."
        );
      }

      lastPlan = plan;

      if (openingScene) openingScene.textContent = opening;
      if (approvalPanel) {
        approvalPanel.style.display = "block";
        approvalPanel.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }

      if (approvalStatus) {
        approvalStatus.textContent =
          "Suriin ang opening scene. Hindi pa ito aprubado.";
        approvalStatus.className = "status";
      }

      setStatus(
        "Nagawa ang draft. Suriin muna ang Opening Scene.",
        "ok"
      );
    } catch (error) {
      console.error("AI Drama Studio:", error);

      const message = error?.name === "AbortError"
        ? "Nag-timeout ang request. Subukan ulit mamaya."
        : (error?.message || "Hindi makakonekta sa AI server.");

      setStatus("Hindi nagawa ang plan: " + message, "error");
    } finally {
      clearTimeout(timeoutId);
      setBusy(false);
    }
  }

  button.addEventListener("click", createPlan);

  input.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      createPlan();
    }
  });

  approveButton?.addEventListener("click", () => {
    if (!lastPlan) {
      approvalStatus.textContent = "Walang plan na maaaring aprubahan.";
      approvalStatus.className = "status error";
      return;
    }

    approved = true;
    output.textContent = lastPlan;
    result.style.display = "block";

    if (approvalStatus) {
      approvalStatus.textContent =
        "Opening Scene naaprubahan. Nasa ibaba ang buong draft plan.";
      approvalStatus.className = "status ok";
    }

    if (videoPanel) videoPanel.style.display = "block";

    setStatus(
      "Naaprubahan ang opening scene. Ang buong plan ay draft pa rin; wala pang nagawang video.",
      "ok"
    );

    result.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  reviseButton?.addEventListener("click", () => {
    approved = false;

    if (approvalStatus) {
      approvalStatus.textContent =
        "Baguhin ang ideya sa itaas at gumawa ng bagong draft. Hindi pa awtomatikong nae-edit ang scene.";
      approvalStatus.className = "status";
    }

    input.focus();
    input.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  copyButton?.addEventListener("click", async () => {
    if (!lastPlan || !approved) {
      setStatus("Aprubahan muna ang opening scene.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(lastPlan);
      setStatus("Nakopya ang buong drama plan.", "ok");
    } catch {
      setStatus(
        "Hindi available ang automatic copy. Piliin at kopyahin ang text.",
        "error"
      );
    }
  });

  downloadButton?.addEventListener("click", () => {
    if (!lastPlan || !approved) {
      setStatus("Aprubahan muna ang opening scene.", "error");
      return;
    }

    const blob = new Blob([lastPlan], {
      type: "text/plain;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "ai-drama-plan.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  });

  console.info("AI Drama Studio frontend loaded: 20261021-2");
})();
