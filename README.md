# Cold Outbound Skills

Open-source [Claude Code skills](https://docs.anthropic.com/en/docs/claude-code/skills) for cold email infrastructure, lead sourcing, copywriting, and operations. Built by [GrowthEngineX](https://growthengine-x.com) from patterns across 1,000+ real B2B campaigns.

### Track 2 — Infrastructure
- **`zapmail-domain-setup-public`** — buy `.com`/`.co` domains on Dynadot, provision inboxes on Zapmail
- **`smartlead-inbox-manager`** — warmup settings, signatures (name/title/company/address), active/insurance tagging
- **`email-deliverability-audit`** — diagnostic tool (SPF/DKIM/DMARC, spam placement, 1% rule)
- **`deliverability-incident-response`** — triage playbook for spam, bounces, blacklists, warmup blocks

```
cold-email-ai-skills/
  README.md                    # this file
  .env.example                 # template for your API keys
  skills/
    <skill-name>/
      SKILL.md                 # the skill definition (required)
      scripts/                 # runnable code
      references/              # deeper docs
  profiles/                    # YOUR client profiles + experiment logs (gitignored)
    <business-slug>/
      client-profile.yaml
      experiments/
      scores/
```

## Cost expectations

First campaign (2,000 leads, 20 domains, 40 inboxes):
- Domains: ~$240 one-time (20 × ~$12 .com). Fall back to .co (~$8-30) if .com is taken.
- Zapmail: ~$60/mo for 40 inboxes
- Prospeo: ~$20 for 2,000-lead export
- Smartlead: ~$39/mo starter plan
- MillionVerifier: ~$5 for 2,000 validations
- **Month 1 total: ~$360. Recurring: ~$130/mo.**

See `skills/cold-email-starter-kit/references/00-getting-started.md` for full breakdown.

## A note on ethics

Cold email is legal when done right, but it's a privilege. Don't spam. Don't email consumers. Honor unsubscribes instantly. Include a real physical address. Be the kind of sender you'd want to receive email from.

The best cold emails are the ones the recipient is glad they got.

## Contributing

This repo is a collection of patterns refined over thousands of real campaigns. Improvements welcome — PRs should include:
- Real-world test results (not theoretical changes)
- Generalizable insight (not hyper-specific to one industry)
- Keep beginner-friendliness as the north star

## License

MIT — use it, fork it, profit from it. Attribution appreciated but not required.
