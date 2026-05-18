# Skill 4 — Instantly Warmup (MCP)

No script for this step. Use **Instantly MCP** in Claude Code after mailboxes are exported.

## Prerequisites

- `INSTANTLY_API_KEY` in `.env`
- Mailboxes exported to Instantly (`npm run mailboxes` or `npm run push`)
- Instantly MCP configured in Claude Code:
  - URL: `https://mcp.instantly.ai/mcp/YOUR_INSTANTLY_API_KEY`

## What to ask Claude

In Claude Code, say:

> Run instantly-warmup: enable warmup on all email accounts that were just added from Zapmail. Use daily warmup limit 30, reply rate 30%, and ramp-up enabled. List each account and confirm warmup is on.

## Agent checklist

1. List email accounts in Instantly (MCP or API) and match addresses from `mailboxes.json`.
2. For each account not yet warming:
   - Enable warmup
   - Set daily limit (~30) and reply rate (~30%)
   - Enable ramp-up if available
3. Print a summary table: email → warmup on/off.
4. If an account is missing, tell the user to wait for Zapmail export to finish and re-run `npm run push`.

## Do not

- Skip accounts silently
- Change sending limits on active campaigns without asking
- Disable warmup on existing accounts unless the user asks
