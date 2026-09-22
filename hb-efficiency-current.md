# Native HB query preservation and cost

## Current family experiment contract

The new efficiency question is whether the supported-region rule can check the
same admitted execute/skip family more cheaply than separately verifying every
choice. This is distinct from the fixed-graph experiments below. The demand is
the team's reported reachability/scalability bottleneck and the repeated rescale
branch whose supplied configuration selects only one choice sequence.

Use the pinned h64 PTX and one full 512-thread CTA. N means the actual audited
visits to branch 3892 per correction warp, with four independent warps and
2^(4N) choice vectors. Test N=1,2,3,8,16,32,64,112. The candidate one-output K/V
length is 128*(N+1); actual native visit audits must confirm it. Preserve the
original bootstrap, tail, epilogue and semantic assumptions.

Baseline: enumerate the complete family through the native frontend/verifier.
Method: extract skip and execute, reconstruct the projection and admission,
then run the complete supported-order checker. Both arms start from PTX and
input; include every required template/preparation step and artifact I/O.
Neither a single all-execute run nor cached-only ordering is an equal-coverage
baseline. Report analysis-only measurements separately if collected.

Run one warmup and five measurements per arm, alternating arms. Each entire
family trial has 120 seconds and 8 GiB across its process tree, including all
child extractions. After a direction reaches a resource limit, retain the
partial count and stop its larger N values. Only five completed matched trials
permit a speedup statistic; otherwise report completion versus resource limit.
Report median and range, complete conflict/lifecycle counts, actual visits,
assumptions, phase costs, wall time and peak process-tree RSS. No SMT phase is
present in this current constant-address path.

The store-wait deletion remains a separate negative control. An unproved pair
is not a feasible bug witness. For output boundaries, equal total KV work does
not imply equal choice counts: each output has its own bootstrap, so the
correction visits are sum(L_o-1). Compare baseline and method within each fixed
output configuration, and describe cross-configuration costs separately.

Native `family_order` now emits disjoint stage wall intervals for artifact
binding, native preprocessing/synchronization, supported graph construction,
candidate collection and HB checking. The last includes support filtering,
index construction and exemption classification. End-to-end process timing
also includes final serialization and preparation outside this executable.
The existing one/two-round diagnostics are not this repeated experiment.

`probe.cpp` measures Wasp's existing batched-bitset and DFS reachability
implementations on the same native conflict-order obligations. It introduces no
new reachability algorithm or cache. Inputs are real frontend-produced source
artifacts; synchronization certification and memory checking run through
`AnalyzeSourceArtifact`.

## Build and invoke

From the repository root, after the normal native build:

```sh
c++ -std=c++20 -O3 -Wall -Wextra -Wpedantic -Werror \
  -Icpp/include -Ivendor/nlohmann_json/single_include \
  research/hb-efficiency/probe.cpp \
  build/cmake/libspverify_io.a build/cmake/libspverify_algorithm.a \
  -o build/hb-efficiency-probe

build/hb-efficiency-probe --source PATH/source.json --algorithm bitset \
  --verify-answers --observations PATH/query-answers.jsonl
build/hb-efficiency-probe --source PATH/source.json --algorithm dfs
```

The experiment runner must impose the 120-second / 8-GiB process limits; the
probe itself is instrumentation without a resource watchdog. `--batch-size`
defaults to the native 65536. A different size is a separate experiment.

## What is preserved

Every submitted directed `(from, to)` query retains its original position and
answer. `--verify-answers` compares each answer with the existing DFS index on
the same immutable graph, outside the measured HB component. Any mismatch is
fatal. The full optional JSONL records each batch as ordered
`[from, to, answer]` triples. Query, answer, and batch-length sequence digests
are FNV-1a diagnostics, not cryptographic proofs or substitutes for direct
answer comparison. Independent finite-schedule calibration remains a separate
semantic check: DFS and bitset agreement only checks graph reachability.

The memory checker uses `continue_after_race=true`, one retained witness, and
`duplicate_tma_store_benign=false` (A002 disabled) for strict conflict-order
search. Every other semantic assumption remains in the native report.
Conflict-order preserves race existence under its documented model contract;
it does not enumerate all conflicting access pairs. The full native report,
including verdict, synchronization failures, limitations, and witness, is
embedded unmodified. A process exit of zero does not establish `race_free`:
the runner must inspect the native status and confirm HB was reached.

## Costs and observations

`probe.hb_seconds` times only the selected implementation's `reachesBatch`;
`index_seconds` measures its construction. `oracle_seconds` includes DFS oracle
construction and calls. Duplicate accounting, digesting, and optional JSONL
serialization are outside HB time. `wall_seconds` includes all probe work
inside native analysis, so it is an instrumented runtime, not the unmodified
CLI runtime. Peak RSS includes instrumentation and the oracle when enabled.
Use separate preflight and timing runs. `SPVERIFY_PROFILE=1` emits native phase
profiles on stderr; its memory/HB scope includes the wrapper overhead and must
not be confused with `probe.hb_seconds`.

Repeated event pairs arise when partial footprint overlap produces the same
ordering obligation in multiple spatial slabs. Within a batch the existing
bitset implementation already shares propagation by source. Duplicate-pair
counts therefore do not directly count avoidable graph traversals. Measure
cross-batch repetition and actual cost before proposing a cache.

## Scale experiment and observed limits

```sh
build/venv/bin/python research/hb-efficiency/benchmark.py --output build/hb-efficiency-new
build/venv/bin/python research/hb-efficiency/summarize.py build/hb-efficiency-new
```

The saved 21 September run is `build/hb-efficiency/results-with-phases.json` and
`build/hb-efficiency/SUMMARY.md`: 45 fixed inputs spanning lengths
1,2,3,8,16,32,64,112, one/two outputs where possible, fixed roles, legal tail,
and work-identity mismatch. Each case has one direct-answer preflight, then
one warmup and five measured runs for each algorithm. Every recorded case
preserved the ordered queries, answers, native verdict and retained witness.
No case reached the 120-second or 8-GiB limit. Work-identity mismatch is a
negative control for task agreement; the race verdict remains `race_free`.

For the single-output N112 tail case, the native graph has 43,178 events,
125,739 direct edges and 96,128 submitted queries. Median HB time is 6.532 ms
for DFS and 4.004 ms for bitset. Instrumented native wall time is 253.903 ms
and 252.323 ms respectively, with overlapping ranges. This supports a local
query-cost difference, not a meaningful whole-verifier speedup. Bitset is
already Wasp's default. Its native synchronization phase takes a median
86.008 ms here; the remaining wall time also includes parsing, lowering,
other checks, reporting and probe instrumentation.

Of 96,128 queries, 31,519 repeat within a batch and only 55 repeat across
batches. The existing propagation already shares work by source within a
batch. An additional exact-pair cache therefore has weak motivation in these
workloads and has not been added. This negative optimization result is retained.

This experiment measures native analysis after frontend extraction. Frontend
cost is recorded separately once per input, not five times, and is not included
in a claimed end-to-end speedup. The separate default-path measurements below
close the missing full-pipeline timing matrix.
[Native event-model witness replay](../loop-reuse/NATIVE-REPLAY.md) is now
available for three conflict controls; it does not prove PTX refinement.
Clean-environment replay and a general region-summary optimization remain
separate obligations. No SMT is used here.

## Full default PTX pipeline

```sh
build/venv/bin/python research/hb-efficiency/endtoend.py \
  --inputs build/hb-efficiency --output build/hb-endtoend-new
```

The 21 September run in `build/hb-endtoend/results.json` and `SUMMARY.md`
executes all 45 saved PTX/config inputs through `run_ptx`, each with one warmup
and five measured runs. Every invocation reparses the PTX, specializes control
flow, builds the source program, and runs native verification. Input SHA256s,
full reports, commands, stderr profiles, process wall time, native pipeline
time and peak RSS are retained. Each native process has a 120-second pipeline
deadline, a 120-second WellSync deadline, and an 8-GiB RSS limit. All 270 runs
completed `race_free` with complete search, no unresolved/source violations or
verification limitations, and stable findings/counts/assumptions within each
case. This still accepts the work-identity negative controls: task agreement
is a separate obligation.

This experiment uses the **default conflict-first strategy**, default
batched-bitset, A002 enabled, and no continue/exhaustive override. The strict
probe above uses **conflict-order**, A002 disabled, and continues after a race.
Their submitted check sets differ. They must not be compared as an
end-to-end speedup, or used to infer that the default path has the probe's
small HB cost.

For N112 tail, the default path submits 2,216,264 HB queries. Median process
wall time is 223.772 ms (222.822–226.450), native pipeline time 215.506 ms
(214.884–218.678), and peak RSS 59.500 MiB (58.656–61.125). The native profile
records frontend dynamic processing at 12.003 ms, synchronization at 86.466 ms,
and memory checking at 93.757 ms, including 74.059 ms of HB query time.
Phase scopes nest and may aggregate worker activity; their medians must not
be summed as an exact wall-time decomposition. Profiling remains enabled.

The 96,128-query strict-probe result therefore leaves a concrete efficiency
question: when can the smaller conflict-order obligation set safely serve
the default configuration's assumptions and reporting contract? Answering
that requires a semantic argument and matching experiments; these timings
alone do not license changing the strategy or disabling A002.

## Why an exempted write breaks the existing shortcut

`exemption_counterexample.cpp` constructs a native `SourceProgram` with two
identical same-warp, different-lane dense TMA copies, and a destination read
that depends only on copy 1's completion. Native WellSync accepts the source.
Native access extraction and `DuplicateTmaStores::contains` identify the two
writes as A002 duplicates; the example does not assign that label manually.

```text
Topological order:       W0       W1       R
Actual HB:                        W1 ----> R
A002 duplicate pair:     W0 ----- W1       (no HB edge)
Unordered nonexempt pair: W0 -------------- R
```

Full native conflict selection emits W0/W1, W0/R and W1/R. The unmodified
checker, with A002 enabled, reports W0/R as a race. The existing conflict-order
stream emits only W0/W1 and W1/R. If its failed W0/W1 obligation were discarded
as a duplicate-store warning, no remaining obligation would detect W0/R.
The shortcut relies on actual HB transitivity; an exempted conflict is not an
HB edge. This demonstrates why simply removing the A002 strategy guard would
be unsound. Native algorithms are unchanged by the experiment.

```sh
c++ -std=c++20 -O3 -Wall -Wextra -Wpedantic -Werror \
  -Icpp/include -Ivendor/nlohmann_json/single_include \
  research/hb-efficiency/exemption_counterexample.cpp \
  build/cmake/libspverify_algorithm.a -o build/hb-exemption-counterexample
build/hb-exemption-counterexample
```

The program checks the selected rank against every actual HB edge, validates
the unmodified checker's exact W0/R witness, and exits with failure if the
claimed counterexample does not hold. The saved output is
`build/hb-exemption-counterexample.json`. This establishes a native-IR API
counterexample, not a compiled PTX/kernel witness: the observer's
completion-before-issue dependency is explicit in the constructed source.

## Guarded selection with the assumptions held fixed

`MemoryRaceOptions::allow_conflict_order_without_tma_store_exemptions` is a new,
default-off opt-in. It admits the existing shortcut when the actual
`DuplicateTmaStores` classifier has no eligible instructions. This is a
conservative absence proof: every `contains()` lookup then fails. A nonempty
classifier always falls back, even if it contains only one eligible instruction.
All original atomic, exhaustive, witness-count and strategy gates remain.
The existing continue-after-race restrictions are unchanged.

The property preserved is race existence under unchanged semantic assumptions,
not every requested query or the first retained witness. No exemption applies
on the admitted path, so warnings remain absent. If the memory model cannot
provide exact conflict-order constraints it falls back to normal candidate
selection. C++ regressions cover ordered, racing and unresolved cases, eligible
store fallback, three duplicate-store warnings and the other selection gates.
All 56 native tests pass. Independent review found no P0/P1 issue.

```sh
c++ -std=c++20 -O3 -Wall -Wextra -Wpedantic -Werror \
  -Icpp/include -Ivendor/nlohmann_json/single_include \
  research/hb-efficiency/selection.cpp \
  build/cmake/libspverify_io.a build/cmake/libspverify_algorithm.a \
  -o build/hb-selection-probe
build/venv/bin/python research/hb-efficiency/selection.py --output build/hb-selection-new
```

The saved `build/hb-selection/results.json` covers 45 scale cases and three
read/write conflict controls, one warmup and five measurements per mode.
All 576 runs preserve status, assumptions, warnings and unresolved obligations;
the requested mode and actual strategy were also checked in every saved report.
The source artifacts, stop policy, memory model and bitset backend are identical
between off and on. Only this opt-in changes. No all-pairs count or exact
first-witness identity is claimed for this comparison.

For N112 tail, queries fall from 2,216,264 to 96,128. Native wall time falls from
308.227 ms (306.789–310.870) to 232.179 ms (230.587–238.595); HB query time falls
from 74.036 ms to 4.089 ms. These are local source-artifact-to-report measurements,
including JSON input parsing, with no frontend time or probe duplicate-accounting
wrapper. They must not be numerically combined with the separate default full
PTX pipeline run. The opt-in is now also exposed by the native/Python PTX CLI as
`--allow-conflict-order-without-tma-store-exemptions` and the matching `run_ptx`
keyword. It remains default-off and requires verification mode.

`ptx_selection.py --output FRESH_DIRECTORY` freezes three real corpus inputs,
binary/input hashes and the comparison contract before measuring one warmup and
five alternating off/on repetitions under 120-second/8-GiB process limits.
It reuses the full-pipeline interface and timing summary helper; first witnesses
and query sets are explicitly outside the equality contract. Results in
`build/hb-ptx-selection-20260921` show unchanged `conflict-first` on ThunderKittens
BF16 B200 GEMM and CUTLASS86, while CUTLASS112 reaches the RSS limit in both
paired warmups. This run establishes no real-corpus optimization speedup.
The retained `TK-FALLBACK.md` explains why four eligible single-lane TMA stores
block the conservative guard despite zero actual duplicate-store warnings.

## Repeated conditional families and output boundaries

`family_scale.py` compares complete fixed-choice enumeration with the supported
family checker, including fresh frontend extraction, template construction and
admission. Both directions retain the same 120-second / 8-GiB whole-process-group
budget, one warmup and five measurements. No speedup is reported without both
complete five-measurement results under the same assumptions.

```sh
build/venv/bin/python research/hb-efficiency/family_scale.py \
  --lengths 2 --outputs 2 --family-executable build/cmake/spverify-family-order \
  --output build/hb-family-two-outputs-new
```

`--family-executable` defaults to `build/family-order`; select the actual built
binary explicitly when using CMake. N counts total correction visits per warp
across outputs. Outputs must evenly divide N, with at least one visit per output,
and fit the original scheduler domain. The one-visit body template always uses
one output. The contract records outputs, KV tiles per output, total KV work and
the full independent per-warp choice domain.

For two outputs and N=2, each output has two KV tiles and one correction visit:
four KV tiles total and 256 choice vectors. The single-output N=3 workload also
has four KV tiles, but 4,096 choices. These are matched-work cohorts, not equal
choice domains; their wall-time ratio is not an optimization speedup. Baseline
versus family is compared only within one input. Existing single-output timeout
receipts remain valid and should not be rerun merely to form this comparison.

Every multi-output baseline choice and both family extraction endpoints audit
actual SourceIR milestones: softmax final arrive (PTX 3797), correction arrives
(4176–4177), MMA commits (1197/1202), producer Q load (415), and output store
(283). Each required actor must have exactly occurrences 0 through outputs−1.
Missing actors, occurrences or changed source identities reject the trial.
This establishes cross-participant protocol progress, not mathematical task
agreement or numeric equivalence. Family projection and admission remain
separate mandatory checks; matching milestone counts alone never admit a family.

Baseline source dumps for this cohort are temporary: each is checked, hashed,
and replaced by its compact `choice-*.output-progress.json` receipt. Family
SourceIR artifacts are retained. Export, parse, audit and cleanup costs are
inside the trial budget. This instrumentation differs from the old single-output
campaign and is explicitly recorded; it must not be described as pure HB time.

The first two-output campaign is retained in `build/hb-family-two-outputs-v1`.
Baseline warmup reached 120 seconds after 8/256 choices. Family warmup passed
the progress audits, projection and admission, then timed out during native
ordering after 109.985 seconds of preparation. Neither arm supplies a completed
measurement or a cross-output family safety certificate. A parent cleanup EPERM
then prevented serialization of the family wall-time and peak-memory receipt;
these metrics remain unknown. `INTERRUPTION.md` identifies the surviving worker
timeout evidence. Do not pass this partial result to the completed-report
finalizer or extrapolate a speedup. The cleanup race is now guarded and covered
by regression tests; the stopped directions are not rerun.

The separate completed single-output campaign is in `build/hb-family-scale-v1`;
its reviewed export is `build/loop-branch-current/completed-costs-v2.json`.
N1 end-to-end medians are 56.9768 s enumeration and 50.5339 s family (1.1275x),
with sampled peak process-group memory medians 0.81 and 4.07 GiB respectively.
N2 family completes at 103.7329 s / 6.07 GiB; enumeration times out after
25/256 choices. N3 family also times out. Larger scales remain unrun under the
stop contract; the current implementation has not solved scaling to N112.

## Partial-address candidates: a separate, default-off experiment

The varlen diagnosis distinguishes graph construction from memory-pair work.
Retained timeout profiles spend about 93--102 seconds in `memory.scan` and only
0.16 seconds in HB construction. The constant model currently declines its
entire candidate stream on any missing footprint or ambiguous allocation alias;
the checker then scans unordered pairs globally. This is not evidence for a
new reachability backend or another exact-pair cache.

The proposed opt-in `--partial-address-candidates` preserves the existing
resolved interval stream and adds every potentially conflicting pair involving
an unresolved footprint or cross-allocation alias. Unknown remains Unknown.
It leaves the exact conflict-order shortcut, A002 duplicate-store exemptions,
atomic rules and default behavior unchanged. The mathematical check is set
equality: emitted pairs must equal all nonempty, different-event, at-least-one-
write pairs for which the existing `mayOverlap` is not Disjoint. Full small
checker comparisons must preserve the race, unresolved and warning sets.

Before performance promotion, freeze the exact corrected K160 varlen input
without output strides in `build/corpus-loop-branch-varlen-corrected-v1/nonempty/`.
It has real work and unresolved output addresses. Compare only the opt-in,
with a 120-second / 8-GiB whole-run cap. Its retained default timeout is a limit,
not a completed runtime or an extrapolated speedup. First run one diagnostic;
if it finishes, one warmup and five fresh measurements are needed for timing
claims. Stop the optimized direction if it hits a limit. Source export and
frontend/native processing must match; do not compare artifact-only time with
PTX-to-result time. A verdict/sample change requires replay or complete small-
input comparison, not a claim of equivalence from labels alone.

Separately, the missing varlen output strides were confirmed as a configuration
gap. Supplying the two source-authenticated strides completes default native
checking on the same nonempty task. That result is input preparation, not
evidence that this optimization is necessary. It is recorded as a new input
and is not combined with the opt-in in a performance comparison.

**Observed diagnostic, direction stopped:**
`build/corpus-loop-branch-varlen-partial-candidates-v1/nonempty/` reaches the
120-second limit with no final verdict (sampled process-group peak 2.58 GiB).
The final retained stderr profile at 119.491 s confirms the new conflict-first
path: 650 completed HB batches, 42,532,864 candidate pairs submitted,
114.608 s in `memory.hb_batch`, and 28,242,134,135 edge visits. These are partial
work counters, not a complete check-set size. The old default also timed out;
neither result supports a speedup ratio. No repeated measurements or larger
inputs are run after this limit. The prototype remains default-off and is not
a recommended performance improvement for this input. Local build/test
validation overlapped this diagnostic; it is not an isolated timing trial.
The timeout is the observed limit, not a controlled comparison of throughput.

Sixty randomized candidate-set comparisons and complete small checker finding-
set comparisons (race, Unknown and A002 warning; atomic exemption; DFS/bitset)
pass, with an independent review finding no P0/P1. This supports semantic
conservation within those tests; it does not turn the timed-out real input into
safe or establish a scalability breakthrough. The separately completed
corrected-stride input is documented in `../corpus-loop-branch/README.md`.
