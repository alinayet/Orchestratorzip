# Outbound Infra — Project Memory

## What This Project Does
Automates the full outbound email infrastructure setup:
1. Buy & register domains (Dynadot)
2. Connect domains to Zapmail (Dynadot NS + Zapmail connect)
3. Create mailboxes + export to Instantly (Zapmail)
4. Activate warmup (Instantly MCP)

## Tech Stack
- Language: TypeScript
- Runner: tsx (run scripts with `npx tsx scripts/<file>.ts`)
- Interactive prompts: @clack/prompts
- Node.js 18+

## Project Structure
```
outbound-infra/
├── .env                          ← API keys (copy from .env.example)
├── env                           ← alternate env file (also loaded)
├── CLAUDE.md                     ← this file
├── domains.txt                   ← output of skill 1
├── mailboxes.json                ← output of skill 2
├── package.json
├── _lib.ts                       ← shared API clients
├── run-all.ts                    ← full pipeline runner
└── scripts/
    ├── setup-domains.ts          ← skill 1
    ├── connect-domains.ts        ← skill 1b (NS + Zapmail)
    ├── setup-mailboxes.ts        ← skill 2
    ├── push-accounts.ts          ← skill 3 (safety net)
    ├── verify-setup.ts           ← smoke / API check
    └── instantly-warmup/
        └── INSTRUCTIONS.md       ← skill 4 (MCP only)
```

## Environment Variables (.env)
```
DYNADOT_API_KEY=
ZAPMAIL_API_KEY=
ZAPMAIL_WORKSPACE_KEY=
ZAPMAIL_SERVICE_PROVIDER=GOOGLE    # GOOGLE or MICROSOFT
INSTANTLY_API_KEY=                  # MCP warmup only

ZAPMAIL_INSTANTLY_THIRD_PARTY_ACCOUNT_ID=   # optional, if multiple Instantly links

SENDER_FIRST_NAME=
SENDER_LAST_NAME=
SENDER_COMPANY=
SENDER_PHYSICAL_ADDRESS=
```

**Instantly export:** Link Instantly in Zapmail (Settings → Integrations). Export uses Zapmail `POST /exports/mailboxes`, not `INSTANTLY_API_KEY`.

## APIs
- Dynadot: `key` query param — https://api.dynadot.com/api3.json
- Zapmail: headers `x-auth-zapmail` / `x-workspace-key` / `x-service-provider` — https://api.zapmail.ai/api/v2
- Instantly MCP: https://mcp.instantly.ai/mcp/YOUR_API_KEY

## Data Flow
```
setup-domains.ts    → domains.txt
connect-domains.ts  → Dynadot set_ns + Zapmail connect-domain (poll)
setup-mailboxes.ts  → mailboxes.json + Zapmail export to Instantly
push-accounts.ts    → re-export from mailboxes.json (safety net)
instantly-warmup    → MCP per INSTRUCTIONS.md
```

## npm Scripts
- `npm run domains` — buy domains
- `npm run connect` — point NS to Zapmail and connect
- `npm run mailboxes` — create mailboxes + export
- `npm run push` — re-export
- `npm run verify` — check env + API connectivity
- `npm run all` — full interactive pipeline

## Interaction Rules
- Every script is interactive — ask questions one at a time using @clack/prompts
- Direct user inputs → no confirmation needed
- Claude-generated decisions → always confirm before proceeding
- Always confirm before any action that costs money or makes changes
- If a step fails, stop and clearly print the error
- Show progress for every domain/account

## Conventions
- All API keys from process.env — never hardcode
- Scripts validate only the env keys they need (see `ENV_GROUPS` in `_lib.ts`)
- Save output files after every successful step
- @clack/prompts only — never readline or inquirer
