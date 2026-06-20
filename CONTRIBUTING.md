# Contributing

Thanks for helping build Open DB Nexus.

## Development Flow

1. Install dependencies with `npm install`.
2. Create a focused branch such as `feature/project-setup`.
3. Make a small, reviewable change.
4. Run `npm run check`.
5. Use Conventional Commits.

Example commit messages:

```txt
chore(project): initialize vscode extension project
build(project): add typescript and bundler config
test(core): add message helper tests
docs(readme): add initial project overview
```

## Pull Request Checklist

- Code compiles.
- Tests pass.
- Lint passes.
- Documentation is updated when behavior changes.
- No secrets are logged or committed.
