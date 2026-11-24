/**
 * Session projection: a ledger revision counter.
 *
 * The ledger lives in a file, not in the session log, so the Web page cannot
 * read it from a projection. What the session log *does* carry is every
 * `cairn_*` tool call — so this projection folds those into a monotonic
 * revision. The page subscribes to it and re-reads the file when the revision
 * moves, which is how the old 灵眼 panel stayed in sync without polling: one
 * authoritative write signal, no blind timer.
 *
 * The fold is pure and returns the same reference for unrelated events.
 *
 * @module dsh-makeworld/ledger-version
 */

import { z } from 'zod'

export const name = 'makeworld-ledger-version'

/** Tool names whose results mean "the ledger file changed". */
export const LEDGER_TOOLS = ['cairn_open', 'cairn_write', 'cairn_settle', 'cairn_export', 'cairn_read']

/** Tools that only read: they never bump the revision. */
const READ_ONLY_TOOLS = new Set(['cairn_read', 'cairn_export'])

/** Loose wire schema: the payload is produced host-side. */
const stateSchema = z.any()

/** callId -> tool name for calls whose result has not been folded yet. */
const pendingCalls = new Map()

/**
 * Fold one committed session event into the revision state.
 * @param state - previous state; `null` before the first write.
 * @param event - committed session event.
 * @returns next state, or the same reference when the event is irrelevant.
 */
export function foldLedgerEvent(state, event) {
  if (event?.type === 'tool/call' && typeof event.data?.name === 'string') {
    if (pendingCalls.size > 2000) pendingCalls.clear()
    pendingCalls.set(String(event.data.callId), event.data.name)
    return state
  }
  if (event?.type !== 'tool/result') return state
  const callId = String(event.data?.message?.toolCallId ?? event.data?.callId ?? '')
  const toolName = pendingCalls.get(callId)
  if (toolName === undefined) return state
  pendingCalls.delete(callId)
  if (!LEDGER_TOOLS.includes(toolName) || READ_ONLY_TOOLS.has(toolName)) return state

  const previous = state ?? { revision: 0, lastAt: '', tool: '' }
  const failed = event.data?.isError === true || event.data?.message?.isError === true
  return {
    revision: previous.revision + 1,
    lastAt: typeof event.at === 'string' ? event.at : previous.lastAt,
    tool: toolName,
    failed,
  }
}

/** Register the projection on the session-projection registry. */
export function apply(ctx) {
  ctx.inject(['sessionProjections'], (scope) => {
    const registration = scope.sessionProjections.register({
      key: 'makeworldLedger',
      stateSchema,
      init: () => null,
      apply: foldLedgerEvent,
      wire: {
        viewSchema: stateSchema,
        view: state => state,
      },
      // v1: revision + last write time + tool name.
      stateVersion: 1,
    })
    void Promise.resolve(registration).catch(error => {
      scope.logger?.warn?.(`${name}: registration failed: ${error instanceof Error ? error.message : String(error)}`)
    })
  })
}
