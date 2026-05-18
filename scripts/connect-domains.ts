import * as p from '@clack/prompts'
import {
  ENV_GROUPS,
  requireEnv,
  readDomains,
  dynadot,
  ZAPMAIL_NAMESERVERS,
  connectDomainsToZapmail,
  parseConnectDomainStatuses,
  allDomainsConnected,
  anyConnectTerminalFailure,
  wait,
} from '../_lib.ts'

requireEnv([...ENV_GROUPS.dynadot, ...ENV_GROUPS.zapmail])

p.intro('🔗 Connect Domains to Zapmail')

const domains = await readDomains()

if (domains.length === 0) {
  p.log.error('❌ domains.txt is empty. Run setup-domains.ts first.')
  process.exit(1)
}

p.log.info(`Found ${domains.length} domain(s):`)
for (const d of domains) p.log.info(`  • ${d}`)

p.log.info(
  `\nThis will:\n` +
  `  1. Set Dynadot nameservers to Zapmail:\n` +
  ZAPMAIL_NAMESERVERS.map(ns => `     • ${ns}`).join('\n') +
  `\n  2. Start Zapmail domain connection (DNS may take up to 48h)\n`
)

const confirm = await p.confirm({
  message: `Update nameservers and connect ${domains.length} domain(s) to Zapmail. Proceed?`,
})
if (p.isCancel(confirm) || !confirm) {
  p.cancel('Cancelled')
  process.exit(0)
}

// ── Step 1: Dynadot nameservers ──
const nsSpinner = p.spinner()
nsSpinner.start('Setting nameservers on Dynadot...')

try {
  await dynadot.setNameservers(domains)
  nsSpinner.stop('Nameservers updated on Dynadot ✓')
  for (const d of domains) p.log.success(`✓ NS → ${d}`)
} catch (err) {
  nsSpinner.stop('Failed to set nameservers')
  p.log.error(`❌ ${err}`)
  process.exit(1)
}

// ── Step 2: Zapmail connect + poll ──
const connectSpinner = p.spinner()
connectSpinner.start('Connecting domains in Zapmail...')

try {
  const initial = await connectDomainsToZapmail(domains)
  let statuses = parseConnectDomainStatuses(initial, domains)

  const MAX_ATTEMPTS = 60
  let attempts = 0

  while (!allDomainsConnected(statuses) && attempts < MAX_ATTEMPTS) {
    if (anyConnectTerminalFailure(statuses)) break

    const pending = Object.entries(statuses)
      .filter(([, s]) => s !== 'SUCCESS' && s !== 'DOMAIN_ALREADY_CONNECTED')
      .map(([d, s]) => `${d} (${s})`)

    connectSpinner.message(
      `Waiting for DNS… ${attempts + 1}/${MAX_ATTEMPTS} — ${pending.join(', ') || 'checking'}`
    )

    await wait(30)
    attempts++

    const poll = await connectDomainsToZapmail(domains)
    statuses = parseConnectDomainStatuses(poll, domains)
  }

  connectSpinner.stop('Connection check complete')

  let allOk = true
  for (const d of domains) {
    const status = statuses[d]
    if (status === 'SUCCESS' || status === 'DOMAIN_ALREADY_CONNECTED') {
      p.log.success(`✓ ${d} — ${status}`)
    } else {
      allOk = false
      p.log.warn(`⏳ ${d} — ${status}`)
    }
  }

  if (!allOk) {
    p.log.warn(
      'Some domains are still pending. DNS propagation can take hours.\n' +
      'Re-run: npm run connect — then setup-mailboxes when all show SUCCESS in Zapmail.'
    )
    process.exit(1)
  }

  p.outro('Done — domains connected. Run npm run mailboxes next.')
} catch (err) {
  connectSpinner.stop('Failed to connect domains')
  p.log.error(`❌ ${err}`)
  process.exit(1)
}
