import { execSync } from 'child_process'
import * as p from '@clack/prompts'

p.intro('🚀 Outbound Infra — Full Pipeline')

const steps = [
  {
    label: '1. Buy & register domains (Dynadot)',
    command: 'npx tsx scripts/setup-domains.ts',
  },
  {
    label: '2. Connect domains to Zapmail (NS + DNS)',
    command: 'npx tsx scripts/connect-domains.ts',
  },
  {
    label: '3. Create mailboxes + export to Instantly',
    command: 'npx tsx scripts/setup-mailboxes.ts',
  },
  {
    label: '4. Push accounts to Instantly (safety net)',
    command: 'npx tsx scripts/push-accounts.ts',
    optional: true,
  },
]

for (const step of steps) {
  if (step.optional) {
    const run = await p.confirm({
      message: `Run optional step: ${step.label}?`,
    })
    if (p.isCancel(run) || !run) {
      p.log.warn(`⏭️  Skipped: ${step.label}`)
      continue
    }
  }

  p.log.step(`▶ ${step.label}`)

  try {
    execSync(step.command, { stdio: 'inherit' })
    p.log.success(`✓ Done: ${step.label}`)
  } catch {
    p.log.error(`❌ Failed at: ${step.label}`)
    p.log.info(`Run manually: ${step.command}`)
    process.exit(1)
  }
}

p.log.success('✓ Scripted steps complete')
p.log.info('Skill 4 (warmup): see scripts/instantly-warmup/INSTRUCTIONS.md')
p.log.info('In Claude Code: "run instantly-warmup" with Instantly MCP enabled')
p.outro('Done 🎉')
