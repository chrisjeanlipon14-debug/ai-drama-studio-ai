(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const state = {
    opening: "",
    fullPlan: "",
    approved: false,
    lastIdea: "",
    lastSettings: null,
    videoBusy: false
  };

  const status = (message, error = false) => {
    const el = $("status");
    if (!el) return;

    el.textContent = message;
    el.classList.toggle("error", error);
  };

  const settings = () => ({
    mode: $("mode").value,
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

  function hideVideo() {
    const card = $("videoCard");
    const result = $("videoResult");

    if (card) card.classList.add("hidden");
    if (result) result.replaceChildren();
  }

  function invalidatePlan() {
    if (!state.opening && !state.fullPlan) return;

    state.approved = false;
    state.opening = "";
    state.fullPlan = "";

    $("openingCard")?.classList.add("hidden");
    $("fullCard")?.classList.add("hidden");

    hideVideo();

    status("Nagbago ang story o settings. Gumawa ulit ng Opening Scene.");
  }

  function currentSettingsMatch() {
    return (
      $("idea").value.trim() === state.lastIdea &&
      JSON.stringify(settings()) === JSON.stringify(state.lastSettings)
    );
  }

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

    const currentSettings = settings();

    if (action === "full" && !currentSettingsMatch()) {
      invalidatePlan();
      return null;
    }

    setBusy(true);

    status(
      action === "opening"
        ? "Creating Opening Scene..."
        : "Creating complete screenplay..."
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
          settings: currentSettings,
          approved: state.approved,
          opening: state.opening
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }

      if (typeof data.text !== "string" || !data.text.trim()) {
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
    state.opening = "";
    state.fullPlan = "";

    $("openingCard").classList.add("hidden");
    $("fullCard").classList.add("hidden");

    hideVideo();

    const text = await requestAI("opening");
    if (!text) return;

    state.opening = text;
    state.lastIdea = $("idea").value.trim();
    state.lastSettings = settings();

    $("openingOutput").textContent = text;
    $("openingCard").classList.remove("hidden");

    status("Opening Scene ready! Basahin muna bago i-approve.");
  }

  $("openingBtn").addEventListener("click", makeOpening);
  $("reviseBtn").addEventListener("click", makeOpening);

  $("approveBtn").addEventListener("click", async () => {
    if (!state.opening) {
      status("Wala pang Opening Scene.", true);
      return;
    }

    if (!currentSettingsMatch()) {
      invalidatePlan();
      return;
    }

    if ($("approveBtn").disabled) return;

    state.approved = true;

    const text = await requestAI("full");

    if (!text) {
      state.approved = false;
      return;
    }

    state.fullPlan = text;

    $("fullOutput").textContent = text;
    $("fullCard").classList.remove("hidden");

    if ($("videoCard")) {
      $("videoCard").classList.remove("hidden");
    }

    status("Complete screenplay generated! Pumili ng scene prompt para gumawa ng video.");
  });

  $("copyBtn").addEventListener("click", async () => {
    if (!state.fullPlan) return;

    try {
      await navigator.clipboard.writeText(state.fullPlan);
      status("Nakopya ang screenplay!");
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

    status("Na-download ang screenplay!");
  });

  // ACTUAL VIDEO GENERATION
  async function generateVideo() {
    if (state.videoBusy) return;

    const prompt = $("videoPrompt")?.value.trim();

    if (!prompt) {
      status("Ilagay muna ang scene video prompt.", true);
      return;
    }

    if (prompt.length > 5000) {
      status("Maximum 5,000 characters lamang.", true);
      return;
    }

    const button = $("generateVideoBtn");
    const resultBox = $("videoResult");

    if (!button || !resultBox) {
      status("Hindi pa kumpleto ang video interface. I-update muna ang index.html.", true);
      return;
    }

    const duration = Number($("videoDuration")?.value || 5);
    const resolution = $("videoResolution")?.value || "720p";
    const draft = $("videoDraft")?.checked !== false;
    const current = settings();

    state.videoBusy = true;
    button.disabled = true;

    resultBox.replaceChildren();

    const loading = document.createElement("p");
    loading.textContent = "Generating video... Maghintay muna.";
    resultBox.appendChild(loading);

    status(`Generating ${duration}-second video...`);

    try {
      const response = await fetch("/api/video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt:
            current.visualStyle +
            ". Maintain the selected visual style throughout the scene. " +
            "Aspect ratio: " + current.aspectRatio + ". " +
            prompt,
          duration,
          resolution,
          aspectRatio: current.aspectRatio,
          draft
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || `Video generation failed (${response.status}).`
        );
      }

      if (
        typeof data.videoUrl !== "string" ||
        !data.videoUrl.startsWith("https://")
      ) {
        throw new Error("Walang valid na video URL.");
      }

      resultBox.replaceChildren();

      const heading = document.createElement("h3");
      heading.textContent = "Your video is ready!";

      const video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.style.width = "100%";
      video.style.maxWidth = "700px";
      video.style.borderRadius = "12px";
      video.src = data.videoUrl;

      const download = document.createElement("a");
      download.href = data.videoUrl;
      download.target = "_blank";
      download.rel = "noopener noreferrer";
      download.textContent = "Open / Save Video";

      const details = document.createElement("p");
      details.textContent =
        `${data.duration}s | ${data.resolution} | ${data.aspectRatio} | ` +
        (data.draft ? "Draft" : "Standard");

      resultBox.append(heading, video, details, download);

      status("Successful! Na-generate ang video.");

    } catch (error) {
      resultBox.replaceChildren();

      const message = document.createElement("p");
      message.textContent = error.message || "Video generation failed.";
      resultBox.appendChild(message);

      status(error.message || "Video generation failed.", true);

    } finally {
      state.videoBusy = false;
      button.disabled = false;
    }
  }

  const videoButton = $("generateVideoBtn");

  if (videoButton) {
    videoButton.addEventListener("click", generateVideo);
  }

  // DETECT CHANGES
  [
    "idea",
    "mode",
    "genre",
    "duration",
    "language",
    "visual",
    "aspect"
  ].forEach(id => {
    const el = $(id);
    if (!el) return;

    el.addEventListener("change", () => {
      if (state.opening && !currentSettingsMatch()) {
        invalidatePlan();
      }
    });

    if (id === "idea") {
      el.addEventListener("input", () => {
        if (
          state.opening &&
          $("idea").value.trim() !== state.lastIdea
        ) {
          invalidatePlan();
        }
      });
    }
  });

})();