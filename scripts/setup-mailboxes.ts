import * as p from '@clack/prompts'
import {
  ENV_GROUPS,
  requireEnv,
  readDomains,
  saveMailboxes,
  wait,
  getDomainIdMap,
  assignMailboxes,
  listAllMailboxes,
  exportMailboxesToInstantly,
  type MailboxAssignInput,
} from '../_lib.ts'

requireEnv(ENV_GROUPS.zapmail)

p.intro('📬 Skill 2 — Mailbox Setup')

const domains = await readDomains()

if (domains.length === 0) {
  p.log.error('❌ domains.txt is empty. Run setup-domains.ts and npm run connect first.')
  process.exit(1)
}

p.log.info(`Found ${domains.length} domain(s) in domains.txt:`)
for (const d of domains) p.log.info(`  • ${d}`)

const mailboxCount = await p.text({
  message: 'How many mailboxes per domain? (1–5)',
  placeholder: 'e.g. 3',
  validate: v => {
    const n = Number(v)
    if (isNaN(n) || n < 1 || n > 5) return 'Enter a number between 1 and 5'
  },
})
if (p.isCancel(mailboxCount)) {
  p.cancel('Cancelled')
  process.exit(0)
}

const prefix = await p.text({
  message: 'Mailbox prefix?',
  placeholder: 'e.g. outreach → outreach1, outreach2',
  validate: v => (!v ? 'Required' : undefined),
})
if (p.isCancel(prefix)) {
  p.cancel('Cancelled')
  process.exit(0)
}

const firstName = await p.text({
  message: 'Sender first name?',
  placeholder: `e.g. ${process.env.SENDER_FIRST_NAME || 'Nait'}`,
  initialValue: process.env.SENDER_FIRST_NAME || '',
  validate: v => (!v ? 'Required' : undefined),
})
if (p.isCancel(firstName)) {
  p.cancel('Cancelled')
  process.exit(0)
}

const lastName = await p.text({
  message: 'Sender last name?',
  placeholder: `e.g. ${process.env.SENDER_LAST_NAME || 'Allen'}`,
  initialValue: process.env.SENDER_LAST_NAME || '',
  validate: v => (!v ? 'Required' : undefined),
})
if (p.isCancel(lastName)) {
  p.cancel('Cancelled')
  process.exit(0)
}

const count = Number(mailboxCount)
const totalMailboxes = domains.length * count

const preview = domains.flatMap(domain =>
  Array.from({ length: count }, (_, i) => `  • ${prefix}${i + 1}@${domain}`)
)

p.log.info(`\nI'll create ${totalMailboxes} mailbox(es):\n${preview.join('\n')}`)
p.log.info(
  'Export uses your Instantly account linked in Zapmail (Settings → Integrations).\n' +
  'INSTANTLY_API_KEY in .env is for MCP warmup only.'
)

const confirmCreate = await p.confirm({
  message: `Create ${totalMailboxes} mailboxes across ${domains.length} domain(s). Proceed?`,
})
if (p.isCancel(confirmCreate) || !confirmCreate) {
  p.cancel('Cancelled')
  process.exit(0)
}

const idSpinner = p.spinner()
idSpinner.start('Resolving Zapmail domain IDs...')

let domainIdMap: Map<string, string>
try {
  domainIdMap = await getDomainIdMap(domains)
  idSpinner.stop('Domain IDs resolved')
} catch (err) {
  idSpinner.stop('Failed to resolve domain IDs')
  p.log.error(`❌ ${err}`)
  process.exit(1)
}

const missing = domains.filter(d => !domainIdMap.has(d))
if (missing.length > 0) {
  p.log.error(`❌ Not connected in Zapmail: ${missing.join(', ')}`)
  p.log.info('Run: npm run connect — wait until domains show SUCCESS, then retry.')
  process.exit(1)
}

const assignPayload: Record<string, MailboxAssignInput[]> = {}
for (const domain of domains) {
  const domainId = domainIdMap.get(domain)!
  assignPayload[domainId] = Array.from({ length: count }, (_, i) => ({
    firstName: firstName as string,
    lastName: lastName as string,
    mailboxUsername: `${prefix}${i + 1}`,
    domainName: domain,
  }))
}

const spinner = p.spinner()
spinner.start('Assigning mailboxes in Zapmail...')

try {
  await assignMailboxes(assignPayload)
  spinner.stop('Mailboxes assigned — waiting for ACTIVE status...')
} catch (err) {
  spinner.stop('Failed to assign mailboxes')
  p.log.error(`❌ ${err}`)
  process.exit(1)
}

type MbRow = { email: string; mailboxId: string; status: string }
const result: Record<string, MbRow[]> = {}
for (const domain of domains) {
  result[domain] = Array.from({ length: count }, (_, i) => ({
    email: `${prefix}${i + 1}@${domain}`,
    mailboxId: '',
    status: 'PENDING',
  }))
}

const pollSpinner = p.spinner()
pollSpinner.start('Checking mailbox status...')

const MAX_ATTEMPTS = 30
let attempts = 0
let allActive = false

while (!allActive && attempts < MAX_ATTEMPTS) {
  await wait(10)
  attempts++

  try {
    const mailboxes = await listAllMailboxes()
    let activeCount = 0

    for (const domain of domains) {
      for (const mb of result[domain]) {
        const found = mailboxes.find(m => m.email.toLowerCase() === mb.email.toLowerCase())
        if (found) {
          mb.mailboxId = found.id
          mb.status = found.status
          if (found.status === 'ACTIVE') activeCount++
        }
      }
    }

    pollSpinner.message(`${activeCount}/${totalMailboxes} ACTIVE (attempt ${attempts}/${MAX_ATTEMPTS})`)
    if (activeCount === totalMailboxes) allActive = true
  } catch {
    p.log.warn(`⚠️  Poll attempt ${attempts} failed — retrying...`)
  }
}

if (!allActive) {
  pollSpinner.stop('⚠️  Some mailboxes not ACTIVE after timeout')
  p.log.warn('Check Zapmail dashboard — mailboxes may still be provisioning.')
} else {
  pollSpinner.stop('All mailboxes ACTIVE ✓')
}

const allMailboxIds: string[] = []

for (const domain of domains) {
  for (const mb of result[domain]) {
    if (mb.status === 'ACTIVE') {
      p.log.success(`✓ ${mb.email}`)
      if (mb.mailboxId) allMailboxIds.push(mb.mailboxId)
    } else {
      p.log.warn(`⏳ ${mb.email} (${mb.status || 'pending'})`)
    }
  }
}

await saveMailboxes({
  _info: 'Auto-generated by setup-mailboxes.ts — do not edit manually',
  created_at: new Date().toISOString(),
  total_domains: domains.length,
  total_mailboxes: totalMailboxes,
  domains: Object.entries(result).map(([domain, mailboxes]) => ({
    domain,
    mailboxes,
  })),
})

p.log.success('✓ Saved backup to mailboxes.json')

const confirmExport = await p.confirm({
  message: `Export ${allMailboxIds.length} ACTIVE mailbox(es) to Instantly via Zapmail?`,
})
if (p.isCancel(confirmExport) || !confirmExport) {
  p.log.warn('Skipped export. Run npm run push when ready.')
  p.outro('Done — mailboxes created, export skipped.')
  process.exit(0)
}

if (allMailboxIds.length === 0) {
  p.log.error('❌ No ACTIVE mailboxes with IDs to export.')
  process.exit(1)
}

const exportSpinner = p.spinner()
exportSpinner.start('Exporting to Instantly via Zapmail...')

try {
  await exportMailboxesToInstantly(allMailboxIds)
  exportSpinner.stop('Export started ✓')
  p.log.success('✓ Export queued — may take a few minutes in Zapmail')
} catch (err) {
  exportSpinner.stop('Export failed')
  p.log.error(`❌ ${err}`)
  p.log.info('Link Instantly in Zapmail (Settings → Integrations), then: npm run push')
}

p.outro('Done — run instantly-warmup (MCP) next to activate warmup.')
