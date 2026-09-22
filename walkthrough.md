# Five examples: source and results

The website is https://loop.zzw4257.cn/. Read the English comments directly
in the `.annotated.ptx` copies in `research/loop-reuse/annotated/`.
Original instructions are retained; annotations do not implement new behavior.

## What each example explains

1. **Two-buffer `[2,1]` pipeline.** Three work items cross an output boundary.
   Local iteration restarts; pipeline cursor and logical work continue.
   Wrong input/output correspondence can remain race-free. Moving release
   before the completion wait produces a race candidate. The wait is still
   present in this negative control; it is too late to protect reuse.
2. **FlashAttention h64.** Four correction warps independently execute or skip
   TMEM updates. Two visits produce eight choices and 256 combinations covered
   by the finite supported-order check. Common control and resolved addresses
   are fixed; A002 duplicate-store exemptions remain.
3. **FlashAttention varlen h128.** The same mechanism with eight fragments and
   an address prefix inside the optional region. One visit gives 16 combinations.
   Removing store wait at original PTX line 4099 gives `unsafe_lifecycle`.
   The useful task includes 10 TMA copies, 32 MMA issues and 512 threads.
4. **DeepGEMM.** Stages continue from 0,1 to 2,3 across outputs. Restricted
   two-CTA checking passes; resetting the cursor breaks the wait handoff.
   Full-launch checking hit 8 GiB; the first 12-stage wrap is untested.
5. **ThunderKittens.** Four output slices share two buffers. Source reads must
   retire before overwrite. Changing only the first reuse wait from `read 1`
   to `read 7` produces a race candidate with two native-model replay orders.

These are five examples, not five distinct mechanisms. h64 and h128 exercise
the same conditional TMEM rule.

## What branch coverage means here

Known shape/role conditions already execute in Wasp. Completing varlen shape
arrays resolves its initial line-1198 branch; this is an input repair.
Our finite conditional-TMEM family check covers independent choices at the
declared visits. It does not establish arbitrary tensor feedback into future
control or addresses.

Wasp also recognizes a canonical schedule-dependent polling pattern: a probe
with a same-target, side-effect-free fallback wait. Other schedule-dependent
branches are rejected. General optional synchronization is not solved:
optional release changes the common skeleton; an optional read wait can leave
reuse unproved; an optional full wait can change common completion requirements.
Arbitrary loop length and whole-kernel numerical equivalence remain open.

## Operate the page

Open **Running example** for the preserved, recorded player. Select the legal
case, inspect work matching, and switch to early release. Open **Trace** for
actual event IDs and their own PTX lines; display order is one execution,
not additional HB. **Rule** shows recorded h64 support groups and their actual
checker counts, including the A002 exemptions; it does not invent HB paths. **Corpus** contains
the four real profiles. **Efficiency** compares the same obligations: only N1
has two complete arms and a speedup; later resource limits are incomplete,
and unrun larger sizes are labeled unrun. **Limits** states what remains open.

## Results in the checkout

- `build/loop-reuse/{legal,reset,early_release}/report.json`
- `build/skeleton-projection-two-round-v1/family-order-v2.json`
- `build/varlen-projection-v1/family-order.json`
- `build/varlen-projection-v1/calibration-trial/results.json`
- `build/varlen-projection-v1/negative-wait-trial/report.json`
- `build/corpus-loop-branch-restricted-cluster-v1/report.json`
- `build/corpus-loop-branch-reset-v1/report.json`
- `build/corpus-completion-tk-v1/completion-evidence.json`
- `build/loop-branch-current/completed-costs-v2.json`

These results are native verifier evidence, not GPU execution. The original
two-buffer player retains historical timings; the current Efficiency page
reports the separate Wasp family experiment.
