
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const input = $("#user-input");
  const sendButton = $("#send-button");
  const chat = $("#chat-messages");
  const indicator = $("#typing-indicator");
  const planBox = $("#studio-plan");

  if (!input || !sendButton || !chat) {
    console.error("AI Drama Studio: Required HTML elements missing.");
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
    let m = s.match(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?)/);
    if (m) return Math.round(Number(m[1]));
    m = s.match(/(\d+(?:\.\d+)?)\s*hours?/);
    if (m) return Math.round(Number(m[1]) * 3600);
    m = s.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)/);
    if (m) return Math.round(Number(m[1]) * 60);
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? Math.round(n * 60) : 60;
  }

  function getLanguage() {
    const el = $("#language");
    return el?.selectedOptions?.[0]?.textContent?.trim()
      || el?.value || "Tagalog";
  }

  function getSetting(selector, fallback) {
    const el = $(selector);
    return el?.selectedOptions?.[0]?.textContent?.trim()
      || el?.value || fallback;
  }

  function getSelectedRuntime() {
    const active = document.querySelector(".length-btn.active");
    return active?.dataset?.length
      || active?.textContent?.trim()
      || runtime;
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
      throw new Error("Invalid JSON response from server.");
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
      const text = data.content
        .map((item) => item?.text || "")
        .filter(Boolean)
        .join("\n");
      if (text) return text.trim();
    }

    throw new Error("Hindi mabasa ang AI response.");
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
      const plan = await askAI(`
You are the original story planner for AI Drama Studio.

USER IDEA:
${idea}

LOCKED SETTINGS:
Runtime: ${runtime}
Exact duration: ${seconds} seconds
Language: ${language}
Visual style: ${getSetting("#character-style", "Cinematic realistic")}
Visual direction: ${getSetting("#visual-vision", "Emotional cinematic")}

Create an original, practical drama plan with:
1. Title, genre, and logline.
2. Beginning, conflict, climax, and ending.
3. Character ages, appearance, wardrobe, and relationships.
4. Locations, timeline, and recurring props.
5. Numbered scene outline with timestamps and durations totaling
   exactly ${seconds} seconds.
6. Dialogue or voice-over direction.
7. Ending and continuity locks.

Never change the requested runtime. Keep the story achievable within
the selected duration. Use ${language}. Do not copy existing stories.

End with: PLAN READY FOR REVIEW
`);

      if (plan.length < 150) {
        throw new Error("Masyadong maikli ang plan.");
      }

      showPlan(plan);
      message("assistant", "Suriin ang plan bago i-approve.");
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

  function getSceneNumbers(text) {
    return [...String(text).matchAll(
      /^\s*(?:\*\*)?\s*(?:Scene|Eksena)\s*(\d+)\s*[:—.-]/gim
    )].map((m) => Number(m[1]));
  }

  
function validateSceneDurations(outline, expectedSeconds) {
  const text = String(outline);
  const headers = [
    ...text.matchAll(/^\s*(?:\*\*)?\s*(?:Scene|Eksena)\s*\d+\s*[:—.-].*$/gim)
  ];

  if (!headers.length) {
    return {
      valid: false,
      reason: "Hindi makita ang mga scene heading sa outline."
    };
  }

  const durations = [];

  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index + headers[i][0].length;
    const end = i + 1 < headers.length
      ? headers[i + 1].index
      : text.length;

    const block = text.slice(start, end);
    const match = block.match(
      /\bDuration\s*:\s*(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/i
    );

    if (!match) {
      return {
        valid: false,
        reason: `Hindi mabasa ang Duration ng Scene ${i + 1}.`
      };
    }

    durations.push(Number(match[1]));
  }

  const total = durations.reduce((sum, value) => sum + value, 0);

  if (Math.round(total) !== expectedSeconds) {
    return {
      valid: false,
      reason: `Ang total ay ${total} seconds; kailangan ay ${expectedSeconds} seconds.`
    };
  }

  return { valid: true, durations };
}

    const text = String(outline);
    const blocks = text.split(
      /^\s*(?:\*\*)?\s*(?:Scene|Eksena)\s*\d+\s*[:—.-].*$/im
    ).slice(1);

    const durations = [];

    for (const block of blocks) {
      const match = block.match(
        /\bDuration\s*:\s*(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/i
      );
      if (!match) {
        return {
          valid: false,
          reason: "May scene na walang mabasang Duration field."
        };
      }
      durations.push(Number(match[1]));
    }

    if (!durations.length) {
      return {
        valid: false,
        reason: "Hindi ma-parse ang scene outline. Kailangan ang Scene 1: at Duration: 5s format."
      };
    }

    const total = durations.reduce((sum, n) => sum + n, 0);

    if (Math.round(total) !== expectedSeconds) {
      return {
        valid: false,
        reason: `Ang total ay ${total} seconds, pero ang request ay ${expectedSeconds} seconds.`
      };
    }

    return { valid: true, durations };
  }

  function looksTruncated(text) {
    const value = String(text || "").trim();
    if (!value || value.length < 100) return true;
    if (/[:\-]\s*$/.test(value)) return true;
    if (/[\u2022*]\s*$/.test(value)) return true;
    if (/\b(the|and|or|with|for|because|but|ng|na|at|sa|ang|mga)\s*[.,:;\-]*$/i.test(value)) {
      return true;
    }
    return false;
  }

  function validateGeneratedSections(parts) {
    const problems = [];

    for (const part of parts) {
      const index = part.indexOf("\n\n");
      const title = index >= 0 ? part.slice(0, index) : part;
      const body = index >= 0 ? part.slice(index + 2).trim() : "";

      if (!body || body.length < 100) {
        problems.push(`${title}: kulang ang output.`);
      } else if (looksTruncated(body)) {
        problems.push(`${title}: posibleng naputol ang huling linya.`);
      }
    }

    return problems;
  }

  async function buildPack() {
    if (busy) return;

    if (!approvedPlan) {
      message("assistant", "Gumawa muna ng drama plan.");
      return;
    }

    if (!window.confirm(
      `Buuin ang Production Pack? Runtime: ${runtime}.`
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

Never change the approved story, runtime, character ages, relationships,
locations, timeline, props, or ending. Return only the requested task.
`;

    try {
      showProgress("GENERATING PART 1 — STORY BIBLE");

      const bible = await askAI(`${base}
Create the complete Story Bible and Character DNA.

Include title, genre, logline, complete story summary, beginning,
conflict, climax, ending, and every important character's age, face,
hair, skin tone, body type, voice, personality, wardrobe, accessories,
props, relationships, locations, timeline, and continuity locks.

Finish every character profile completely.
`);
      if (bible.length < 250) throw new Error("Kulang ang Story Bible.");
      addPart("PART 1 — STORY BIBLE AND CHARACTER DNA", bible);

      showProgress("GENERATING PART 2A — SCENE OUTLINE");

      const outline = await askAI(`${base}
STORY BIBLE:
${bible}

Create a concise complete scene outline.
For each scene use EXACTLY this format:

Scene 1: Short title
Start: 0s
End: 5s
Duration: 5s
Location: ...
Characters: ...
Main visual action: ...
Story purpose: ...

Use sequential scene numbers. Include the ending. Durations must add
up to exactly ${seconds} seconds. Do not include multiple Duration
fields for one scene.
`);
      if (outline.length < 100) throw new Error("Kulang ang scene outline.");

      const durationCheck = validateSceneDurations(outline, seconds);
      if (!durationCheck.valid) throw new Error(durationCheck.reason);

      const sceneNumbers = getSceneNumbers(outline);
      if (sceneNumbers.length < 2) {
        throw new Error("Kailangan ng hindi bababa sa 2 scenes.");
      }

      if (sceneNumbers.some((number, index) => number !== index + 1)) {
        throw new Error("Hindi sunod-sunod ang scene numbers.");
      }

      if (sceneNumbers.length > 12) {
        throw new Error("Higit sa 12 scenes. Paikliin o ayusin muna ang outline.");
      }

      addPart("PART 2A — COMPLETE SCENE OUTLINE", outline);

      for (let i = 1; i <= sceneNumbers.length; i++) {
        showProgress(`GENERATING SCENE ${i}/${sceneNumbers.length}`);

        const scene = await askAI(`${base}
STORY BIBLE:
${bible}

COMPLETE SCENE OUTLINE:
${outline}

Generate Scene ${i} ONLY as a complete standalone video prompt.

Include title, exact timestamps, duration, location, time of day,
characters with locked ages and appearance, actions, facial expressions,
visual prompt, camera, framing, movement, lighting, atmosphere, sound,
transition, wardrobe locks, and props.

Do not generate another scene. Do not contradict the approved plan.
Finish the entire scene.
`);

        if (scene.length < 180 || looksTruncated(scene)) {
          throw new Error(`Scene ${i} is incomplete or possibly truncated.`);
        }

        addPart(`PART 2 — SCENE ${i} OF ${sceneNumbers.length}`, scene);
      }

      for (let i = 1; i <= sceneNumbers.length; i++) {
        showProgress(`GENERATING DIALOGUE & CINEMATOGRAPHY ${i}/${sceneNumbers.length}`);

        const scenePart = packParts.find((part) =>
          part.startsWith(`PART 2 — SCENE ${i} OF`)
        );

        const direction = await askAI(`${base}
STORY BIBLE:
${bible}

SCENE OUTLINE:
${outline}

SCENE TO COVER:
${scenePart}

Create dialogue and cinematography for Scene ${i} ONLY.
Include exact dialogue in ${language}, or state "No dialogue".
Include voice-over, speaker, emotion, delivery, pacing, pauses,
silent acting, camera, framing, movement, lighting, sound, ambience,
music, and on-screen text where appropriate.

Do not invent events or contradict the scene.
Finish every section.
`);

        if (direction.length < 120 || looksTruncated(direction)) {
          throw new Error(`Dialogue/cinematography for Scene ${i} is incomplete.`);
        }

        addPart(`PART 3 — DIALOGUE & CINEMATOGRAPHY, SCENE ${i}`, direction);
      }

      showProgress("GENERATING PART 4 — EDITING AND CONTINUITY");

      const editing = await askAI(`${base}
STORY BIBLE:
${bible}

SCENE OUTLINE:
${outline}

Create editing timeline totaling exactly ${seconds} seconds,
transitions, pacing, negative prompts, character face/hair/body/
wardrobe locks, location/prop/timeline locks, audio/subtitle
instructions, and a pre-generation checklist.

Do not change the runtime or add contradictory story events.
`);
      if (editing.length < 200 || looksTruncated(editing)) {
        throw new Error("Editing and Continuity section is incomplete.");
      }

      addPart("PART 4 — EDITING, NEGATIVE PROMPTS AND QUALITY CHECKS", editing);

      showProgress("RUNNING FINAL CONTINUITY AUDIT");

      const audit = await askAI(`${base}
PRODUCTION PACK:
${packParts.join("\n\n")}

Audit runtime, total scene duration, completeness, character consistency,
wardrobe, props, locations, timeline, ending, and missing sections.
A 1-minute runtime is valid. Never demand a longer runtime.

Return:
FINAL CONTINUITY AUDIT
AUDIT RESULT: PASS or NEEDS REPAIR
RUNTIME CHECK:
COMPLETENESS CHECK:
CONTINUITY CHECK:
REQUIRED FIXES:

Use NEEDS REPAIR for any missing or inconsistent detail.
`);

      packParts.push(`FINAL CONTINUITY AUDIT\n\n${audit.trim()}`);

      const auditPass =
        /\bAUDIT RESULT:\s*PASS\b/i.test(audit) &&
        !/\bAUDIT RESULT:\s*NEEDS REPAIR\b/i.test(audit);

      const sectionProblems = validateGeneratedSections(packParts);
      const finalDurationCheck = validateSceneDurations(outline, seconds);

      const requiredSceneParts = sceneNumbers.map(
        (n) => `PART 2 — SCENE ${n} OF ${sceneNumbers.length}`
      );

      const missingScenes = requiredSceneParts.filter((prefix) =>
        !packParts.some((part) => part.startsWith(prefix))
      );

      const pass =
        auditPass &&
        sectionProblems.length === 0 &&
        finalDurationCheck.valid &&
        missingScenes.length === 0;

      if (!pass) {
        packParts.push(
          "LOCAL VALIDATION — NEEDS REPAIR\n\n" +
          [
            ...sectionProblems,
            ...missingScenes.map((s) => `Missing: ${s}`),
            ...(!finalDurationCheck.valid ? [finalDurationCheck.reason] : []),
            ...(!auditPass ? ["Hindi pumasa ang AI audit."] : [])
          ].join("\n")
        );
      }

      showProgress(
        pass
          ? "PRODUCTION PACK — COMPLETE (AUDIT PASSED)"
          : "PRODUCTION PACK — NEEDS REPAIR"
      );

      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "Copy Production Pack";
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(packParts.join("\n\n"));
          copy.textContent = "Copied!";
        } catch {
          message("assistant", "Hindi makopya automatically. Piliin at kopyahin ang text.");
        }
      });

      (planBox || chat).appendChild(copy);

      message(
        "assistant",
        pass
          ? "Kumpleto ang Production Pack at pumasa sa audit. Suriin pa rin bago mag-generate."
          : "Nabuo ang pack pero NEEDS REPAIR. Huwag munang gamitin sa video generation."
      );
    } catch (error) {
      showProgress("PRODUCTION PACK — INCOMPLETE");
      message("assistant", `Hindi kumpleto ang Production Pack: ${error.message}`);
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
    
