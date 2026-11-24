/**
 * Bundle row: the five model-facing tools plus the protocol section.
 *
 * This row is the whole "install" step. Add it to any preset — 标准模式,
 * 创造模式, your own — and that session gets a ledger. There is no makeworld
 * mode to enter.
 *
 * @module dsh-makeworld/tools-row
 */

import z from '@deepseek-ai/schemastery'
import { registerLedger } from './makeworld/tools.js'

export const name = 'makeworld-tools'

export const inject = ['tools', 'systemPrompt', 'makeworldLedger']

/** The subagent registry is optional; it only improves the `actor` in the log. */

export const Config = z.object({
  promptSection: z.boolean().default(true),
})

export function apply(ctx, config = {}) {
  registerLedger(ctx, config)
}
