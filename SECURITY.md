# Security Policy

## Supported Versions

Open DB Nexus is pre-release software. Security fixes are applied to the latest development version.

## Reporting a Vulnerability

Please report suspected vulnerabilities privately to the project maintainer before opening a public issue.

Include:

- A clear description of the issue.
- Steps to reproduce.
- Impact and affected versions, if known.
- Any relevant logs with secrets removed.

## Security Principles

- Store passwords and tokens with VS Code `SecretStorage`.
- Do not log passwords, tokens, connection strings, or query results containing sensitive data.
- Do not send secrets to webviews.
- Use strict Content Security Policy for future webviews.
- Treat database metadata and query history as user data.
