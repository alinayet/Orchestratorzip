import * as p from '@clack/prompts'
import { ENV_GROUPS, requireEnv, readMailboxes, exportMailboxesToInstantly } from '../_lib.ts'

requireEnv(ENV_GROUPS.zapmail)

p.intro('🔗 Skill 3 — Push Accounts to Instantly AI')

let data: {
  total_domains?: number
  total_mailboxes?: number
  domains?: { domain: string; mailboxes: { email: string; status: string; mailboxId: string }[] }[]
}

try {
  data = await readMailboxes()
} catch {
  p.log.error('❌ mailboxes.json not found. Run setup-mailboxes.ts first.')
  process.exit(1)
}

const { total_domains, total_mailboxes, domains } = data

if (!domains || domains.length === 0) {
  p.log.error('❌ No mailboxes found in mailboxes.json.')
  process.exit(1)
}

p.log.info(`Found ${total_mailboxes} mailbox(es) across ${total_domains} domain(s):`)
for (const d of domains) {
  for (const mb of d.mailboxes) {
    p.log.info(`  • ${mb.email} (${mb.status})`)
  }
}

p.log.info(
  'Uses Zapmail export to your linked Instantly account.\n' +
  'If you have multiple Instantly accounts in Zapmail, set ZAPMAIL_INSTANTLY_THIRD_PARTY_ACCOUNT_ID in .env'
)

const confirmPush = await p.confirm({
  message: `Export ACTIVE mailboxes to Instantly via Zapmail. Proceed?`,
})
if (p.isCancel(confirmPush) || !confirmPush) {
  p.cancel('Cancelled')
  process.exit(0)
}

const allMailboxIds = domains.flatMap(d =>
  d.mailboxes.filter(mb => mb.mailboxId && mb.status === 'ACTIVE').map(mb => mb.mailboxId)
)

if (allMailboxIds.length === 0) {
  p.log.error('❌ No ACTIVE mailboxes with IDs. Wait for provisioning or re-run setup-mailboxes.')
  process.exit(1)
}

const spinner = p.spinner()
spinner.start('Exporting via Zapmail...')

try {
  await exportMailboxesToInstantly(allMailboxIds)
  spinner.stop('Export started ✓')

  for (const d of domains) {
    for (const mb of d.mailboxes) {
      if (mb.mailboxId && mb.status === 'ACTIVE') {
        p.log.success(`✓ ${mb.email} → Instantly (queued)`)
      }
    }
  }
} catch (err) {
  spinner.stop('Export failed')
  p.log.error(`❌ ${err}`)
  p.log.info('Link Instantly in Zapmail → Settings → Integrations, then retry.')
  process.exit(1)
}

p.outro('Done — run instantly-warmup (MCP) next.')
