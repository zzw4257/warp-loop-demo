"use strict";
const data = window.VIEWER_DATA;
const $ = (id) => document.getElementById(id);
const fmt = (n) => new Intl.NumberFormat("en-US").format(n);
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };

function showView() {
  const allowed = ["start", "running", "trace", "rule", "corpus", "efficiency", "limits", "history"];
  const view = allowed.includes(location.hash.slice(1)) ? location.hash.slice(1) : "start";
  document.querySelectorAll(".view").forEach((node) => { node.hidden = node.id !== view; });
  document.querySelectorAll("[data-view]").forEach((node) => { if (node.dataset.view === view) node.setAttribute("aria-current", "page"); else node.removeAttribute("aria-current"); });
  if (view === "history" && !$('reuse-frame').src) $('reuse-frame').src = $('reuse-frame').dataset.src;
  if (view === "history" && !$('reuse-frame').getAttribute("src")) $('reuse-frame').setAttribute("src", "reuse.html");
}

const run = data.running;
let selectedMode = "legal";
let traceSelected = 0;
const variantLabels = {legal: "Legal reuse (includes tail)", producer_work_mismatch: "Wrong input work", task_mismatch: "Wrong output work", reset: "Reset pipeline state", early_release: "Release before completion"};
function renderModes() {
  const root = $("run-modes");
  root.replaceChildren();
  Object.keys(run.variants).forEach((id) => {
    const button = el("button", variantLabels[id] || id, "mode-button");
    button.setAttribute("aria-pressed", String(id === selectedMode));
    button.addEventListener("click", () => { selectedMode = id; traceSelected = 0; renderModes(); renderTrace(); });
    root.append(button);
  });
  const v = run.variants[selectedMode];
  $("mode-result").replaceChildren(el("strong", "Native: " + v.native_status), el("p", "Input work agrees: " + v.work_correspondence.matches + "; output work agrees: " + v.task_correspondence.matches), el("p", v.claim_boundary));
  if (v.source_change) {
    const detail = el("details");
    detail.append(el("summary", "Exact PTX change from the legal example"), el("pre", v.source_change));
    $("mode-result").append(detail);
  }
}
function renderTrace() {
  const v = run.variants[selectedMode];
  // The stored reference sequence is one witness execution, not all schedules.
  const ids = v.reference_events.filter((id) => v.events[String(id)]);
  const root = $("trace-events"); root.replaceChildren();
  if (!ids.length) {
    root.append(el("p", "No reference execution was recorded for this variant."));
    $("trace-code").textContent = v.ptx;
    $("evidence-card").replaceChildren(el("h3", v.native_status), el("p", v.claim_boundary));
    return;
  }
  ids.forEach((id, i) => {
    const s = v.events[String(id)];
    const button = el("button", undefined, "trace-event" + (i === traceSelected ? " selected" : ""));
    button.append(el("span", "e" + id, "event-no"), el("strong", s.label), el("small", "PTX " + s.line + " · actor " + s.actor));
    button.addEventListener("click", () => { traceSelected = i; renderTrace(); });
    root.append(button);
  });
  const id = ids[traceSelected];
  const s = v.events[String(id)];
  const lines = v.ptx.split("\n");
  $("trace-code").textContent = lines.map((line, i) => (i + 1 === s.line ? "▶ " : "  ") + String(i + 1).padStart(3) + "  " + line).slice(Math.max(0, s.line - 5), s.line + 5).join("\n");
  const work = v.work.find((item) => item.q === s.q);
  const wait = v.waits.find((item) => item.issue === id || item.done === id);
  const card = $("evidence-card");
  card.replaceChildren(el("span", "RECORDED EVENT e" + id, "kicker"), el("h3", s.label));
  const fields = [["instruction", lines[s.line - 1]], ["actor / instruction ID", s.actor + " / " + s.instruction], ["event kind", s.kind], ["work", s.detail || "not assigned"], ["buffer", s.buffer == null ? "not assigned" : "B" + s.buffer], ["per-buffer generation", work ? work.generation : "not assigned"], ["wait target", wait ? JSON.stringify(wait.target) + " · " + wait.status : "not a wait event"], ["source", "workflow.json → " + selectedMode + " → presentation.events[" + id + "]"]];
  fields.forEach(([name, value]) => { const row = el("div", undefined, "evidence-row"); row.append(el("small", name), el("strong", String(value))); card.append(row); });
}

const ruleText = [
  ["Common skeleton", "Hide optional effects. Arrive, wait, generation and resource ownership stay fixed. This is the baseline certificate.", "common"],
  ["One optional region", "Open one region. It adds a read, store and completion requirement owned by exactly one participant / visit.", "optional"],
  ["Endpoint pair", "Choose the conflict endpoints. The available path uses common events plus owners A and B; a visual candidate is not yet HB.", "candidate"],
  ["Third owner", "Open a third region. If the only path now depends on C, the pair is unproved for a family that may skip C.", "unproved"],
];
function renderRule(index = 0) { document.querySelectorAll("[data-rule-step]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.ruleStep) === index))); const [title, text, cls] = ruleText[index]; const root = $("rule-stage"); root.replaceChildren(el("span", `STAGE ${index + 1}`, "kicker"), el("h3", title), el("p", text), el("div", index === 2 ? "A ── candidate path ── B" : index === 3 ? "A ──?── B   (depends on C)" : index === 1 ? "common + A(optional)" : "common arrivals / generation", `rule-sketch ${cls}`), el("span", index === 2 ? "illustrative admissible support · no computed verdict" : index === 3 ? "illustrative unsupported path · not a bug witness" : "candidate relation", `rule-status ${cls}`)); }
document.querySelectorAll("[data-rule-step]").forEach((b) => b.addEventListener("click", () => renderRule(Number(b.dataset.ruleStep))));

function renderCorpus() { const root = $("corpus-grid"); data.corpus.cards.forEach((card) => { const article = el("article", undefined, "corpus-card"); article.append(el("span", card.id.toUpperCase(), "card-id"), el("h3", card.mechanism), el("p", card.source, "muted")); [["source / PTX", card.ptx], ["input", card.input], ["positive", card.positive], ["negative", card.negative], ["verdict", card.verdict], ["scope", card.scope], ["remaining", card.remaining]].forEach(([a, b]) => { const d = el("div", undefined, "corpus-field"); d.append(el("small", a), el("span", b)); article.append(d); }); root.append(article); }); }

function costText(arm) { if (arm.status === "complete") return `${arm.time.toFixed(2)} s [${arm.range.map((x) => x.toFixed(2)).join("–")}]`; return "incomplete"; }
function renderEfficiency() { const e = data.efficiency; $("efficiency-intro").textContent = `${e.same_obligations}. Speedup appears only for two complete arms.`; const root = $("efficiency-body"); e.rows.forEach((row) => { const tr = el("tr"); const baseMemory = row.enumeration.memory ? row.enumeration.memory.median_gib.toFixed(2) : "—"; const familyMemory = row.family.memory ? row.family.memory.median_gib.toFixed(2) : "—"; const memory = `${baseMemory} / ${familyMemory} GiB (enum / family)`; [row.visits, costText(row.enumeration), costText(row.family), memory, `${row.enumeration.stop} / ${row.family.stop}`, row.verdict, row.speedup == null ? "—" : `${row.speedup.toFixed(2)}×`].forEach((v) => tr.append(el("td", String(v)))); root.append(tr); }); $("efficiency-notes").replaceChildren(...e.notes.map((n) => el("li", n))); }
function renderLimits() { const root = $("limits-grid"); ["arbitrary tensor feedback", "arbitrary loop length", "full cross-output family", "exact SM90 WGMMA semantics", "whole-kernel numerical equivalence", "hardware execution", "all 28 historical cases"].forEach((label) => { const d = el("div", undefined, "limit-card"); d.append(el("b", "OPEN"), el("span", label)); root.append(d); }); }

window.addEventListener("hashchange", showView); renderModes(); renderTrace(); renderRule(); renderCorpus(); renderEfficiency(); renderLimits(); showView();
document.querySelectorAll(".corpus-card").forEach((article, i) => {
  const card = data.corpus.cards[i];
  const filename = card.ptx.split(":")[0].split("/").pop().replace(/\.ptx$/, ".annotated.ptx");
  const link = el("a", "Read the complete annotated PTX ↙");
  link.href = filename;
  link.download = filename;
  article.append(link);
});
