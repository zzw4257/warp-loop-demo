"use strict";
const data = window.VIEWER_DATA;
const $ = (id) => document.getElementById(id);
const fmt = (n) => new Intl.NumberFormat("en-US").format(n);
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const link = (text, href, cls) => { const a = el("a", text, cls); a.href = href; return a; };
function showView() {
  const alias = {trace: "running", example: "running", history: "running"};
  const requested = location.hash.slice(1);
  const view = alias[requested] || (["start", "running", "rule", "corpus", "efficiency", "limits"].includes(requested) ? requested : "start");
  document.querySelectorAll(".view").forEach((node) => { node.hidden = node.id !== view; });
  document.querySelectorAll("[data-view]").forEach((node) => { if (node.dataset.view === view) node.setAttribute("aria-current", "page"); else node.removeAttribute("aria-current"); });
}

const run = data.running;
let selectedMode = "legal", step = 0;
const variantLabels = {legal: "Legal reuse", early_release: "Early release", reset: "Reset cursor", task_mismatch: "Wrong output", producer_work_mismatch: "Wrong input"};
const milestones = new Set(["Wait returns", "Issue copy", "Buffer write", "Issue MMA", "MMA reads complete", "Release", "Record output"]);
function variant() { return run.variants[selectedMode]; }
function replay() { return (variant().race_replays || []).find((record) => record.simulation_succeeded); }
function sequence() { return $("execution").value === "witness" && replay() ? replay().executed_order : variant().reference_events; }
function visiblePositions(seq) { return seq.map((id, i) => ({id, position: i + 1, event: variant().events[String(id)]})).filter((row) => row.event && ((row.event.q != null && milestones.has(row.event.label)) || row.position === seq.length)); }
function chooseMode(id) {
  selectedMode = id; step = 0; $("execution").value = "reference";
  $("execution").options[1].disabled = !replay();
  renderModes(); renderPlayer();
}
function renderModes() {
  $("run-modes").replaceChildren(...Object.entries(variantLabels).map(([id, label]) => {
    const b = el("button", label); b.setAttribute("aria-pressed", String(id === selectedMode)); b.addEventListener("click", () => chooseMode(id)); return b;
  }));
  const v = variant();
  const title = v.native_status === "race_free" ? "Race-free in the checked model" : v.native_status === "race_candidate" ? "Race candidate recorded" : "Synchronization candidate recorded";
  const result = $("mode-result"); result.className = "mode-result " + (v.native_status === "race_free" && v.work_correspondence.matches && v.task_correspondence.matches ? "pass" : "attention");
  result.replaceChildren(el("strong", title), el("span", `Input work: ${v.work_correspondence.matches ? "agrees" : "MISMATCH"} · Output work: ${v.task_correspondence.matches ? "agrees" : "MISMATCH"}`));
  $("source-diff").textContent = v.source_change || "Original legal PTX; no mutation.";
}
function move(direction) {
  const positions = visiblePositions(sequence()).map((row) => row.position);
  step = direction > 0 ? (positions.find((p) => p > step) ?? sequence().length) : (positions.filter((p) => p < step).at(-1) ?? 0);
  renderPlayer();
}
function renderPlayer() {
  const v = variant(), seq = sequence(), current = step ? seq[step - 1] : null;
  const event = current === null ? null : v.events[String(current)];
  const rows = visiblePositions(seq), firstAhead = rows.findIndex((row) => row.position >= step);
  const start = Math.max(0, (firstAhead < 0 ? rows.length - 1 : firstAhead) - 2);
  $("event-position").textContent = event ? `Recorded e${current} · ${$("execution").value === "witness" ? "race witness" : "reference execution"}` : "Recorded execution";
  $("event-title").textContent = event ? event.label : seq.length ? "Before execution" : "No recorded execution for this variant";
  $("event-detail").textContent = event ? event.detail || event.kind : seq.length ? "Press Next event to follow the work. The full recorded prefix is counted between milestones." : "The stored verifier result is shown above; no animation is invented.";
  $("step-count").textContent = `${step} / ${seq.length} model events`;
  $("previous").disabled = step === 0; $("next").disabled = step >= seq.length;
  const reuse = v.work.find((w) => w.q > 0 && v.work.some((old) => old.q < w.q && old.buffer === w.buffer));
  const reuseId = reuse && reuse.write_events.find((id) => seq.includes(id));
  $("reuse-jump").disabled = reuseId === undefined;
  $("reuse-jump").onclick = () => { step = seq.indexOf(reuseId) + 1; renderPlayer(); };
  const lanes = $("event-lanes"); lanes.replaceChildren();
  rows.slice(start, start + 6).forEach((row) => {
    const line = el("div", undefined, "lane-row");
    const b = el("button", undefined, "lane-event " + (row.position === step ? "current" : row.position < step ? "past" : "upcoming"));
    b.style.gridColumn = String(row.event.lane + 1);
    b.append(el("strong", row.event.label), el("small", `e${row.id}${row.event.q == null ? "" : " · q" + row.event.q}${row.event.buffer == null ? "" : " · B" + row.event.buffer}`));
    b.setAttribute("aria-label", `Event ${row.id}: ${row.event.label}`); b.setAttribute("aria-pressed", String(row.position === step));
    b.addEventListener("click", () => { step = row.position; renderPlayer(); }); line.append(b); lanes.append(line);
  });
  const lines = v.ptx.split("\n");
  $("trace-code").textContent = event && event.line ? lines.map((line, i) => `${i + 1 === event.line ? "▶" : " "} ${String(i + 1).padStart(3)}  ${line}`).slice(Math.max(0, event.line - 4), event.line + 3).join("\n") : "Select an event to see its original PTX.\nNo event selected.";
  const card = $("evidence-card"); card.replaceChildren(el("p", v.claim_boundary));
  if (event) {
    const wait = v.waits.find((w) => w.issue === current || w.done === current);
    const work = v.work.find((w) => w.q === event.q);
    const fields = [["Event", current], ["Actor / instruction ID", `${event.actor} / ${event.instruction}`], ["PTX line", event.line || "no PTX source"], ["Per-buffer generation", work ? work.generation : "not assigned"], ["Wait target", wait ? JSON.stringify(wait.target) + " · " + wait.status : "not a wait"], ["Source", `workflow.json / ${selectedMode} / presentation.events[${current}]`]];
    fields.forEach(([label, value]) => { const p = el("p"); p.append(el("strong", label + ": "), document.createTextNode(String(value))); card.append(p); });
  }
  renderResources(seq.slice(0, step));
}
function renderResources(prefix) {
  const v = variant(), done = new Set(prefix), positions = new Map(prefix.map((id, i) => [id, i]));
  $("resource-state").replaceChildren(...[0, 1].map((buffer) => {
    const works = v.work.filter((w) => w.buffer === buffer);
    const writes = works.flatMap((w) => w.write_events.map((id) => ({id, q: w.q}))).filter((r) => done.has(r.id)).sort((a, b) => positions.get(a.id) - positions.get(b.id));
    const last = writes.at(-1);
    const pending = works.filter((w) => done.has(w.mma_issue)).map((w) => ({q: w.q, remaining: w.read_events.filter((id) => !done.has(id)).length}));
    const hazard = last && pending.some((r) => r.q < last.q && r.remaining > 0);
    const box = el("div", undefined, `buffer-state b${buffer}${hazard ? " hazard" : ""}`);
    box.append(el("h3", `B${buffer}`), el("strong", last ? `Last write: q${last.q}` : "No write yet"));
    pending.forEach((r) => box.append(el("p", `q${r.q}: ${r.remaining} read effects still pending`)));
    if (!pending.length) box.append(el("p", "No MMA reads issued yet"));
    if (hazard) box.append(el("strong", "Overwrite while old reads are pending", "danger"));
    return box;
  }));
}
$("previous").addEventListener("click", () => move(-1)); $("next").addEventListener("click", () => move(1));
$("execution").addEventListener("change", () => { step = 0; renderPlayer(); });

function ownerName(id) { const o = data.family.owners.find((r) => r.owner_index === id).owner; return `warp ${o.warp_id}, visit ${o.branch_visit + 1}`; }
function renderRule() {
  const index = Number($("rule-groups").value), group = data.family.groups[index];
  const root = $("rule-stage"); root.replaceChildren(el("h2", group.support.length ? group.support.map(ownerName).join(" + ") : "Common events only"));
  const stats = el("div", undefined, "rule-stats");
  [["Candidate pairs", group.candidate_pairs], ["Unproved pairs", group.unproved_pairs], ["Unproved required orders", group.unproved_required_orders]].forEach(([name, count]) => { const cell = el("div"); cell.append(el("strong", fmt(count)), el("span", name)); stats.append(cell); });
  root.append(stats, el("p", `${fmt(data.family.exempted_unordered_warning_pairs)} unordered pairs across the full family are exempted under A002. Zero unproved nonexempt obligations depends on this assumption.`, "assumption"));
  const details = el("details", undefined, "technical"); details.append(el("summary", "Exact group record"), el("pre", JSON.stringify(group, null, 2)), el("p", `family-h64.json / groups[${index}]`)); root.append(details);
}
data.family.groups.forEach((g, i) => { const option = el("option", g.support.length ? g.support.map(ownerName).join(" + ") : "Common events only"); option.value = i; option.selected = !g.support.length; $("rule-groups").append(option); });
$("rule-groups").addEventListener("change", renderRule);
function renderCorpus() {
  const titles = {h64: "FlashAttention h64", h128: "FlashAttention h128", deepgemm: "DeepGEMM", tk: "ThunderKittens"};
  for (const card of data.corpus.cards) {
    const a = el("article", undefined, "corpus-card"); a.append(el("h2", titles[card.id]), el("p", card.mechanism, "mechanism"), el("strong", card.verdict, "result-label"), el("p", card.positive), el("p", card.scope, "scope"));
    const filename = card.ptx.split(":")[0].split("/").pop().replace(/\.ptx$/, ".annotated.ptx");
    const sources = el("div", undefined, "source-links");
    sources.append(link("Original PTX", filename.replace(".annotated.ptx", ".ptx.html"), "button"), link("Annotated PTX", filename + ".html", "button"));
    a.append(sources);
    const details = el("details", undefined, "technical"); details.append(el("summary", "Negative control, limits & original results"));
    for (const [label, value] of [[card.negative_label || "Negative control", card.negative], ["Remaining", card.remaining], ["Source PTX", card.ptx], ["Input", card.input]]) { const p = el("p"); p.append(el("strong", label + ": "), document.createTextNode(value)); details.append(p); }
    for (const receipt of card.evidence_links) { const p = el("p"); p.append(link(receipt.label, receipt.href)); details.append(p); }
    a.append(details); $("corpus-grid").append(a);
  }
}
function renderEfficiency() {
  const e = data.efficiency; $("efficiency-intro").textContent = "Enumeration checks every admitted choice separately. The family method shares supported ordering checks.";
  for (const method of e.current_methods) {
    const card = el("article", undefined, "method-card current-method");
    const head = el("div", undefined, "method-head"); head.append(el("h3", method.name), el("span", method.status, "status-tag"));
    const claim = el("p"); claim.append(el("strong", "Method: "), document.createTextNode(method.claim));
    const result = el("p", method.result, "method-result");
    const boundary = el("p"); boundary.append(el("strong", "Boundary: "), document.createTextNode(method.boundary));
    card.append(head, claim, result, boundary); $("current-methods").append(card);
  }
  for (const row of e.rows) {
    const time = (a) => a.status === "complete" ? `${a.time.toFixed(2)} s [${a.range.map((n) => n.toFixed(2)).join("–")}]` : "incomplete";
    const rss = (a) => a.memory ? a.memory.median_gib.toFixed(2) : "—";
    const tr = el("tr"); [row.visits, time(row.enumeration), time(row.family), `${rss(row.enumeration)} / ${rss(row.family)} GiB`, `${row.enumeration.stop} / ${row.family.stop}`, row.verdict, row.speedup == null ? "—" : row.speedup.toFixed(2) + "×"].forEach((v) => tr.append(el("td", String(v)))); $("efficiency-body").append(tr);
  }
  const first = e.rows.find((r) => r.visits === 1);
  if (first && first.speedup != null) $("cost-highlight").append(el("strong", `${first.enumeration.time.toFixed(2)} s → ${first.family.time.toFixed(2)} s`), el("p", "One visit per warp. Both methods complete; the family method uses more memory. Larger incomplete runs have no speedup claim."));
  for (const method of e.historical_methods) {
    const card = el("article", undefined, "method-card");
    const head = el("div", undefined, "method-head"); head.append(el("span", `§${method.id}`, "method-id"), el("span", method.status, "status-tag"));
    const decision = el("p"); decision.append(el("strong", "Current decision: "), document.createTextNode(method.decision));
    card.append(head, el("h3", method.name), el("p", method.idea), decision); $("historical-methods").append(card);
  }
  for (const source of e.sources) $("efficiency-sources").append(link(source.label, source.href, "button"));
  $("efficiency-notes").append(...e.notes.map((n) => el("li", n)), el("li", "Table memory order: enumeration / family; sampled peak RSS median. Time shows median [minimum–maximum] over five measurements."));
}
function renderLimits() { for (const text of ["Arbitrary tensor feedback", "Arbitrary loop length", "Full cross-output family", "Exact SM90 WGMMA semantics", "Whole-kernel numerical equivalence", "Hardware execution", "All 28 historical cases"]) $("limits-grid").append(el("p", text)); }
$("contribution-scope").textContent = `Checked model families: h64 ${data.family.choice_count} combinations; h128 ${2 ** data.corpus.raw.h128.owners.length} combinations. Fixed common control and resolved addresses; arbitrary tensor inputs remain unproved.`;
window.addEventListener("hashchange", showView);
chooseMode("legal"); renderRule(); renderCorpus(); renderEfficiency(); renderLimits(); showView();
