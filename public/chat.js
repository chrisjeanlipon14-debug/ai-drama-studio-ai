
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const state = {
    idea: "",
    settings: null,
    opening: "",
    fullPlan: "",
    approved: false
  };

  const status = (message, error = false) => {
    $("status").textContent = message;
    $("status").classList.toggle("error", error);
  };

  const settings = () => ({
    duration: $("duration").value,
    language: $("language").value,
    visualStyle: $("visual").value,
    aspectRatio: $("aspect").value
  });

  const setBusy = (busy) => {
    ["openingBtn", "reviseBtn", "approveBtn"].forEach((id) => {
      const el = $(id);
      if (el) el.disabled = busy;
    });
  };

  async function requestAI(action) {
    const idea = $("idea").value.trim();

    if (!idea) {
      status("Ilagay muna ang story idea o blueprint.", true);
      return null;
    }

    if (idea.length > 18000) {
      status("Masyadong mahaba ang input. Hatiin sa mas maikling bahagi (maximum 18,000 characters).", true);
      return null;
    }

    if (action === "full" && !state.approved) {
      status("Kailangan munang i-approve ang Opening Scene.", true);
      return null;
    }

    setBusy(true);

    status(
      action === "opening"
        ? "Ginagawa ang Opening Scene..."
        : "Ginagawa ang complete drama plan..."
    );

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
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
        throw new Error(
          data.error || `Request failed (${response.status})`
        );
      }

      if (typeof data.text !== "string" || !data.text.trim()) {
        throw new Error(
          "Walang text response ang AI model. Subukan ulit."
        );
      }

      return data.text;

    } catch (err) {
      status(err.message || "May hindi inaasahang error.", true);
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

    state.idea = $("idea").value.trim();
    state.settings = settings();
    state.opening = text;

    $("openingOutput").textContent = text;
    $("openingCard").classList.remove("hidden");

    status(
      "Tapos na ang Opening Scene. Basahin at i-approve kung tama."
    );
  }

  $("openingBtn").addEventListener("click", makeOpening);
  $("reviseBtn").addEventListener("click", makeOpening);

  $("approveBtn").addEventListener("click", async () => {
    if (!state.opening) {
      status(
        "Wala pang Opening Scene na puwedeng i-approve.",
        true
      );
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

    status(
      "Nagawa ang full drama plan. Text screenplay at scene prompts pa lamang ito, hindi pa rendered video."
    );
  });

  $("copyBtn").addEventListener("click", async () => {
    if (!state.fullPlan) return;

    try {
      await navigator.clipboard.writeText(state.fullPlan);
      status("Nakopya ang full drama plan.");
    } catch {
      status(
        "Hindi available ang copy permission sa browser na ito.",
        true
      );
    }
  });

  $("downloadBtn").addEventListener("click", () => {
    if (!state.fullPlan) return;

    const blob = new Blob(
      [state.fullPlan],
      { type: "text/plain;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "ai-drama-screenplay.txt";

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);

    status("Na-download ang screenplay.");
  });

})();
