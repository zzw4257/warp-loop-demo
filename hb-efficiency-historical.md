# HB efficiency under loop and branch expansion

Source-grounded continuation record, 2026-09-15. This document reconstructs completed experiments and implementation directions; historical timings are read from saved receipts, not newly measured. The [loop/branch source record](loop-branch-discussion.md) supplies the underlying kernel analyses. The [research design](research-design.md), Sections 5–6, supplies the earlier proof-development history.

## 1. What grows, and what the graphs look like

### Wasp continuation, 2026-09-18

The executable continuation is `/Users/zzw4257/wasp-loop-branch-research/examples/loop_branch/`. Its six-section `report.tex` and `build/loop-branch-delivery/report.pdf` connect this history to the current native query-reuse experiment. The viewer's HB cost view shows actual sibling event IDs, their equal direct predecessors and shared strict ancestors, followed by the resource-v3 measurements. Event identities and the full access-pair sequence remain separate and unchanged.

This continues the concrete reachability direction. It does not migrate the historical rank/SMT encoding or resolve its `unknown` outcomes. The current concrete-address path invokes no SMT solver. The small running example uses the eager cache with zero reuse hits; at 64 work items the lazy regime benefits. Both 112-item equality prechecks remain incomplete at 120 seconds. Historical 200-query timings remain a narrower observation set and are not a full-check speedup baseline.

`demo.py` regenerates PTX and invokes the native verifier for edited small output partitions. Its pages retain the original resource-v3 benchmark as a separately labeled fixed experiment; a live input edit does not rerun the performance sweep.

There are several different objects whose sizes matter. A dynamic event is one occurrence of a modeled instruction or hardware effect. An action is one semantic transition; a collective action can complete several events together. A direct order graph stores immediate constraints. Its transitive closure stores every reachable ordered pair. A conflict inventory lists accesses requiring checks. A symbolic formula represents possible schedules and bad observations. A local Q/P proof domain contains assignments used to check translation rules. These quantities cannot be substituted for each other.

### 1.1 Repeated pipeline work produces a ladder with reuse connections

For a fixed S-buffer producer/consumer protocol, the control projection is:

```text
Producer: wait empty for old use -> issue TMA -> advance its own state
Hardware:                    TMA writes -> completion contribution
Consumer:                          wait full -> issue MMA -> advance
Hardware:                                            MMA reads -> completion
Release:                                                       empty signal
```

The characteristic cross-iteration connection is:

```text
old use g-S:  MMA read -> completion -> empty contribution
                                             |
                                  successful matching wait
                                             v
new use g:                         producer wait -> TMA issue -> write
```

This diagram displays a required, source/model-bound chain. It does not authorize inserting a reuse edge merely because reuse should be safe. The historical experiment recovered the chain from actual executed wait-match records.

For S=12, the same-buffer streams are:

```text
buffer 0:  use 0 -> use 12 -> use 24 -> ... -> use 108
buffer 1:  use 1 -> use 13 -> use 25 -> ... -> use 109
...
buffer 3:  use 3 -> use 15 -> use 27 -> ... -> use 111
buffer 11: use11 -> use 23 -> use 35 -> ... -> use 107
```

With fixed work per iteration and fixed participants, the event count usually grows linearly with the unrolled length. Direct dependencies may also remain sparse. Reachable pairs can grow quadratically: even a chain of n nodes has n(n-1)/2 ordered pairs. This mathematical example explains why a sparse-looking timeline can be expensive when all reachability is materialized. It is not a measured scaling law for every kernel.

### 1.2 A repeated branch can enlarge choices without multiplying source sites

```text
iteration j:    common prefix
                   /    \
            guard false  guard true
                |        optional access / fence / completion wait
                   \    /
                common arrival
                      |
                iteration j+1
```

A fixed role predicate may simply select a path before analysis. A runtime predicate introduces feasible alternatives. With b independent binary decisions, explicit path enumeration has up to 2^b assignments; real predicates often have correlations that reduce this set. A guarded representation can share source structure, while satisfiability still has to respect feasible combinations.

The head64 `should_scale_o` example preserves a selected mbarrier-arrival projection while changing TMEM accesses and ordering events. A fixed barrier projection therefore does not establish an exact fixed full event graph. The LCSF polling example also shows that differing successful-action order alone does not imply a fixed DAG is impossible: two unordered nodes already express both orders. See cases C1, C2 and C5 in the source record.

No historical runtime-branch scaling curve is claimed below. The main 112-iteration measurement has zero runtime branch choices in its admitted model.

### 1.3 A boundary can change the repeated unit

```text
prologue -> steady x (L-1) -> tail -> next output
              |              |          |
           QK + PV       final PV    main ring continues
                        output handoff has its own counter
```

Output boundaries, partial K, and optional work can change issue multiplicity, completion membership, or the task domain. A repeated source body does not justify deleting middle occurrences. Any summary has to preserve the state still observable by future waits and accesses.

## 2. The actual 13-to-112 experiment and its size

The verified historical sequence is **13 -> 112**, from an authenticated finite prefix to the full selected mainloop domain. The records inspected for this note do not identify a separate experiment named “3 -> 112.”

### 2.1 Exact input

The fixed specialization is rooted at:

```text
research_cases/analysis/generated/deepgemm-census-replay-v1/cache/
kernel.sm100_bf16_gemm.45a25c62550290feda3baad9967a7205/kernel.cu
```

Its source family is DeepGEMM revision `559d79fb6994a58b8a15b4b93bf13ccc16edf247`, `deep_gemm/include/deep_gemm/impls/sm100_bf16_gemm.cuh`, especially lines 183–205 and 280–365. The fixed-control fixture is `research_cases/test_qp_contributor_subset_quotient_v4.py:131`; control recovery is in `formalization_v4/deepgemm_control.py`.

The selected workload is M=128, N=2112, K=7168, tile 16x128x64, 12 stages, 148 CTAs, CTA 0. K/64=112. The grid has 136 output tiles, so the selected CTA processes one output. There is no partial K block in this input. The admitted model has fixed role choices and zero runtime branch choices. It cannot provide experimental evidence about multiple output boundaries or data-dependent branch exploration.

### 2.2 Measured inventories

Source: `build/research-design/deepgemm-reuse-hb-v2.json`, fields `inventory`, `completed_steps`, `static_hb_access`, and `complete_state_queries`.

| Object | Recorded size | Interpretation |
|---|---:|---|
| Mainloop occurrences | 112 | Full selected K-block domain |
| Physical pipeline stages | 12 | Reused storage/barrier positions |
| Modeled events | 3,114 | Includes distinct software/hardware effects |
| Actions on the complete replay | 3,094 | Collective actions account for the event/action difference |
| Raw order edges | 4,676 | Stored program-order basis |
| Order plus collective basis edges | 4,763 | Basis count recorded by the observer audit |
| Static HB closure pairs | 1,693,241 | Reachable pairs, not direct edges |
| Original potential conflict pairs | 9,700 | Full model inventory |
| Executed wait-match records at terminal state | 216 | Retained dynamic matching history |
| Adjacent same-buffer A/B reuse checks | 200 | A selected subset of the 9,700 pairs |

The 200 checks come from 112-12=100 adjacent same-buffer reuses, each checked for A and B. They all retain the full program and wait history. This is not a 200-event compressed model.

```text
3,114 events
    + 4,763 order/collective basis edges
    -> 1,693,241 static reachable pairs

9,700 potential conflicts
    -> 200 selected adjacent-buffer diagnostic queries
       (the rest remain part of complete verification)
```

### 2.3 Inspecting the timeline before and after a wait

The diagnostic sampled wait-before, wait-after and overwrite-after states. For reuse g=24, buffer 0 previously belonged to use 12, with empty epoch 1/parity 1. At g=108 it previously belonged to use 96, with epoch 8/parity 0. Full epoch identity survives parity repetition.

```text
before successful wait: barrier may have completed; this observation edge absent
after successful wait: old reader -> wait is licensed by actual contributors
after new write:        both access endpoints done; complete protection chain visible
```

Removing the selected wait-match record from an observation copy removes the recovered order in the selected controls. That copy is an observer sensitivity test, not a reachable program mutation. The diagnostic reconstructs existing HB; it does not add readiness as memory order.

## 3. The efficiency directions actually attempted

### 3.1 Restrict the local proof domain to a justified epoch

**Cost addressed:** checking that Q actions and P actions preserve the same behavior. Q is the action-level intermediate representation; P is the concrete finite protocol/event program in the existing framework. This proof is separate from asking whether P is safe.

An unconstrained local proof domain combines remaining counts, transaction balances and arbitrary subsets of contributors. If a barrier has m possible historical contributors, arbitrary subsets contribute a 2^m factor before other dimensions. Across a long loop, many of these combinations mix different epochs or violate bookkeeping.

The implemented exact-epoch approach proves that the current active contributors belong to the current epoch group G(b,g), preserves their identities, and derives the counters from those members:

```text
active C subset of G(b,g)
remaining arrivals = capacity - sum(arrival_weight(e) for e in C)
transaction balance = sum(transaction_delta(e) for e in C)
retain exact release history and whether the previous phase was observed
```

The benefit is a smaller justified proof domain. It still enumerates concrete subsets inside the current group. It does not replace all contributors by a count, erase old HB, or remove loop iterations. Signed transaction behavior is retained according to the existing model; the proof must not silently strengthen it into a new hardware assumption.

Implementation: `formalization_v4/counter_epoch.py`, `formalization_v4/cext_simulation.py`; historical family work: `formalization_v4/generation_action_equivariance.py`.

Recorded outcome: the full 112-domain Q/P construction checked 3,094 actions, 100,857 local assignments and 75,568 executable local transitions. These are proof enumeration counts, not global reachable-state counts. Exact certificate reconstruction passed in a fresh process after canonicalization of unordered serialization. Source: `counter-epoch-full-qp-v2.json`, `counter-epoch-qp-replay-v2.json`.

**What earlier attempts taught us.** Generation-action equivariance transfers proofs across corresponding action families but does not eliminate the contributor combinations inside a representative. A count-only quotient experiment failed locally; later inspection found its claimed phase-closing sample had nine positive arrivals in a capacity-one barrier and a negative remaining count. It was not a normal reachable phase closure. The later glue construction used a complement W minus O; that set identity did not prove that adding missing HB endpoints was authorized. The corrected route restricts states using preserved invariants and retains identity-sensitive observations.

### 3.2 Represent schedules by ranks and a bad-prefix cut

**Cost addressed:** explicit global schedule/state enumeration for a fixed finite P.

The strict-rank encoding assigns one integer rank to each action, with a global distinctness constraint. A cut identifies the executed prefix. Constraints describe readiness, barrier state, wait success, resources and selected bad observations at that cut.

```text
rank[a] in [0, number_of_actions)
Distinct(all action ranks)
done(event e at cut) <=> rank[action(e)] < cut
legal execution-prefix constraints
terminal_error OR memory_error OR deadlock_at_cut
```

Ranks are schedule positions, not barrier generations and not the HB relation. Two accesses receive a temporal order in a candidate execution while remaining unordered by synchronization; serial placement alone cannot prove race freedom.

Implementation: `formalization_v4/direct_symbolic_rank.py`, `verify_direct_symbolic_rank`, rank/cut construction around lines 503–544 and result/replay handling around 1051–1135. The historical research tree also contains `research_cases/formalization_v4/` versions; a receipt's implementation hashes determine which version produced it.

This approach moves scheduling choices into an SMT formula. The formula still contains the full finite action domain. More iterations increase variables, counter expressions, wait matching and observation work. It is not a parameterized loop proof.

### 3.3 Share HB reachability expressions through wait interfaces

**Cost addressed:** expanded symbolic HB formulas repeatedly building related paths for many access pairs.

The `rank_witness` implementation first uses static reachability to identify how queried sources can reach contributor events. Sources with identical interfaces share a signature. Each wait receives a bit-vector reachability variable whose bits correspond to distinct source signatures. Reachability propagates through symbolic wait-match edges, restricted to increasing action ranks.

```text
source accesses -> source signatures -> initial masks at waits
                                            |
                                   dynamic wait-match edges
                                            v
                                  one reach mask per wait
                                            |
                            target interfaces -> HB query answers
```

The recurrence has the explanatory form:

```text
mask[w] = initial[w]
          OR union(mask[u] when edge(u,w) AND rank[u] < rank[w])
HB(x,y) = done(x) AND done(y)
          AND (static_path(x,y) OR reachable_source_bit_at_target_interface)
```

The strict rank condition prevents an ungrounded cyclic reachability justification within this encoding. The implementation uses equations tying masks to support, not arbitrary guessed HB bits. Completion and wait-match semantics still determine which dynamic edges exist.

Actual source: `formalization_v4/direct_symbolic_rank.py`, `_rank_witness_happens_before`, around lines 1691–1893. It uses Z3 integer, Boolean and bit-vector expressions. This is strongly coupled to the rank encoding and its correspondence proof.

### 3.4 Reduce symbolic wait-match alternatives using certified generation releases

If a successful wait's generation has a proved exact contributor group, the encoding can use that partition rather than consider unrelated candidate contributors. This simplifies symbolic matching without changing the underlying loop length or original error classes.

Historical full-input comparison:

| Configuration | Formula build | Wait-match entries | Solver outcome |
|---|---:|---:|---|
| Original expanded HB | Exceeded formula budget | — | Formula incomplete |
| Rank-witness HB, before certified partition | 20.211 s | 5,132 | `unknown`, 149.521 s recorded solve time |
| Rank-witness HB with certified generation partition | 14.776 s | 552 | `unknown`, 120.326 s recorded solve time |

The first row is preserved by the research-design history. Numeric rows are from `counter-epoch-finite-verifier-v2.json` and `v3.json`. Budgets/configurations differ; no solver speedup is claimed. Formula construction improved, while the large satisfiability query remained unresolved in those runs.

The v3 receipt records 216 mask variables, 326 source signatures, 70,416 auxiliary bits, 216 mask equations and 7,000 shared HB queried pairs. The 7,000 queries comprise 6,960 race queries and 40 publication queries; they are not the same object as the 9,700 potential conflict inventory. There are 10,548 wait-interface edges. A compact variable count can still encode a substantial logical problem.

### 3.5 Factor observations and represent query pairs compactly

The existing implementation has `factor_race_observations` and `factor_publication_connectors` options. They reuse common HB/publication expressions. Publication connector factorization uses bitmask intersection. Pair-ledger rectangles compactly describe repeated Cartesian sets of query endpoints where the ledger's exact conditions permit it.

```text
repeated questions: (a0,b0), (a0,b1), (a1,b0), (a1,b1)
shared description: {a0,a1} x {b0,b1}
required: preserve the exact pair set and each observation condition
```

A rectangle is an explanatory representation pattern here, not a claim that all kernel conflicts form rectangles. The implementation in `formalization_v4/observation_interface.py` groups endpoints by owner, proxy, region and operation kind, and stores explicit exclusions from each Cartesian product. It reconstructs the exact pair set and compares it with the original. Exclusions can themselves become large. Sharing a subexpression must retain done conditions, proxy direction, region membership and all original queries. Smaller storage alone does not establish faster solving.

Historical status: exact observation factorization and pair representations are positive implementation directions in the level-07/frontier work. Six small-program correspondence checks do not establish a full real-kernel performance result. See research-design Section 6 and the named options in `direct_symbolic_rank.py`.

### 3.6 Query concrete HB without rebuilding every ordered pair

**Cost addressed:** observing a concrete P state, including witness inspection and publication/race queries.

`phaseguard/semantics.py::_reachable_events` starts from static successors of a source event, filters by done, and propagates through the state's real wait matches until no new event becomes reachable. An access-source traversal can serve multiple target checks.

This path has no SMT solver call. It retains events and wait history. Some consumers already reuse per-source queries; other publication observers still request a full graph.

The saved 112-domain diagnostic measured approximately 0.458 s for the first targeted query, including approximately 0.452 s establishing a lazy static successor index. At the complete state, two rounds of 200 queries took 0.405688 s and 0.404989 s. A separate process reconstructing/replaying the program and then calling full `happens_before` did not finish inside its total 20-second budget. The log reached the full-HB stage. That budget included setup; it is not a measured 20-second solver call or a standalone HB-call time.

These tasks have different output sizes. Dividing the timings would produce a misleading speedup. The result identifies an engineering question: which callers actually need all pairs, and which can reuse exact targeted queries?

### 3.7 Frontier reduction, decomposition and partial-order reduction

These methods attempt to reduce scheduling work by grouping local actions, proving exchangeability, or solving smaller components. They require more than visual repetition.

```text
candidate local segment A ---- shared barrier/publication ---- segment B
       can be summarized only if its externally visible effects are preserved
```

The support-based frontier checker distinguishes actions with purely local completion effects from memory, publication and barrier effects. The full 112 input failed the relevant frontier admission because proposed local groups had shared effects. That refusal protects the proof's scope.

For the fixed TK level-07 program, slicing the conflict list did not remove shared HB construction. Incorporating all semantic dependencies did not yield components with empty interfaces. A tested global strict-rank partition did not change the recorded first stopping point. These are results about those candidates; they do not refute all POR or decomposition methods.

Local solver answers must also compose into one legal global execution. Two individually satisfiable rank partitions can demand incompatible schedules. A valid decomposition needs an interface contract covering shared barriers, publication, participants and history.

### 3.8 Use exact-epoch sufficient conditions to prove the full finite model

This is the successful alternate route for the fixed 112-domain model. It avoids the monolithic bad-prefix formula when stronger structural premises can be checked.

`formalization_v4/epoch_verifier.py::verify_epoch_dag` performs:

1. Revalidate the counter-epoch certificate and supported instruction/token profile.
2. Check initialization, counter faults, previous-phase observation, parity wait windows and managed resource lifetime.
3. Build an **action dependency graph** from prerequisites and exact contributor completion. Under the preceding fault-exclusion argument, acyclicity supplies an enabled action at every unfinished prefix.
4. Build a separate **event HB graph** from original order/collective continuation and exact contributor-to-wait relations. Paths to observed completed endpoints are justified by executed matching waits.
5. Check every original potential conflict and all required directional publication conditions.
6. Emit a certificate with program identity, terminal obligations, action order and conflict/publication evidence. Replay rebuilds the proof rather than trusting a saved success flag.

```text
counter-epoch premises
        |
terminal / wait-window / resource obligations
        |                                  |
action graph: progress                 event graph: memory ordering
        |                                  + publication checks
        +------------------+---------------+
                     finite certificate
```

Action prerequisites are not automatically memory HB. Collective members may complete together without being ordered among themselves. The implementation explicitly keeps the two graphs separate.

The recorded certificate covers 3,094 actions, 9,700 conflicts and 3,233 terminal-obligation rows. It reports zero explored global states because it checks sufficient structural obligations. The nested `model_check` says `verified/safe`; outer historical `safety_verdict` and `source_verdict` fields remain `not authorized`. The precise claim is the proved finite P under the checked premises, with no source-level promotion.

This checker uses topological sorting and Python integer bitsets, with no SMT call in `epoch_verifier.py`. It still retains the finite program and computes exact reachability; it does not establish constant-space verification or an arbitrary-N theorem. Unsupported tokens, multiple resource leases, or missing conditions lead to refusal, leaving the general finite route available.

## 4. How this actually couples to the SMT solver

The concrete backend in the inspected code is **Z3**, called locally through its Python API using `z3.Solver()`. No SMT server process or service endpoint is required by this implementation. “SMT solver” names the constraint-solving role. The supplied term “A4” has no identified solver/backend mapping in the inspected implementation; it is left unresolved rather than assigned to an invented component.

### 4.1 What the solver receives

It receives constraints generated from an already constructed finite Program. It does not read CUDA/PTX and discover the intended binding by itself. The frontend/adapter supplies events, roles, guards, addresses, barriers and completion relationships within the admitted model.

```text
source + specialization + admitted control
                 |
         Q / finite Program P
                 |
      rank/counter/HB/publication encoding
                 |
       Z3: exists a legal bad prefix?
           /           |            \
         SAT          UNSAT         UNKNOWN
          |             |              |
  concrete replay   scope checks    inconclusive
  confirms fault    full horizon?
                    all bad classes?
```

SAT ranks are sorted into an action sequence and replayed through concrete semantics. If the proposed bad observation does not replay, the result is inconclusive. UNSAT at an incomplete horizon remains inconclusive; full-horizon UNSAT with only selected bad classes does not authorize complete safety. Timeout/unknown proves neither safety nor a bug.

### 4.2 Coupling by direction

| Direction | Solver coupling | What remains independent |
|---|---|---|
| Source/control recovery | No SMT required by these source audits | Actual source/configuration identity and occurrence binding |
| Generation-action proof reuse | Certificate and local-rule machinery | Source-template correspondence; no loop deletion |
| Exact epoch local domain | Semantic invariant/certificate checks | Contributor identities and error coverage |
| Strict-rank bad-prefix encoding | Strong; Z3 Int/Bool constraints | Correctness of Program semantics and replay |
| Rank-witness HB masks | Strong; Z3 BitVec/Bool plus rank ordering | Correct wait matches and correspondence theorem |
| Observation factorization | Tied to formula representation | Exact original query semantics |
| Concrete targeted reachability | Solver-free graph traversal | Full state and actual wait-match records |
| Exact-epoch finite DAG proof | Solver-free graph/bitset checker | Restricted premises, checked finite domain |
| Selected arithmetic invariant checks | Can use Z3 for local equations | Equations must match actual transitions |

Replacing Z3 requires translating sorts/constraints, timeout/status handling and model extraction, then revalidating replay/correspondence. The existence of SMT-LIB as a format does not make the current Python implementation backend-neutral automatically. Solver-free certificates still have a trusted checker; avoiding SMT does not avoid proof obligations.

## 5. What loop/branch analysis adds to the efficiency question

### 5.1 Stable repetition offers proof reuse before event removal

If each iteration has a justified correspondence to the same local action family, prove the local rule once where the family contract permits transfer. If active contributors are confined to a small epoch group, restrict that local domain. If query endpoints share interfaces, reuse expressions or traversals. Each option can retain all finite occurrences.

### 5.2 Irregular repetition changes the interface being summarized

Partial K changes completion membership; a final iteration may omit prefetch but retain its current wait; an output boundary can preserve pending groups and buffer indices; a branch can retain arrivals but add memory effects. An optimization that compares only source syntax or barrier counts can merge states that later queries distinguish.

The FA3 repeated-ready-label control is directly relevant: equal handshake counts and successful readiness checks can coexist with incorrect task correspondence. A smaller graph that omits this relation may accelerate the wrong property.

### 5.3 Schedule-dependent matching can invalidate a static-edge optimization

Exact epoch matching permits some relations to be certified in advance. If a new branch skips a phase contribution or changes participants, the certificate may fail. The alternatives include guarded matching, a family of graphs, richer history, or a conservative abstraction with a separate safety argument. The correct choice requires a concrete source case; no universal replacement is established here.

### 5.4 A true loop summary needs an induction argument

To move from fixed N=112 to a protocol family, preserve an invariant across independently advancing producer, consumer and hardware steps. Include initialization, short/empty work, tail and output handoff. Candidate state includes pending groups, exact task/buffer correspondence, phase observations, resource leases and publication facts.

```text
Init(N) implies I
I and an admitted actor step implies I after that step
I implies the chosen bad observation cannot occur
```

An in-flight bound must follow from the protocol. Assuming safe buffer reuse to obtain a bounded history, then using that bound to prove reuse, is circular. The historical fixed-domain successes have not closed this parameterized proof.

### 5.5 What a meaningful next efficiency evaluation would measure

Hold source/profile and observation semantics fixed; vary admitted loop lengths that actually exercise first reuse, repeated parity, and tail. Separately vary branch structures whose feasible correlations are known. Record events/actions, direct edges, closure pairs, conflicts, wait-match alternatives, formula AST/bit counts, build time, solver time, concrete-query time and peak memory.

Compare the same full query set, including publication direction/region and done endpoints. Record cold indexing separately from repeated queries. Include negative controls that change completion membership, omit a contributor, alter task correspondence or cross an output boundary. A method that only handles the 200 selected pairs must retain that narrower scope.

No new sweep is claimed in this document. The strongest current efficiency results are justified local proof-domain restriction, smaller symbolic matching/HB representation, exact concrete-query reuse, and a solver-free sufficient proof for the one complete finite model. General solver acceleration, arbitrary-N compression and data-dependent branch scalability remain open.

## 6. Evidence map and reproduction boundaries

| Evidence | Exact local artifact |
|---|---|
| Original 13-prefix scope and full 112 distinction | `docs/research-design.md`, Sections 3.2, 5 and 6 |
| Full local-rule Q/P certificate | `build/research-design/counter-epoch-full-qp-v2.json` |
| Independent-process certificate reconstruction | `build/research-design/counter-epoch-qp-replay-v2.json` |
| Rank-witness formula before generation factoring | `build/research-design/counter-epoch-finite-verifier-v2.json` |
| Certified-generation rank formula | `build/research-design/counter-epoch-finite-verifier-v3.json` |
| Complete finite structural proof | `build/research-design/counter-epoch-finite-dag-v1.json` |
| Concrete reuse queries and timing | `build/research-design/deepgemm-reuse-hb-v2.json` |
| Counter-history failed/refined designs | `build/research-design/contributor-design-v1.json` through `v4.json` |
| Earlier family/count/glue implementations | `formalization_v4/generation_action_equivariance.py`, `qp_contributor_subset_quotient.py`, `phase_closing_hb_glue.py` |
| Rank/wait correspondence checks | `formalization_v4/wait_hb_rank_correspondence.py`, `rank_correspondence.py` |
| Concrete state observation | `phaseguard/semantics.py`, `_reachable_events` |
| Current finite sufficient proof | `formalization_v4/epoch_verifier.py` |

The historical receipts bind their implementation hashes. Current excerpts below explain the code now on disk; they are not substituted for a receipt's historical implementation identity. The document refresh reads saved results and does not rerun the expensive full-model solver experiments. It makes no new speedup claim.

Fresh validation for this note: `python3 -m pytest -q tests/regression/test_epoch_verifier_v4.py tests/regression/test_counter_epoch_v4.py` completed with **48 passed in 0.37 s**. These are regression checks of the restricted epoch machinery, not a new 112-input solver benchmark. All eight implementation excerpts were compared to the declared local source intervals. No fresh independent-agent review was performed.

### Original implementation excerpts

The following excerpts are appended with line ranges and whole-file hashes. Trailing whitespace is normalized; other text is copied from the inspected files.

#### `formalization_v4/direct_symbolic_rank.py:503–544`

Whole-file SHA-256: `11bf8f60cd6e87cf98099688cc8aecc2a143a5888f917e61ebc9f63af1f6cc69`.

```python
    ranks = tuple(z3.Int(f"rank_action_{index}") for index in range(len(actions)))
    event_rank = {
        event.event_id: ranks[action_for_event[event.event_id]] for event in events
    }
    cut = z3.Int("rank_bad_cut")
    barrier_event_lists = {barrier.barrier_id: [] for barrier in program.barriers}
    for event in events:
        if event.barrier_id in barrier_event_lists:
            barrier_event_lists[event.barrier_id].append(event)
    barrier_events = {
        barrier_id: tuple(items) for barrier_id, items in barrier_event_lists.items()
    }

    solver = z3.Solver()
    if timeout_ms is not None:
        solver.set(timeout=timeout_ms)
    solver.add(*(z3.And(rank >= 0, rank < len(actions)) for rank in ranks))
    if action_rank_partition is not None:
        frontier_indices = action_rank_partition[0]
        if len(frontier_indices) > 1:
            solver.add(z3.Distinct(*(ranks[index] for index in frontier_indices)))
        for group in action_rank_partition:
            if len(group) > 1:
                solver.add(z3.Distinct(*(ranks[index] for index in group)))
        for before, after in program.readiness.union(program.order):
            if before in action_for_event and after in action_for_event:
                solver.add(event_rank[before] < event_rank[after])
    elif relax_action_ranks or relax_deadlock_ranks:
        for barrier in program.barriers:
            local = tuple(
                ranks[action_for_event[event.event_id]]
                for event in barrier_events[barrier.barrier_id]
            )
            solver.add(z3.Distinct(*local) if local else z3.BoolVal(True))
    else:
        solver.add(z3.Distinct(*ranks) if ranks else z3.BoolVal(True))
    for certificate in rank_symmetry_certificates:
        orbit_ranks = tuple(
            event_rank[event_id] for event_id in certificate.wait_event_ids
        )
        solver.add(*(left < right for left, right in zip(orbit_ranks, orbit_ranks[1:])))
    solver.add(cut >= 0, cut <= horizon)
```

#### `formalization_v4/direct_symbolic_rank.py:1048–1135`

Whole-file SHA-256: `11bf8f60cd6e87cf98099688cc8aecc2a143a5888f917e61ebc9f63af1f6cc69`.

```python
        pending_at_cut = _or(*(rank >= cut for rank in ranks))
        deadlock = z3.And(pending_at_cut, z3.Not(_or(*enabled_at_cut)))
        selected_bad.append(deadlock)
    solver.add(z3.Or(*selected_bad))

    build_seconds = time.perf_counter() - build_started
    if audit is not None:
        audit.update(
            {
                "rank_symmetry_certificate_count": len(rank_symmetry_certificates),
                "action_rank_partition_groups": 0 if action_rank_partition is None else len(action_rank_partition),
                "rank_symmetry_order_constraints": sum(
                    len(certificate.wait_event_ids) - 1
                    for certificate in rank_symmetry_certificates
                ),
                "bad_classes": tuple(sorted(bad_classes)),
                "action_count": len(actions),
                "event_count": len(events),
                "assertion_count": len(solver.assertions()),
                "formula_build_seconds": build_seconds,
                "ast_metrics_collected": audit_ast_nodes,
            }
        )
        if audit_ast_nodes:
            audit["assertion_ast_nodes"] = _count_ast_nodes(solver.assertions())
    solve_started = time.perf_counter()
    check = solver.check()
    solve_seconds = time.perf_counter() - solve_started
    if audit is not None:
        audit.update(
            {
                "solver_seconds": solve_seconds,
                "solver_status": str(check),
            }
        )
    if check == z3.unknown:
        return _result(
            SymbolicStatus.INCONCLUSIVE,
            Verdict.INCONCLUSIVE,
            f"solver returned unknown: {solver.reason_unknown()}",
            horizon,
            complete,
        )
    if check == z3.unsat:
        if horizon < complete:
            return _result(
                SymbolicStatus.INCONCLUSIVE,
                Verdict.INCONCLUSIVE,
                "no bad execution found before the incomplete horizon",
                horizon,
                complete,
            )
        all_bad_classes = bad_classes == complete_bad_classes
        return _result(
            SymbolicStatus.UNSAT,
            Verdict.SAFE if all_bad_classes else Verdict.INCONCLUSIVE,
            "rank-derived formula has no selected bad execution prefix",
            horizon,
            complete,
        )

    model = solver.model()
    cut_value = model.eval(cut, model_completion=True).as_long()
    ranked = tuple(
        sorted(
            (
                model.eval(ranks[index], model_completion=True).as_long(),
                index,
                action,
            )
            for index, action in enumerate(actions)
        )
    )
    concrete, replay_failure = _replay_bad_prefix(
        program,
        tuple((rank, action) for rank, _, action in ranked),
        cut_value,
        include_cut_action=bad_classes != frozenset({"deadlock"}),
    )
    if concrete is None or concrete.witness is None:
        return _result(
            SymbolicStatus.INCONCLUSIVE,
            Verdict.INCONCLUSIVE,
            f"SAT rank prefix does not replay to a concrete bad observation: {replay_failure}",
            horizon,
            complete,
        )
    if not _fault_matches_bad_classes(concrete.witness.fault.kind, bad_classes):
```

#### `formalization_v4/direct_symbolic_rank.py:1691–1870`

Whole-file SHA-256: `11bf8f60cd6e87cf98099688cc8aecc2a143a5888f917e61ebc9f63af1f6cc69`.

```python
def _rank_witness_happens_before(
    program: Program,
    done: list[z3.BoolRef],
    wait_matches: list[Mapping[int, z3.BoolRef]],
    event_index: dict[str, int],
    wait_index: dict[str, int],
    queried_pairs: frozenset[tuple[int, int]],
    *,
    event_rank: Mapping[str, z3.ArithRef],
    solver: z3.Solver,
    audit: dict[str, object] | None = None,
    audit_ast_nodes: bool = True,
    formula_deadline: float | None = None,
    include_done_guards: bool = True,
) -> dict[tuple[int, int], z3.BoolRef]:
    hb_started = time.perf_counter()

    def check_deadline() -> None:
        if formula_deadline is not None and time.perf_counter() >= formula_deadline:
            raise _FormulaBuildTimeout

    if hasattr(program, "static_successors"):
        static_successors = {
            event_index[before]: frozenset(
                event_index[after] for after in successors
            )
            for before, successors in program.static_successors.items()
        }
    else:
        static_successors: dict[int, frozenset[int]] = {}
        for before, after in program.static_happens_before:
            static_successors.setdefault(event_index[before], set()).add(
                event_index[after]
            )
        static_successors = {
            before: frozenset(after)
            for before, after in static_successors.items()
        }
    waits = tuple(
        event_id for event_id, _ in sorted(wait_index.items(), key=lambda item: item[1])
    )
    wait_events = tuple(event_index[event_id] for event_id in waits)

    predecessors: list[list[tuple[int, z3.BoolRef]]] = [[] for _ in waits]
    edge_count = 0
    for left_wait, left_event in enumerate(wait_events):
        for right_wait, row in enumerate(wait_matches):
            terms = tuple(
                match
                for contributor, match in row.items()
                if contributor == left_event
                or contributor in static_successors[left_event]
            )
            if terms:
                predecessors[right_wait].append((left_wait, z3.Or(*terms)))
                edge_count += 1
    predecessor_seconds = time.perf_counter() - hb_started

    source_signatures: dict[tuple[tuple[int, ...], ...], int] = {}
    source_for_left: dict[int, int] = {}
    reach: dict[tuple[int, int], z3.BoolRef] = {}
    queried_lefts = sorted({left for left, _ in queried_pairs})
    queried_rights = sorted({right for _, right in queried_pairs})
    queried_right_lists = {left: [] for left in queried_lefts}
    for left, right in sorted(queried_pairs):
        queried_right_lists[left].append(right)
    queried_rights_by_left = {
        left: tuple(rights) for left, rights in queried_right_lists.items()
    }
    target_signature_by_right = {
        right: tuple(
            wait
            for wait, wait_event in enumerate(wait_events)
            if wait_event == right or right in static_successors[wait_event]
        )
        for right in queried_rights
    }

    for left in queried_lefts:
        check_deadline()
        source_signature = tuple(
            tuple(
                contributor
                for contributor in wait_matches[wait]
                if contributor == left or contributor in static_successors[left]
            )
            for wait in range(len(waits))
        )
        source_for_left[left] = source_signatures.setdefault(
            source_signature, len(source_signatures)
        )
    source_signature_seconds = time.perf_counter() - hb_started - predecessor_seconds

    bit_count = len(source_signatures)
    zero = z3.BitVecVal(0, bit_count)
    initial_masks: list[z3.BitVecRef] = []
    for wait in range(len(waits)):
        bits = tuple(
            z3.If(
                z3.Or(
                    *(wait_matches[wait][item] for item in signature[wait])
                ),
                z3.BitVecVal(1, 1),
                z3.BitVecVal(0, 1),
            )
            if signature[wait]
            else z3.BitVecVal(0, 1)
            for signature, _bit in sorted(
                source_signatures.items(), key=lambda item: item[1], reverse=True
            )
        )
        initial_masks.append(bits[0] if len(bits) == 1 else z3.Concat(*bits))
    initial_mask_seconds = (
        time.perf_counter()
        - hb_started
        - predecessor_seconds
        - source_signature_seconds
    )

    variables = tuple(
        z3.BitVec(f"hb_rank_reach_mask_{wait}", bit_count) for wait in range(len(waits))
    )
    auxiliary_constraints: list[z3.BoolRef] = []
    for right_wait, incoming in enumerate(predecessors):
        check_deadline()
        supported = initial_masks[right_wait]
        for left_wait, edge in incoming:
            supported = supported | z3.If(
                z3.And(
                    edge,
                    event_rank[waits[left_wait]] < event_rank[waits[right_wait]],
                ),
                variables[left_wait],
                zero,
            )
        auxiliary_constraints.append(variables[right_wait] == supported)
    auxiliary_build_seconds = (
        time.perf_counter()
        - hb_started
        - predecessor_seconds
        - source_signature_seconds
        - initial_mask_seconds
    )

    target_reach: dict[tuple[int, tuple[int, ...]], z3.BoolRef] = {}
    for left in queried_lefts:
        source_bit = source_for_left[left]
        for right in queried_rights_by_left[left]:
            target_signature = target_signature_by_right[right]
            key = source_bit, target_signature
            if key not in target_reach:
                target_reach[key] = z3.Or(
                    *(
                        z3.Extract(source_bit, source_bit, variables[target])
                        == z3.BitVecVal(1, 1)
                        for target in target_signature
                    )
                )
            core = (
                z3.BoolVal(True)
                if right in static_successors[left]
                else target_reach[key]
            )
            reach[left, right] = (
                z3.And(done[left], done[right], core)
                if include_done_guards
                else core
            )
    reach_build_seconds = (
        time.perf_counter()
        - hb_started
        - predecessor_seconds
        - source_signature_seconds
        - initial_mask_seconds
        - auxiliary_build_seconds
    )

    solver_add_started = time.perf_counter()
    solver.add(*auxiliary_constraints)
    solver_add_seconds = time.perf_counter() - solver_add_started
```

#### `phaseguard/semantics.py:573–599`

Whole-file SHA-256: `cc9c3d2fc4238604cbca5526ba4173b1d9d3e8074e2dbaee038f841eae88c856`.

```python

def _ordered(program: Program, state: State, before: str, after: str) -> bool:
    if after in program.static_successors.get(before, frozenset()):
        return True
    return after in _reachable_events(program, state, before)


def _reachable_events(program: Program, state: State, before: str) -> frozenset[str]:
    reachable = {before}
    reachable.update(program.static_successors.get(before, frozenset()) & state.done)
    pending = list(state.wait_matches)
    while pending:
        remaining: list[WaitMatch] = []
        changed = False
        for match in pending:
            if reachable.isdisjoint(match.contributors):
                remaining.append(match)
                continue
            additions = {match.wait_event}
            additions.update(
                program.static_successors.get(match.wait_event, frozenset()) & state.done
            )
            previous_size = len(reachable)
            reachable.update(additions)
            changed = changed or len(reachable) != previous_size
        if not changed:
            break
```

#### `formalization_v4/epoch_verifier.py:1–109`

Whole-file SHA-256: `a65bcc580ec482649fdc4b9472f5c68f89c095a420529a7eddc9a88ffe6caf57`.

```python
"""Sufficient finite safety proof for the existing exact-epoch semantics.

No transition, readiness edge or HB edge is changed. A successful proof covers
all original actions and memory conflicts. A missing premise refuses this proof
method; callers can still use the general finite verifier on the unchanged P.

Proof order matters. At a prefix before the FIRST terminal fault, the existing
epoch invariant justifies exact releases and done-wait implications. The checks
below exclude that next terminal fault, including wait-window and lease errors.
Only then does a wait become enabled exactly when its original readiness and
bound contributors are done. The resulting action DAG proves progress.

The HB graph is separate, at EVENT level. Every edge implies that its target
being done requires its source done. A path to an observed done target therefore
contains only executed waits with real exact matches. This licenses the path
for that observation, not for a pending wait or an arbitrary local proof state.
Directional publication is checked with the existing payload predicate.
"""

from __future__ import annotations

from dataclasses import dataclass
from graphlib import CycleError, TopologicalSorter

from .counter_epoch import CounterEpochCertificate, validate_counter_epoch_certificate
from .extraction import digest_program
from phaseguard.lowering_primitives import (
    BARRIER_COUNTER_KINDS, MEMORY_KINDS, publication_payload_matches,
)
from phaseguard.program import OpKind, Program
from phaseguard.semantics import has_exact_overlap, static_actions
from phaseguard.verifier import VerificationResult, Verdict


# Explicitly exclude capture/state wait and token-producing arrivals. A new
# primitive must not acquire a safety proof merely because its enum was added.
_SUPPORTED = frozenset({
    OpKind.CONTROL, OpKind.ISSUE, OpKind.COMPLETE, OpKind.READ, OpKind.WRITE,
    OpKind.ALLOCATE, OpKind.FREE, OpKind.BARRIER_INIT, OpKind.BARRIER_ARRIVE,
    OpKind.BARRIER_COMPLETE_TX, OpKind.BARRIER_WAIT_PARITY, OpKind.CTA_SYNC,
    OpKind.PUBLISH,
})
PROOF_METHOD = "phaseguard/exact-epoch-finite-dag/v1"


@dataclass(frozen=True)
class EpochDagCertificate:
    program_digest: str
    epoch_certificate: CounterEpochCertificate
    terminal_obligations: tuple[tuple[str, str, tuple[str, ...]], ...]
    action_order: tuple[tuple[str, ...], ...]
    conflict_obligations: tuple[tuple[str, str, str | None], ...]


def _dag_ancestors(predecessors):
    """Deterministic exact transitive closure as integer bit sets."""
    graph = {node: tuple(sorted(predecessors[node])) for node in sorted(predecessors)}
    order = tuple(TopologicalSorter(graph).static_order())
    bits = {node: 1 << index for index, node in enumerate(graph)}
    ancestors = {}
    for node in order:
        value = 0
        for before in graph[node]:
            value |= ancestors[before] | bits[before]
        ancestors[node] = value
    return order, bits, ancestors


def verify_epoch_dag(
    program: Program, epoch_certificate: CounterEpochCertificate,
) -> tuple[VerificationResult, EpochDagCertificate | None]:
    """Prove terminal, race, publication and deadlock absence, or refuse.

This is a sufficient, solver-free proof for a restricted finite profile, not a
general decision procedure or a source theorem. ``explored_states`` is zero:
the complete action/observation obligation inventory is recorded instead.
"""
    def refused(reason):
        return VerificationResult(Verdict.REFUSED, reason, 0), None

    failures = validate_counter_epoch_certificate(program, epoch_certificate)
    if failures:
        return refused(f"epoch premises: {failures[0]}")
    for event in program.sorted_events:
        if (event.kind not in _SUPPORTED or event.token_def is not None
                or event.token_use is not None):
            return refused(f"unsupported terminal-proof primitive/token: {event.event_id}")
    actions = static_actions(program)
    owner = {event: index for index, action in enumerate(actions) for event in action.event_ids}
    groups = {(barrier, generation): members
              for barrier, generation, members in epoch_certificate.contributors}
    epochs = {item.event_id: item.barrier_epoch for item in epoch_certificate.binding.events}
    waits = tuple(event for event in program.sorted_events if event.kind is OpKind.BARRIER_WAIT_PARITY)
    needed = {index: set() for index in range(len(actions))}
    for before, after in program.readiness:
        if owner[before] == owner[after]:
            return refused(f"collective depends on its own pending member: {before}->{after}")
        needed[owner[after]].add(owner[before])
    for wait in waits:
        needed[owner[wait.event_id]].update(owner[member]
            for member in groups[wait.barrier_id, wait.expected_epoch])
    try:
        action_order, bits, ancestors = _dag_ancestors(needed)
    except CycleError:
        return refused("exact-wait action dependency graph is cyclic; progress is unproved")

    def ready_done(event):
        # Seed ORIGINAL prerequisites, not the target. A pending wait does not
        # entitle us to its conditional G -> done-wait implications.
```

#### `formalization_v4/epoch_verifier.py:180–248`

Whole-file SHA-256: `a65bcc580ec482649fdc4b9472f5c68f89c095a420529a7eddc9a88ffe6caf57`.

```python
            if not is_done(allocate.event_id, ready_done(event)):
                return refused(f"allocation is not required before: {event.event_id}")
            terminal.append((event.event_id, "single-lease/allocation-before-use", (allocate.event_id,)))
        for free in frees:
            if not all(is_done(use.event_id, ready_done(free)) for use in uses):
                return refused(f"all protected uses are not required before free: {free.event_id}")
            terminal.append((free.event_id, "single-lease/all-uses-before-free", tuple(use.event_id for use in uses)))

    # Keep event-level HB distinct from collective action equivalence. Members
    # completing simultaneously are not thereby ordered with one another.
    order_edges = set(program.order)
    for collective in program.collectives:
        members = frozenset(collective.participant_events)
        continuations = {after for before, after in program.order if before in members}
        order_edges.update((member, after) for member in members for after in continuations)
    hb_predecessors = {event: set() for event in program.event_ids}
    for before, after in order_edges:
        if owner[before] != owner[after] and not is_done(before, ancestors[owner[after]]):
            return refused(f"HB lacks necessary-done authority: {before}->{after}")
        hb_predecessors[after].add(before)
    for wait in waits:
        hb_predecessors[wait.event_id].update(groups[wait.barrier_id, wait.expected_epoch])
    try:
        _, hb_bits, hb_ancestors = _dag_ancestors(hb_predecessors)
    except CycleError:
        return refused("event-level HB proof graph is cyclic")

    def ordered(before, after):
        return bool(hb_bits[before] & hb_ancestors[after])

    publications = tuple(event for event in program.sorted_events if event.kind is OpKind.PUBLISH)
    conflicts = []
    # There is no caller-selected pair list: every original potential conflict
    # is required, including may-only overlaps and pairs separated by epochs.
    for left, right in program.iter_potential_memory_conflicts():
        if ordered(left, right):
            source, target = program.event_map[left], program.event_map[right]
        elif ordered(right, left):
            source, target = program.event_map[right], program.event_map[left]
        else:
            return refused(f"memory order is unproved: {left}/{right}")
        publication = None
        if source.proxy is not target.proxy and has_exact_overlap(program, left, right):
            publication = next((pub.event_id for pub in publications
                if publication_payload_matches(source, target, source_proxy=pub.publication_from,
                    target_proxy=pub.publication_to, regions=pub.publication_regions)
                and ordered(source.event_id, pub.event_id) and ordered(pub.event_id, target.event_id)), None)
            if publication is None:
                return refused(f"directional publication is unproved: {source.event_id}/{target.event_id}")
        conflicts.append((source.event_id, target.event_id, publication))
    certificate = EpochDagCertificate(digest_program(program), epoch_certificate, tuple(terminal),
        tuple(actions[index].event_ids for index in action_order), tuple(conflicts))
    return VerificationResult(Verdict.SAFE,
        "All finite terminal, memory-order, publication and progress obligations closed by exact-epoch proof", 0), certificate


def validate_epoch_dag_certificate(program: Program, certificate: EpochDagCertificate) -> tuple[str, ...]:
    """Rebuild the complete proof; serialized status and omitted rows have no authority."""
    if type(certificate) is not EpochDagCertificate:
        return ("invalid exact-epoch finite certificate",)
    if certificate.program_digest != digest_program(program):
        return ("exact-epoch finite certificate Program digest differs",)
    result, rebuilt = verify_epoch_dag(program, certificate.epoch_certificate)
    if result.verdict is not Verdict.SAFE:
        return (result.reason,)
    return () if rebuilt == certificate else ("exact-epoch finite certificate obligations differ",)

```

#### `formalization_v4/counter_epoch.py:278–312`

Whole-file SHA-256: `6b759e573b863350cded0c373c6661aaf867250767f35d0f1742b003db4f2dd7`.

```python
def epoch_barrier_domain(
    program: Program, barrier_id: str, certificate: CounterEpochCertificate,
):
    """Enumerate exact barrier/history coordinates from validated premises.

The caller validates ``certificate`` before constructing any local proof. This
is the barrier factor only: it supplies neither done/token coordinates nor a
Q/P certificate. The runtime epoch, never the selected action's source epoch,
chooses the group. Impossible prefixes may remain as an over-approximation.
There is no count quotient, epoch-zero renaming, or history truncation.

Coverage follows from the simultaneous invariant: g is in [0,n], C is a proper
subset of G[b,g] (empty at n), counters are its exact weighted sums, and the
per-barrier release sequence is H_b(g). The generator deliberately does not
rely on the independent local-case classifier to establish these facts.
"""
    groups = tuple(members for name, _, members in certificate.contributors if name == barrier_id)
    if any(len(group) > 16 for group in groups):
        raise ValueError("epoch barrier domain exceeds checked subset budget")
    capacity = program.barrier_map[barrier_id].expected_arrivals
    history = ()
    for epoch in range(len(groups) + 1):
        members = groups[epoch] if epoch < len(groups) else ()
        # The full nonempty group has already closed, including groups with
        # zero-arrival contributors. Preserve every proper subset identity.
        sizes = range(len(members)) if members else (0,)
        for size in sizes:
            for selected in combinations(members, size):
                events = tuple(program.event_map[name] for name in selected)
                remaining = capacity - sum(event.arrival_count for event in events)
                transaction = sum(transaction_delta(event) for event in events)
                for observed in ((True,) if epoch == 0 else (False, True)):
                    yield (BarrierRuntime(epoch, capacity, remaining, transaction, observed,
                                          frozenset(selected)), history)
        if members:
```

#### `formalization_v4/observation_interface.py:85–142`

Whole-file SHA-256: `162c5ce4b6efc8a9abaa15da04f3a4cdd88feb3d78c0036a5ace4f42f439ade0`.

```python
    memory_conflicts: tuple[tuple[str, str], ...] | None = None,
) -> ObservationInterfaceCertificate:
    events = tuple(program.sorted_events)
    roles = queried_pair_roles(program, memory_conflicts)

    def signature(index: int) -> EndpointSignature:
        event = events[index]
        return EndpointSignature(
            owner=event.owner,
            proxy=event.proxy.value,
            region_id=event.region_id,
            kind=event.kind.value,
        )

    rectangles: list[PairRectangle] = []
    failures: list[str] = []
    for role, pairs in sorted(roles.items()):
        grouped: dict[
            tuple[EndpointSignature, EndpointSignature], set[tuple[int, int]]
        ] = {}
        for left, right in pairs:
            grouped.setdefault((signature(left), signature(right)), set()).add(
                (left, right)
            )
        reconstructed: set[tuple[int, int]] = set()
        for (left_signature, right_signature), group_pairs in sorted(grouped.items()):
            left_events = tuple(sorted({left for left, _ in group_pairs}))
            right_events = tuple(sorted({right for _, right in group_pairs}))
            exclusions = tuple(
                sorted(
                    set(
                        (left, right)
                        for left in left_events
                        for right in right_events
                    ).difference(group_pairs)
                )
            )
            rectangle = PairRectangle(
                role=role,
                left_signature=left_signature,
                right_signature=right_signature,
                left_events=left_events,
                right_events=right_events,
                exclusions=exclusions,
            )
            rectangles.append(rectangle)
            reconstructed.update(rectangle.reconstruct())
        if reconstructed != pairs:
            failures.append(
                f"{role}: reconstructed={len(reconstructed)} expected={len(pairs)}"
            )

    representation_units = sum(
        len(item.left_events) + len(item.right_events) + len(item.exclusions)
        for item in rectangles
    )
    role_pair_counts = tuple((role, len(pairs)) for role, pairs in sorted(roles.items()))
    shared_pairs = frozenset().union(*roles.values())
```
