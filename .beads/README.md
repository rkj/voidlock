# Beads - AI-Native Issue Tracking

Welcome to Beads! This repository uses **Beads** for issue tracking - a modern, AI-native tool designed to live directly in your codebase alongside your code.

## What is Beads?

Beads is issue tracking that lives in your repo, making it perfect for AI coding agents and developers who want their issues close to their code. No web UI required - everything works through the CLI and integrates seamlessly with git.

**Learn more:** [github.com/steveyegge/beads](https://github.com/steveyegge/beads)

## Quick Start

### Essential Commands

```bash
# Create new issues
bd create "Add user authentication"

# View all issues
bd list

# View issue details
bd show <issue-id>

# Update issue status
bd update <issue-id> --status in_progress
bd update <issue-id> --status done

# Sync with git remote
bd sync
```

### Working with Issues

Issues in Beads are:

- **Git-native**: Stored in `.beads/issues.jsonl` and synced like code
- **AI-friendly**: CLI-first design works perfectly with AI coding agents
- **Branch-aware**: Issues can follow your branch workflow
- **Always in sync**: Auto-syncs with your commits

## Workflow

Beads is designed to guide you through the project's task graph. Follow this workflow to ensure you are always working on the most relevant and unblocked tasks.

### 1. Discover Actionable Work
Use the `ready` command to find tasks that have no open blockers. This is your primary source for "what to do next."
```bash
bd ready
```

### 2. Inspect and Claim
Once you've identified a task, view its details and mark it as in progress.
```bash
bd show <issue-id>
bd update <issue-id> --status in_progress
```

### 3. Handle Dependencies
If you discover that a task depends on another, link them explicitly. This ensures that `bd ready` remains accurate.
```bash
bd dep add <blocked-issue-id> <blocker-issue-id>
```

### 4. Create New Issues
When you find bugs or new requirements, create them immediately. Use the `--deps` flag if they are blocked by or block existing work.
```bash
bd create "New bug title" --type bug --priority P1
```

### 5. Completion
Once finished, close the issue.
```bash
bd close <issue-id>
```

---

_Beads: Issue tracking that moves at the speed of thought_ ⚡

