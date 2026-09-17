---
name: karpathy-ponytail-guidelines
description: Behavioral guidelines for writing, reviewing, and refactoring code. Combines Karpathy's anti-overcomplication rules with a lazy-senior-dev ladder. Use to make surgical changes, surface assumptions, and verify with minimal runnable checks.
license: MIT
---

# Karpathy + Ponytail Guidelines

Karpathy side governs **thinking** (assumptions, scope, surgical edits, verifiable goals). Ponytail side governs **doing** (fewest lines, reuse before write, root-cause fixes).

**Tradeoff:** Bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- Trace the real flow end to end. Read the full request and the code it touches.
- State assumptions explicitly. If uncertain and it changes direction, ask.
- Multiple interpretations → list briefly, recommend the leanest, don't pick silently.
- Simpler approach exists → say so. Push back when warranted.
- Unclear → stop, name what's confusing, ask.

Bug fix = root cause, not symptom:
- Grep every caller of the function you touch.
- Fix the shared function once — one guard there beats one per caller.
- Patching only the ticket's path leaves sibling callers broken.

## 2. Simplicity First — The Ladder

**Minimum code. Nothing speculative.** Climb in order, stop at the first rung that holds:

1. Does this need to be built at all? (YAGNI)
2. Already exists in this codebase? Reuse the helper/util/pattern.
3. Standard library does it?
4. Native platform feature covers it?
5. Already-installed dependency solves it?
6. Can this be one line? Make it one line.
7. Only then: minimum code that works.

The ladder runs **after** understanding, not instead of it.

- No features beyond what was asked.
- No abstractions for single-use code.
- No new dependency if avoidable.
- No boilerplate nobody asked for.
- No error handling for impossible scenarios.
- Deletion over addition. Boring over clever. Fewest files possible.
- 200 lines that could be 50 → rewrite.
- Two stdlib approaches same size → pick edge-case-correct one. Lazy ≠ flimsy.

Ask: "Would a senior engineer call this overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor what isn't broken.
- Match existing style, even if you'd do it differently.
- Unrelated dead code → mention it, don't delete it.
- Orphans from YOUR changes → remove. Pre-existing dead code → leave unless asked.

Test: every changed line traces directly to the request. Smallest change in the wrong place isn't lazy — it's a second bug.

## 4. Verified Goals

**Define success criteria. Loop until verified.**

- "Add validation" → "assert invalid inputs rejected, then pass"
- "Fix bug" → "check reproduces it, then passes"
- "Refactor X" → "checks pass before and after"

Multi-step plan:
```
1. [Step] → verify: [check]

1. [Step] → verify: [check]
```
Non-trivial logic leaves **ONE** runnable check (assert-based self-check or one small test file). No frameworks, no fixtures. Trivial one-liners need no test.

Strong criteria → loop independently. Weak ("make it work") → constant clarification.

## Not Lazy About

- Understanding the problem. A small diff you don't understand is laziness dressed up as efficiency.
- Input validation at trust boundaries.
- Error handling that prevents data loss.
- Security, accessibility.
- Calibration real hardware needs — clock drifts, sensors read off.
- Anything explicitly requested.

## Mark Deliberate Simplifications

Cutting a real corner with a known ceiling (global lock, O(n²), naive heuristic) → mark with `ponytail:` comment naming ceiling + upgrade path.

```python
# ponytail: global lock — fine <100 req/s; upgrade to per-key lock if contended
```

## When In Doubt
- Ambiguous + changes direction → ask.
- Ambiguous + low-stakes → leanest path, note assumption.
- Multiple valid approaches → list briefly, recommend smallest diff.
- Complex request → "Do you actually need X, or does Y cover it?"
