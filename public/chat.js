
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const input = $("#user-input");
  const sendButton = $("#send-button");
  const chat = $("#chat-messages");
  const indicator = $("#typing-indicator");
  const planBox = $("#studio-plan");

  if (!input || !sendButton || !chat) {
    console.error("AI Drama Studio: Missing required HTML elements.");
    return;
  }

  let runtime = "1 minute";
  let language = "Tagalog";
  let approvedPlan = "";
  let packParts = [];
  let busy = false;

  function message(role, text) {
    const el = document.createElement("div");
    el.className = `message ${role}-message`;
    el.textContent = text;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
    return el;
  }

  function setBusy(value) {
    busy = value;
    sendButton.disabled = value;
    sendButton.textContent = value ? "Please wait..." : "Send";
    if (indicator) indicator.style.display = value ? "block" : "none";
  }

  function secondsFromRuntime(value) {
    const s = String(value).toLowerCase();
    const sec = s.match(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?)/);
    const hour = s.match(/(\d+(?:\.\d+)?)\s*hours?/);
    const min = s.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)/);
    if (sec) return Math.round(Number(sec[1]));
    if (hour) return Math.round(Number(hour[1]) * 3600);
    if (min) return Math.round(Number(min[1]) * 60);
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? Math.round(n * 60) : 60;
  }

  function getLanguage() {
    const el = $("#language");
    return el?.selectedOptions?.[0]?.textContent?.trim()
      || el?.value || "Tagalog";
  }

  function getSelectedRuntime() {
    const active = document.querySelector(".length-btn.active");
    return active?.dataset?.length
      || active?.textContent?.trim()
      || runtime;
  }

  function getSetting(selector, fallback) {
    const el = $(selector);
    return el?.selectedOptions?.[0]?.textContent?.trim()
      || el?.value || fallback;
  }

  async function askAI(prompt) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }]
      })
    });

    const raw = await response.text();

    if (!response.ok) {
      throw new Error(`AI request failed (${response.status}): ${raw.slice(0, 250)}`);
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("The server returned invalid JSON.");
    }

    const candidates = [
      data?.response,
      data?.result?.response,
      data?.output,
      data?.content,
      data?.message?.content,
      data?.result?.content,
      data?.choices?.[0]?.message?.content
    ];

    for (const item of candidates) {
      if (typeof item === "string" && item.trim()) return item.trim();
    }

    if (Array.isArray(data?.content)) {
      const result = data.content
        .map((item) => item?.text || "")
        .filter(Boolean).join("\n");
      if (result) return result.trim();
    }

    throw new Error("Hindi mabasa ang text sa AI response.");
  }

  function showPlan(text) {
    approvedPlan = text;

    const container = planBox || chat;
    container.style.display = "block";
    container.textContent = "";

    const heading = document.createElement("h3");
    heading.textContent = "Drama Plan — For Review";

    const pre = document.createElement("pre");
    pre.style.whiteSpace = "pre-wrap";
    pre.textContent = text;

    const approve = document.createElement("button");
    approve.type = "button";
    approve.textContent = "Approve Plan & Build Complete Production Pack";
    approve.addEventListener("click", buildPack);

    container.append(heading, pre, approve);
    container.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  async function createPlan() {
    if (busy) return;

    const idea = input.value.trim();
    if (!idea) {
      message("assistant", "Ilagay muna ang drama idea.");
      return;
    }

    runtime = getSelectedRuntime();
    language = getLanguage();

    setBusy(true);
    message("user", `${idea}\nRuntime: ${runtime}\nLanguage: ${language}`);

    try {
      const seconds = secondsFromRuntime(runtime);

      const result = await askAI(`
You are the original story planner for AI Drama Studio.

USER'S DRAMA IDEA:
${idea}

LOCKED SETTINGS:
Runtime: ${runtime}
Exact duration: ${seconds} seconds
Language: ${language}
Visual style: ${getSetting("#character-style", "Cinematic realistic")}
Visual direction: ${getSetting("#visual-vision", "Emotional cinematic")}

Create an original, practical drama plan.

Include:
1. Title and genre.
2. Story summary with beginning, conflict, climax, and ending.
3. Character names, ages, appearance, wardrobe, and relationships.
4. Locations, timeline, and important props.
5. A numbered scene outline with timestamps and durations adding up
   to exactly ${seconds} seconds.
6. Dialogue or voice-over direction.
7. Ending and continuity locks.

IMPORTANT:
- Never change the requested runtime.
- A 1-minute story must total exactly 60 seconds.
- Keep the story simple enough for the requested duration.
- Do not invent contradictions between scenes.
- Do not copy an existing story.
- Use ${language} for story dialogue and on-screen text.

End with: PLAN READY FOR REVIEW
`);

      if (result.length < 150) {
        throw new Error("Masyadong maikli ang plan. Subukan ulit.");
      }

      showPlan(result);
      message("assistant", "Suriin ang plan at i-approve bago buuin ang Production Pack.");
    } catch (error) {
      message("assistant", `Hindi nagawa ang plan: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  function showProgress(status) {
    const container = planBox || chat;
    container.style.display = "block";
    container.textContent = "";

    const heading = document.createElement("h3");
    heading.textContent = status;

    const pre = document.createElement("pre");
    pre.style.whiteSpace = "pre-wrap";
    pre.textContent = packParts.join("\n\n");

    container.append(heading, pre);
  }

  function addPart(title, text) {
    packParts.push(`${title}\n\n${text.trim()}`);
    showProgress(`PRODUCTION PACK — ${packParts.length} SECTION(S) COMPLETE`);
  }

  async function buildPack() {
    if (busy) return;

    if (!approvedPlan) {
      message("assistant", "Gumawa muna ng drama plan.");
      return;
    }

    if (!window.confirm(
      `Buuin ang Production Pack? Runtime: ${runtime}. Gagamitin ang approved plan.`
    )) return;

    setBusy(true);
    packParts = [];
    showProgress("PRODUCTION PACK — IN PROGRESS");

    const seconds = secondsFromRuntime(runtime);
    const base = `
APPROVED PLAN — SOURCE OF TRUTH:
${approvedPlan}

LOCKED SETTINGS:
Runtime: ${runtime}
Exact duration: ${seconds} seconds
Language: ${language}

NON-NEGOTIABLE:
- Do not change the approved title, runtime, ending, character ages,
  relationships, locations, timeline, or established events.
- Keep every scene consistent with the approved plan.
- Never require a longer runtime.
- Return only the requested section.
- Finish every sentence and bullet.
`;

    try {
      // PART 1: Character and story bible
      showProgress("GENERATING PART 1 — STORY BIBLE");

      const bible = await askAI(`${base}
TASK: STORY BIBLE AND CHARACTER DNA

Create:
- Title, genre, logline, and story summary.
- Beginning, conflict, climax, and ending.
- Full profile for every important character: age, face, hair, skin,
  body type, voice, personality, wardrobe, accessories, recurring props.
- Location, timeline, relationships, and continuity locks.

Complete every character profile. Do not stop mid-sentence.
`);
      if (bible.length < 250) throw new Error("Kulang ang Story Bible.");
      addPart("PART 1 — STORY BIBLE AND CHARACTER DNA", bible);

      // PART 2A: Scene outline only
      showProgress("GENERATING SCENE OUTLINE");

      const outline = await askAI(`${base}
STORY BIBLE:
${bible}

TASK: CREATE THE COMPLETE SCENE OUTLINE.

Return a concise numbered list of ALL scenes required for the full story.
For each scene provide:
- Scene number
- Start and end timestamp
- Duration in seconds
- Location
- Characters present
- Main visual action
- Story purpose

The durations MUST add up to exactly ${seconds} seconds.
Do not write long prompts here. This is an outline only.
Do not omit the ending.
`);
      if (outline.length < 100) throw new Error("Kulang ang scene outline.");
      addPart("PART 2A — COMPLETE SCENE OUTLINE", outline);

      // PART 2B: Generate each scene in a separate AI request.
      const sceneCountMatch = outline.match(
        /(?:scene|eksena)\s*(\d+)\s*[:—-]/ig
      );
      let sceneCount = sceneCountMatch?.length || 0;

      // The model may use other heading styles. Ask it for a normalized list.
      if (sceneCount < 2) {
        const normalized = await askAI(`${base}
SCENE OUTLINE:
${outline}

Return ONLY a numbered list of every scene in the format:
SCENE 1: [short title] | [start-end timestamp] | [duration in seconds]
SCENE 2: ...
Include the ending. Do not add explanations.
Durations must total ${seconds} seconds.
`);
        addPart("PART 2A-2 — NORMALIZED SCENE LIST", normalized);
        sceneCountMatch?.splice(0);
        const matches = [...normalized.matchAll(/SCENE\s*\d+\s*:/ig)];
        sceneCount = matches.length;
      }

      if (sceneCount < 2) {
        throw new Error("Hindi matukoy ang mga scene. Hindi minarkahang complete ang pack.");
      }

      // Keep requests bounded; ask for a concise scene list if unusually large.
      if (sceneCount > 12) {
        throw new Error(
          `May ${sceneCount} scenes ang outline. Sobra ito para sa safe generation; ayusin muna ang outline.`
        );
      }

      const sceneSource = packParts.join("\n\n");

      for (let i = 1; i <= sceneCount; i++) {
        showProgress(`GENERATING SCENE ${i} OF ${sceneCount}`);

        const scene = await askAI(`${base}
STORY BIBLE AND OUTLINE:
${sceneSource}

TASK: GENERATE SCENE ${i} ONLY.

Return a complete, standalone video-generation prompt containing:
- Exact scene number, title, and timestamps.
- Duration in seconds.
- Location and time of day.
- Characters present with their locked ages.
- Actions and facial expressions.
- A detailed visual prompt for the video generator.
- Camera framing, movement, and lighting.
- Atmosphere, sound effects, and transition.
- Character appearance and wardrobe locks.

Do not generate other scenes.
Do not contradict the outline or approved plan.
Do not leave any field unfinished.
Finish the entire scene before stopping.
`);
        if (scene.length < 180) {
          throw new Error(`Scene ${i} is incomplete.`);
        }

        addPart(`PART 2 — SCENE ${i} OF ${sceneCount}`, scene);
      }

      // PART 3: Dialogue and cinematography per scene.
      for (let i = 1; i <= sceneCount; i++) {
        showProgress(`GENERATING DIALOGUE & CINEMATOGRAPHY ${i}/${sceneCount}`);

        const sceneText = packParts.find((p) =>
          p.startsWith(`PART 2 — SCENE ${i} OF`)
        ) || "";

        const direction = await askAI(`${base}
APPROVED PLAN, STORY BIBLE, AND SCENE OUTLINE:
${sceneSource}

SCENE TO COVER:
${sceneText}

TASK: DIALOGUE AND CINEMATOGRAPHY FOR SCENE ${i} ONLY.

Include:
- Exact dialogue in ${language}, or explicitly "No dialogue".
- Voice-over or narration, or explicitly "No voice-over".
- Speaker, emotion, delivery, pacing, and pauses.
- Silent acting and character reactions.
- Camera, framing, movement, lighting, and composition.
- Sound effects, ambience, and music.
- On-screen text if needed.

If the scene has no dialogue, do not describe a character speaking.
Do not invent events or add characters.
Complete every field.
`);
        if (direction.length < 120) {
          throw new Error(`Dialogue/cinematography for Scene ${i} is incomplete.`);
        }

        addPart(`PART 3 — DIALOGUE & CINEMATOGRAPHY, SCENE ${i}`, direction);
      }

      // PART 4: Global production instructions
      showProgress("GENERATING PART 4 — EDITING & CONTINUITY LOCKS");

      const editing = await askAI(`${base}
STORY BIBLE:
${bible}

COMPLETE SCENE OUTLINE:
${outline}

TASK: EDITING, NEGATIVE PROMPTS, AND QUALITY CHECKS.

Include:
1. Editing timeline matching exactly ${seconds} seconds.
2. Transitions and pacing.
3. Negative prompts to prevent unwanted visual results.
4. Face, hair, body, wardrobe, and accessory locks for every character.
5. Location, prop, timeline, and emotional continuity locks.
6. Audio, subtitles, and on-screen text instructions.
7. A practical pre-generation checklist.

Do not change the requested runtime.
Do not invent a new story event.
Finish every section.
`);
      if (editing.length < 200) throw new Error("Kulang ang Editing and Continuity section.");
      addPart("PART 4 — EDITING, NEGATIVE PROMPTS AND QUALITY CHECKS", editing);

      // FINAL AUDIT
      showProgress("RUNNING FINAL CONTINUITY AUDIT");

      const audit = await askAI(`${base}
COMPLETE PRODUCTION PACK:
${packParts.join("\n\n")}

TASK: FINAL CONTINUITY AUDIT.

Check:
- Requested runtime remains exactly ${runtime} (${seconds} seconds).
- Scene durations add up to exactly ${seconds} seconds.
- Every scene has a complete visual prompt.
- Dialogue/cinematography exists for every scene.
- Character ages, appearance, wardrobe, and props are consistent.
- Locations, timeline, and ending match the approved plan.
- All parts are present and not obviously cut off.

A 1-minute runtime is valid. Never require a longer runtime merely
because the story is emotional or complex.

Return:
FINAL CONTINUITY AUDIT
AUDIT RESULT: PASS or NEEDS REPAIR
RUNTIME CHECK:
COMPLETENESS CHECK:
CONTINUITY CHECK:
REQUIRED FIXES:

Use PASS only if all checks pass. If any section is missing or
inconsistent, use NEEDS REPAIR. Do not rewrite the story.
`);
      packParts.push(`FINAL CONTINUITY AUDIT\n\n${audit.trim()}`);

      const pass = /AUDIT RESULT:\s*PASS\b/i.test(audit)
        && !/AUDIT RESULT:\s*NEEDS REPAIR\b/i.test(audit);

      showProgress(
        pass
          ? "PRODUCTION PACK — COMPLETE (AUDIT PASSED)"
          : "PRODUCTION PACK — NEEDS REPAIR"
      );

      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "Copy Production Pack";
      copy.addEventListener("click", async () => {
        const fullText = packParts.join("\n\n");
        try {
          await navigator.clipboard.writeText(fullText);
          copy.textContent = "Copied!";
        } catch {
          message("assistant", "Hindi makopya automatically. Piliin at kopyahin ang text.");
        }
      });

      (planBox || chat).appendChild(copy);

      message(
        "assistant",
        pass
          ? "Kumpleto ang pack at pumasa sa audit. Suriin pa rin bago mag-generate ng video."
          : "Nabuo ang pack pero NEEDS REPAIR. Huwag munang gamitin sa video generation."
      );
    } catch (error) {
      showProgress("PRODUCTION PACK — INCOMPLETE");
      message(
        "assistant",
        `Hindi kumpleto ang Production Pack: ${error.message}\n` +
        "Napanatili ang mga section na nagawa. Hindi ito mamarkahang complete."
      );
    } finally {
      setBusy(false);
    }
  }

  sendButton.addEventListener("click", createPlan);

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      createPlan();
    }
  });

  document.querySelectorAll(".length-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".length-btn").forEach((item) => {
        item.classList.remove("active");
      });
      button.classList.add("active");
      runtime = button.dataset.length || button.textContent.trim();
    });
  });
})();
  
