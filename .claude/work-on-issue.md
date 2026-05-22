# Working on an Issue

Conventions for any agent (or human) implementing a ready-for-agent issue in this repo. Read this in addition to `CLAUDE.md` and `docs/agents/*.md`.

## Before you write any code

1. Run `gh issue view <N> --comments` and read the full body.
2. Run `gh issue view 1 --comments` to load the parent PRD. Its architectural decisions and module boundaries are **binding** — do not contradict them silently.
3. If the issue references other issues in its "Blocked by" section, verify they are closed and their PRs are merged to `main`. If not, stop and tell the user.
4. Use `TaskCreate` to break the work into 3–7 sub-steps and track them. Mark each `in_progress` when starting, `completed` when done.

## Implementation discipline

- **TDD where it makes sense.** Write the test first, see it fail, write the code, see it pass. The PRD mandates tests for the four module groups — those slices must follow TDD.
- **No new shallow wrappers.** If you find yourself creating a one-method module that just calls another, you're inventing a layer, not extracting one. Stop and reconsider.
- **Stop on ambiguity.** If an acceptance criterion is genuinely unclear, stop and ask the user. Do not guess at what they meant.
- **Stay in scope.** Each issue is a tracer-bullet slice. If you discover a related improvement, note it for a follow-up — do not fold it into this PR.

## Before committing

- Run the project checks: `yarn check` (or whatever the issue introduces as the test command).
- Run `/simplify` on the changed files. The PRD explicitly requires this at the end of every slice.

## Branch and commit conventions

- Branch name: `feat/issue-<N>-<short-slug>`. Example: `feat/issue-3-principal-transition`.
- Commits: present-tense imperative subject line, body explains the *why*. Don't bury the rationale in the PR description if it belongs in the commit.
- Never amend a commit after pushing unless the user explicitly asks.
- Never use `git push --force` on a shared branch without asking.

## Pull request

- Title: short, matches the issue title.
- Body must contain:
  - A "Closes #<N>" line so the issue auto-closes on merge.
  - A "Refs PRD #1" line linking back to the parent PRD.
  - A "Test plan" section: bulleted list of what the reviewer should verify.
- Apply label `ready-for-human` if you stopped mid-implementation and need a human to take over; otherwise no label change.

## When CI fails

- Read the failure output. Fix the underlying cause; do not paper over it.
- If you can't fix it in two iterations, escalate to the user with the failing log excerpt.

## When you're done

Output `<promise>COMPLETE</promise>` so any orchestrating loop knows this iteration ended cleanly.
