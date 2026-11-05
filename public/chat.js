
(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const state = {
    opening: "",
    fullPlan: "",
    approved: false,
    videoBusy: false
  };

  function status(message, error = false) {
    const el = $("status");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("error", error);
  }

  function settings() {
    return {
      mode: $("mode").value,
      genre: $("genre").value,
      duration: $("duration").value,
      language: $("language").value,
      visualStyle: $("visual").value,
      aspectRatio: $("aspect").value
    };
  }

  async function post(url, body) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `Request failed: ${response.status}`);
    }

    return data;
  }

  async function createOpening() {
    const idea = $("idea").value.trim();
    if (!idea) return status("Ilagay muna ang story idea.", true);

    state.opening = "";
    state.fullPlan = "";
    state.approved = false;

    $("openingCard").classList.add("hidden");
    $("fullCard").classList.add("hidden");
    $("videoCard").classList.add("hidden");

    status("Gumagawa ng Opening Scene...");

    try {
      const data = await post("/api/chat", {
        action: "opening",
        idea,
        settings: settings()
      });

      state.opening = data.text;
      $("openingOutput").textContent = data.text;
      $("openingCard").classList.remove("hidden");

      status("Opening Scene ready. Basahin at i-approve.");
    } catch (error) {
      status(error.message, true);
    }
  }

  async function createFull() {
    if (!state.opening) return status("Wala pang Opening Scene.", true);

    status("Gumagawa ng complete screenplay...");

    try {
      const data = await post("/api/chat", {
        action: "full",
        idea: $("idea").value.trim(),
        settings: settings(),
        approved: true,
        opening: state.opening
      });

      state.approved = true;
      state.fullPlan = data.text;

      $("fullOutput").textContent = data.text;
      $("fullCard").classList.remove("hidden");
      $("videoCard").classList.remove("hidden");

      status("Screenplay ready! Pumili ng scene prompt para gumawa ng video.");
    } catch (error) {
      status(error.message, true);
    }
  }

  async function generateVideo() {
    if (state.videoBusy) return;

    const prompt = $("videoPrompt").value.trim();
    if (!prompt) return status("Ilagay muna ang scene video prompt.", true);

    state.videoBusy = true;

    const button = $("generateVideoBtn");
    const result = $("videoResult");

    button.disabled = true;
    result.textContent = "Generating video... Please wait.";
    status("Kasalukuyang gumagawa ng video. Huwag isara ang page.");

    try {
      const data = await post("/api/video", {
        prompt:
          settings().visualStyle +
          ". Aspect ratio: " + settings().aspectRatio + ". " +
          prompt,
        duration: Number($("videoDuration").value),
        resolution: $("videoResolution").value,
        aspectRatio: settings().aspectRatio,
        draft: $("videoDraft").checked
      });

      result.replaceChildren();

      const heading = document.createElement("h3");
      heading.textContent = "Video generation successful!";

      const video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.src = data.videoUrl;

      const link = document.createElement("a");
      link.href = data.videoUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open / Save Video";

      result.append(heading, video, link);
      status("May nabuong video! Maaari mo na itong i-play.");

    } catch (error) {
      result.textContent = error.message;
      status(error.message, true);
    } finally {
      state.videoBusy = false;
      button.disabled = false;
    }
  }

  $("openingBtn")?.addEventListener("click", createOpening);
  $("reviseBtn")?.addEventListener("click", createOpening);
  $("approveBtn")?.addEventListener("click", createFull);
  $("generateVideoBtn")?.addEventListener("click", generateVideo);

  $("copyBtn")?.addEventListener("click", async () => {
    if (!state.fullPlan) return;
    try {
      await navigator.clipboard.writeText(state.fullPlan);
      status("Nakopya ang screenplay!");
    } catch {
      status("Hindi available ang copy permission.", true);
    }
  });

  $("downloadBtn")?.addEventListener("click", () => {
    if (!state.fullPlan) return;

    const blob = new Blob([state.fullPlan], {
      type: "text/plain;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ai-drama-screenplay.txt";
    link.click();
    URL.revokeObjectURL(url);

    status("Na-download ang screenplay!");
  });
})();
