
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const input = $("user-input");
  const button = $("send-button");
  const status = $("status");
  const result = $("result");
  const output = $("output");

  const approvalPanel = $("approval-panel");
  const openingScene = $("opening-scene");
  const approveButton = $("approve-opening");
  const reviseButton = $("revise-opening");
  const approvalStatus = $("approval-status");
  const videoPanel = $("video-panel");

  const copyButton = $("copy-button");
  const downloadButton = $("download-button");

  const lengthButtons = Array.from(
    document.querySelectorAll(".length-btn")
  );

  if (!input || !button || !status || !result || !output) {
    console.error("AI Drama Studio: missing required page elements.");
    return;
  }

  let selectedMinutes = 5;
  let isBusy = false;
  let currentSettings = null;
  let currentBlueprint = "";
  let currentOpening = "";
  let currentPlan = "";
  let approved = false;

  function setStatus(message, kind = "") {
    status.textContent = message;
    status.className = "status" + (kind ? " " + kind : "");
  }

  function setApprovalStatus(message, kind = "") {
    if (!approvalStatus) return;
    approvalStatus.textContent = message;
    approvalStatus.className = "status" + (kind ? " " + kind : "");
  }

  function setBusy(busy, message = "") {
    isBusy = busy;
    button.disabled = busy;
    button.textContent = busy
      ? (message || "⏳ Sandali...")
      : "🎬 Create Drama Plan";

    if (approveButton) approveButton.disabled = busy;
  }

  function resetDraft() {
    approved = false;
    currentSettings = null;
    currentBlueprint = "";
    currentOpening = "";
    currentPlan = "";

    if (approvalPanel) approvalPanel.style.display = "none";
    if (result) result.style.display = "none";
    if (videoPanel) videoPanel.style.display = "none";

    if (openingScene) openingScene.textContent = "";
    if (output) output.textContent = "";
  }

  async function postJSON(path, body) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 240000);

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      const raw = await response.text();
      let data;

      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(
          "Hindi mabasa ang sagot ng server. Suriin kung na-deploy ang bagong code."
        );
      }

      if (!response.ok || data.success === false) {
        throw new Error(
          data.error || `Nagkaroon ng server error (${response.status}).`
        );
      }

      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  lengthButtons.forEach((item) => {
    item.addEventListener("click", () => {
      if (isBusy) return;

      lengthButtons.forEach((other) => {
        other.classList.remove("selected");
      });

      item.classList.add("selected");
      selectedMinutes = Number(item.dataset.minutes) || 5;
    });
  });

  async function createOpening() {
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

    currentSettings = {
      idea,
      language: $("language")?.value || "Tagalog",
      genre: $("genre")?.value || "Drama",
      visualStyle: $("style")?.value || "Cinematic realistic",
      durationMinutes: selectedMinutes
    };

    resetDraft();
    setBusy(true, "⏳ Gumagawa ng Opening Scene...");
    setStatus("Unang hakbang: ginagawa ang Opening Scene.");

    try {
      const data = await postJSON("/api/opening", currentSettings);

      if (
        typeof data.blueprint !== "string" ||
        typeof data.opening !== "string" ||
        !data.blueprint.trim() ||
        !data.opening.trim()
      ) {
        throw new Error("Kulang ang sagot ng server para sa Opening Scene.");
      }

      currentBlueprint = data.blueprint;
      currentOpening = data.opening;

      if (openingScene) {
        openingScene.textContent = currentOpening;
      }

      if (approvalPanel) {
        approvalPanel.style.display = "block";
        approvalPanel.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }

      setApprovalStatus(
        "Suriin ang Opening Scene. Hindi pa ito aprubado."
      );

      setStatus(
        "Nagawa ang Opening Scene. Wala pang buong drama plan o video.",
        "ok"
      );
    } catch (error) {
      console.error("Opening Scene error:", error);

      const message = error?.name === "AbortError"
        ? "Nag-timeout ang request. Subukan ulit."
        : (error?.message || "Hindi nagawa ang Opening Scene.");

      setStatus("Hindi nagawa ang Opening Scene: " + message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function approveOpening() {
    if (isBusy) return;

    if (!currentSettings || !currentBlueprint || !currentOpening) {
      setApprovalStatus(
        "Gumawa muna ng Opening Scene bago mag-approve.",
        "error"
      );
      return;
    }

    const confirmed = window.confirm(
      "Aprubahan ang Opening Scene at ipagpatuloy ang paggawa ng buong drama plan?"
    );

    if (!confirmed) return;

    setBusy(true, "⏳ Gumagawa ng buong drama plan...");
    setApprovalStatus(
      "Naaprubahan ang Opening Scene. Ginagawa na ang natitirang mga eksena..."
    );
    setStatus(
      "Approval received. Ginagawa ang buong drama plan; hindi video."
    );

    try {
      const data = await postJSON("/api/continue", {
        ...currentSettings,
        blueprint: currentBlueprint,
        opening: currentOpening
      });

      if (typeof data.plan !== "string" || !data.plan.trim()) {
        throw new Error("Walang buong drama plan sa sagot ng server.");
      }

      currentPlan = data.plan;
      approved = true;

      output.textContent = currentPlan;
      result.style.display = "block";

      setApprovalStatus(
        "Naaprubahan ang Opening Scene at nabuo ang buong drama plan.",
        "ok"
      );

      setStatus(
        "Tapos na ang drama plan. Wala pang nagagawang video at walang tinawag na video API.",
        "ok"
      );

      result.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } catch (error) {
      console.error("Continue plan error:", error);

      const message = error?.name === "AbortError"
        ? "Nag-timeout ang paggawa ng plan. Subukan ulit."
        : (error?.message || "Hindi nakumpleto ang drama plan.");

      setApprovalStatus(message, "error");
      setStatus("Hindi nakumpleto ang drama plan: " + message, "error");
    } finally {
      setBusy(false);
    }
  }

  function reviseOpening() {
    if (isBusy) return;

    resetDraft();

    setStatus(
      "Baguhin ang ideya sa itaas at gumawa ng bagong Opening Scene."
    );

    input.focus();
    input.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  button.addEventListener("click", createOpening);
  approveButton?.addEventListener("click", approveOpening);
  reviseButton?.addEventListener("click", reviseOpening);

  input.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      createOpening();
    }
  });

  copyButton?.addEventListener("click", async () => {
    if (!approved || !currentPlan) {
      setStatus("Aprubahan muna ang Opening Scene at buuin ang buong plan.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(currentPlan);
      setStatus("Nakopya ang buong drama plan.", "ok");
    } catch {
      setStatus(
        "Hindi available ang automatic copy. Piliin at kopyahin ang text.",
        "error"
      );
    }
  });

  downloadButton?.addEventListener("click", () => {
    if (!approved || !currentPlan) {
      setStatus("Aprubahan muna ang Opening Scene at buuin ang buong plan.", "error");
      return;
    }

    const blob = new Blob([currentPlan], {
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

  console.info("AI Drama Studio approval-first frontend loaded.");
})();
