# CLAUDE.md

Project-specific instructions for Claude Code working in this repo.

## Agent skills

### Issue tracker

Issues live as GitHub issues in `martinnovak22/fitapp`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Working on an issue

When the user (or an orchestrating loop) asks you to work on a `ready-for-agent` issue, follow the conventions in `.claude/work-on-issue.md`.

### Commit messages

Follow the format in `.claude/commit-style.md`: imperative lowercase title, bulleted body, blank line between topic shifts, no `Co-Authored-By` trailer.
