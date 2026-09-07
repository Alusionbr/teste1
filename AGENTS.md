# Codex agent policy

## Objective
Preserve final-answer and code quality while minimizing total context, tool calls, and GPT-6 Astra usage. Never trade correctness, security, or data integrity for token savings.

## Scope first
- This is a monorepo. Identify the target project (`controle360`, `estante`, `hub`, `xadrez3d`, or another explicit directory) before reading implementation files.
- Do not scan sibling projects unless the task genuinely crosses them.
- Start with targeted filename/code search and small relevant file ranges. Expand only when evidence requires it.
- Reuse summaries of unchanged files instead of reopening them.
- Do not load large documentation files such as `CLAUDE.md` by default. Read only the relevant section when its project guidance is required.

## Model routing
When collaboration/subagents and model selection are available:
- **GPT-6 Astra**: architecture, ambiguous multi-system decisions, security-sensitive work, destructive/data migration decisions, hard debugging after cheaper attempts fail, and final review of high-risk/broad changes.
- **GPT-5.6 Sol**: default implementation, non-trivial refactors, normal debugging, code review, and test fixes.
- **GPT-5.6 Terra**: well-scoped implementation where cost/quality balance is appropriate.
- **GPT-5.6 Luna**: repository reconnaissance, filename/search work, repetitive edits, formatting, small isolated changes, and narrow verification.
- Do not spawn Astra subagents for mechanical work. Do not delegate when delegation overhead is larger than the task.
- If model-selectable subagents are unavailable, follow the same staged workflow without claiming a delegation happened.

## Execution workflow
1. Define the smallest correct scope and list the likely relevant files.
2. Inspect only those files/search hits.
3. Make a concise plan when the task is non-trivial.
4. Implement with the least expensive model that can do the step reliably.
5. Run targeted tests/checks appropriate to the change.
6. Escalate to Astra only for unresolved complexity or a high-risk review.
7. Inspect the final diff for regressions, unrelated edits, and duplicated/generated-file changes.

## Quality gate
- Preserve existing behavior unless the task explicitly changes it.
- Prefer source files over generated/bundled artifacts.
- Do not weaken validation, tests, auth, security, or error handling to save tokens.
- For small reversible changes, use targeted verification; do not repeatedly run broad suites without a new reason.
- For database/schema/auth/security/payment changes, require a stronger review and explicit migration/rollback reasoning.
- Stop rereading/retesting once the relevant checks pass and no unresolved risk remains.
