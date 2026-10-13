
  async function createVideoProductionPack() {
    if (isProcessing || !project) return;

    if (!project.fullPlanApproved || !project.fullPlan) {
      window.alert("Kailangan munang aprubahan ang Full Drama Plan.");
      return;
    }

    const s = project.settings;

    showLoading(
      true,
      "AI Drama Studio is preparing your production pack..."
    );

    const prompt = `
You are the AI Drama Studio Video Production Engine.

Create a complete, ready-to-copy video production package
from the approved drama plan below.

SETTINGS:
Video length: ${s.length}
Character style: ${s.style}
Language: ${s.lang}
Visual vision: ${s.vision}

APPROVED DRAMA PLAN:
${project.fullPlan}

Include:
1. Global character appearance locks.
2. Global visual style lock.
3. Scene-by-scene video prompts.
4. Duration, location, action, emotion and dialogue per scene.
5. Camera framing and movement.
6. Lighting, atmosphere, music and sound effects.
7. Copy-ready video generation prompt for each scene.
8. Negative prompts and editing order.
9. Caption plan and final hook.
10. Continuity checks for characters, clothing, locations,
timeline, language and visual style.

Create original content. Do not imitate a specific existing work.
Do not claim that a video or MP4 has been generated.
This step creates text prompts only.
`;

    try {
      const pack = await callAI(prompt);

      project.productionPack = pack;
      project.stage = "production-pack-ready";
      saveProject();

      if (!studioPlan) {
        throw new Error("Hindi makita ang Studio plan area.");
      }

      studioPlan.style.display = "block";
      studioPlan.innerHTML = `
        <section class="card">
          <div class="card-title">
            🎬 VIDEO PRODUCTION PACK READY
          </div>

          <div class="plan-badge">TEXT PACKAGE READY</div>

          <p>
            Inihanda ang production prompts mula sa
            naaprubahang Full Drama Plan.
          </p>

          <p>
            <strong>Paalaala:</strong> Text prompts pa lamang ito.
            Hindi pa nagge-generate ng aktuwal na video o MP4.
          </p>

          <label
            for="production-pack-editor"
            style="display:block;font-weight:800;margin-top:14px"
          >
            Production Pack
          </label>

          <textarea
            id="production-pack-editor"
            rows="22"
            style="width:100%;box-sizing:border-box;margin-top:8px;padding:12px;font:inherit"
          >${escapeHtml(pack)}</textarea>
        </section>
      `;

      const editor = document.getElementById("production-pack-editor");

      addButton(studioPlan, "📋 Kopyahin ang Production Pack", async () => {
        const text = editor?.value || project.productionPack || "";

        try {
          await navigator.clipboard.writeText(text);
          window.alert("Nakopya na ang Production Pack.");
        } catch (_) {
          editor?.focus();
          editor?.select();
          window.alert(
            "Hindi awtomatikong nakopya. Piliin at kopyahin ang text sa kahon."
          );
        }
      });

      addButton(
        studioPlan,
        "✏️ Bumalik sa Full Drama Plan",
        renderFullPlan
      );

      studioPlan.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

    } catch (error) {
      console.error("Production pack error:", error);

      renderError(
        error.message || "Hindi nagawa ang Production Pack.",
        createVideoProductionPack
      );
    } finally {
      showLoading(false);
    }
  }

  if (sendButton) {
    sendButton.addEventListener("click", createDramaPlan);
  }

  if (userInput) {
    userInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        createDramaPlan();
      }
    });
  }
})();
