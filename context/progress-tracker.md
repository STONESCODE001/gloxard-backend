#### progress-tracker.md

**What it does**

Tracks the current phase, what's complete, what's in progress,
what's coming next, open questions, architecture decisions,
and session notes.

**Why it matters**

This is the only file that changes constantly throughout
the build. And it's the most important file for long builds.

AI agents have no memory between sessions. Every time you
open a new session, the agent starts from zero. The progress
tracker is how you restore full context in a single prompt.
One instruction, read the entry file and resume and the
agent knows exactly where the project stands, what decisions
were made, and what comes next.

Without this file, you spend the first fifteen minutes of
every session re-explaining your own project to the agent.
With it, you're back in motion in seconds.

**How to set it up**

Unlike the other five files, the progress tracker starts
empty. Copy this template and fill in the first two sections:

```markdown
# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- [phase name]

## Current Goal

- [what you are building right now]

## Completed

- None yet.

## In Progress

- None yet.

## Next Up

- [first unit to build]

## Open Questions

- [any unresolved decisions]

## Architecture Decisions

- [decisions made that affect the system design]

## Session Notes

- [context needed to resume in the next session]
```

The agent updates this file after every unit. You update
it when you make architectural decisions or resolve open
questions. By the end of the project, it is a complete
record of every decision that was made and why.