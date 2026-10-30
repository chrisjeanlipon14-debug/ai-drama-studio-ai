
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const state = {
    opening: "",
    fullPlan: "",
    approved: false
  };

  const status = (message, error = false) => {
    $("status").textContent = message;
    $("status").classList.toggle("error", error);
  };

  const settings = () => ({
    genre: $("genre").value,
    duration: $("duration").value,
    language: $("language").value,
    visualStyle: $("visual").value,
    aspectRatio: $("aspect").value
  });

  const setBusy = (busy) => {
    ["openingBtn", "reviseBtn", "approveBtn"].forEach(id => {
      const el = $(id);
      if (el) el.disabled = busy;
    });
  };

  async function requestAI(action) {
    const idea = $("idea").value.trim();

    if (!idea) {
      status("Ilagay muna ang story idea.", true);
      return null;
    }

    if (idea.length > 18000) {
      status("Maximum 18,000 characters lamang.", true);
      return null;
    }

    if (action === "full" && !state.approved) {
      status("I-approve muna ang Opening Scene.", true);
      return null;
    }

    setBusy(true);
    status(action === "opening"
      ? "Ginagawa ang Opening Scene..."
      : "Ginagawa ang complete drama plan...");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          idea,
          settings: settings(),
          approved: state.approved,
          opening: state.opening
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }

      if (!data.text || typeof data.text !== "string") {
        throw new Error("Walang valid na AI response.");
      }

      return data.text;

    } catch (error) {
      status(error.message || "May error sa AI connection.", true);
      return null;

    } finally {
      setBusy(false);
    }
  }

  async function makeOpening() {
    state.approved = false;
    state.fullPlan = "";
    $("fullCard").classList.add("hidden");

    const text = await requestAI("opening");
    if (!text) return;

    state.opening = text;
    $("openingOutput").textContent = text;
    $("openingCard").classList.remove("hidden");

    status("Tapos na! Basahin ang Opening Scene.");
  }

  $("openingBtn").addEventListener("click", makeOpening);
  $("reviseBtn").addEventListener("click", makeOpening);

  $("approveBtn").addEventListener("click", async () => {
    if (!state.opening) {
      status("Wala pang Opening Scene.", true);
      return;
    }

    state.approved = true;
    const text = await requestAI("full");

    if (!text) {
      state.approved = false;
      return;
    }

    state.fullPlan = text;
    $("fullOutput").textContent = text;
    $("fullCard").classList.remove("hidden");

    status("Tapos na ang full drama plan. Text screenplay pa lamang ito.");
  });

  $("copyBtn").addEventListener("click", async () => {
    if (!state.fullPlan) return;

    try {
      await navigator.clipboard.writeText(state.fullPlan);
      status("Nakopya ang full drama plan.");
    } catch {
      status("Hindi available ang copy permission.", true);
    }
  });

  $("downloadBtn").addEventListener("click", () => {
    if (!state.fullPlan) return;

    const blob = new Blob(
      [state.fullPlan],
      { type: "text/plain;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "ai-drama-screenplay.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
    status("Na-download ang screenplay.");
  });
})();
