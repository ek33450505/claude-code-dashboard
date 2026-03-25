# Security Policy

## Scope

This policy covers the **claude-code-dashboard** application only. It does not cover:

- The Anthropic Claude API or Claude Code CLI
- The `claude-agent-teams` configuration (if present)
- Any third-party dependencies (report those to their upstream projects)

> **Important:** claude-code-dashboard is a local-only observability tool. It reads files from your `~/.claude/` directory and serves a local web UI. **Never expose this application to a public network.** The Express backend has no authentication and is not hardened for external access.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest release on `main` | Yes |
| Older releases | No |

Only the most recent release receives security fixes.

## Reporting a Vulnerability

Please do **not** report security vulnerabilities through public GitHub Issues.

Use [GitHub Security Advisories](https://github.com/ek33450505/claude-code-dashboard/security/advisories/new) to submit a private disclosure.

Include:

- A description of the vulnerability and its potential impact
- Steps to reproduce
- Any suggested mitigations, if you have them

### Response Timeline

| Stage | Target |
|-------|--------|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 5 business days |
| Remediation | Within 14-30 days depending on severity |

We will credit reporters in the release notes unless you prefer to remain anonymous.
