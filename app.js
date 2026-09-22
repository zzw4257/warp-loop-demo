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

function ownerName(id) {
  const owner = data.family.owners.find((row) => row.owner_index === id).owner;
  return `warp ${owner.warp_id}, visit ${owner.branch_visit + 1}`;
}
function renderRule(index = data.family.groups.findIndex((group) => group.support.length === 0)) {
  const groups = data.family.groups;
  const selected = groups[index];
  $("rule-groups").replaceChildren(...groups.map((group, i) => {
    const label = group.support.length ? group.support.map(ownerName).join(" + ") : "Common events only";
    const button = el("button", label);
    button.setAttribute("aria-pressed", String(index === i));
    button.addEventListener("click", () => renderRule(i));
    return button;
  }));
  const stage = $("rule-stage");
  stage.replaceChildren(el("span", `RECORDED GROUP ${index + 1} / ${groups.length}`, "kicker"),
    el("h3", selected.support.length ? selected.support.map(ownerName).join(" + ") : "Common events only"),
    el("p", "Allowed optional owners for this recorded check: " + (selected.support.length ? selected.support.map(ownerName).join("; ") : "none") + ". Other owners' optional work cannot supply this group's ordering arguments."));
  const fields = [["Candidate access pairs", selected.candidate_pairs], ["Required-order endpoints", selected.required_endpoints],
    ["Unproved pairs", selected.unproved_pairs], ["Unproved required orders", selected.unproved_required_orders],
    ["Duplicate-TMA warnings in this group", selected.duplicate_tma_warnings]];
  const grid = el("div", undefined, "boundary-grid");
  fields.forEach(([label, value]) => { const cell = el("div"); cell.append(el("b", fmt(value)), el("span", label)); grid.append(cell); });
  stage.append(grid, el("p", `Source: family-h64.json · groups[${index}]. Across the full family, ${fmt(data.family.exempted_unordered_warning_pairs)} unordered pairs remain exempted under A002; zero unproved nonexempt obligations is conditional on that assumption.`, "note"));
}

function renderCorpus() { const root = $("corpus-grid"); data.corpus.cards.forEach((card) => { const article = el("article", undefined, "corpus-card"); article.append(el("span", card.id.toUpperCase(), "card-id"), el("h3", card.mechanism), el("p", card.source, "muted")); [["source / PTX", card.ptx], ["input", card.input], ["positive", card.positive], [card.negative_label || "negative control", card.negative], ["verdict", card.verdict], ["scope", card.scope], ["remaining", card.remaining]].forEach(([a, b]) => { const d = el("div", undefined, "corpus-field"); d.append(el("small", a), el("span", b)); article.append(d); }); root.append(article); }); }

function costText(arm) { if (arm.status === "complete") return `${arm.time.toFixed(2)} s [${arm.range.map((x) => x.toFixed(2)).join("–")}]`; return "incomplete"; }
function renderEfficiency() { const e = data.efficiency; $("efficiency-intro").textContent = `${e.same_obligations}. Speedup appears only for two complete arms.`; const root = $("efficiency-body"); e.rows.forEach((row) => { const tr = el("tr"); const baseMemory = row.enumeration.memory ? row.enumeration.memory.median_gib.toFixed(2) : "—"; const familyMemory = row.family.memory ? row.family.memory.median_gib.toFixed(2) : "—"; const memory = `${baseMemory} / ${familyMemory} GiB (enum / family)`; [row.visits, costText(row.enumeration), costText(row.family), memory, `${row.enumeration.stop} / ${row.family.stop}`, row.verdict, row.speedup == null ? "—" : `${row.speedup.toFixed(2)}×`].forEach((v) => tr.append(el("td", String(v)))); root.append(tr); }); $("efficiency-notes").replaceChildren(...e.notes.map((n) => el("li", n))); }
function renderLimits() { const root = $("limits-grid"); ["arbitrary tensor feedback", "arbitrary loop length", "full cross-output family", "exact SM90 WGMMA semantics", "whole-kernel numerical equivalence", "hardware execution", "all 28 historical cases"].forEach((label) => { const d = el("div", undefined, "limit-card"); d.append(el("b", "OPEN"), el("span", label)); root.append(d); }); }

window.addEventListener("hashchange", showView); renderModes(); renderTrace(); renderRule(); renderCorpus(); renderEfficiency(); renderLimits(); showView();
$("contribution-scope").textContent = `h64: ${data.family.owners.length} independent warp/visit choices, ${data.family.choice_count} combinations. h128: ${data.corpus.raw.h128.owners.length} choices, ${2 ** data.corpus.raw.h128.owners.length} combinations. These are fixed-control, resolved-address model families, not a proof for arbitrary tensor inputs.`;
document.querySelectorAll(".corpus-card").forEach((article, i) => {
  const card = data.corpus.cards[i];
  const filename = card.ptx.split(":")[0].split("/").pop().replace(/\.ptx$/, ".annotated.ptx");
  const link = el("a", "Read the complete annotated PTX ↙");
  link.href = filename;
  link.download = filename;
  article.append(link);
  for (const evidence of card.evidence_links || []) {
    const row = el("p");
    const receipt = el("a", evidence.label + " ↙");
    receipt.href = evidence.href;
    receipt.download = evidence.href;
    row.append(receipt);
    article.append(row);
  }
});
