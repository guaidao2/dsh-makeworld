import { test } from 'node:test'
import assert from 'node:assert/strict'

import { foldLedgerEvent } from '../src/ledger-version.js'

const call = (callId, name) => ({ type: 'tool/call', data: { callId, name } })
const result = (callId, extra = {}) => ({ at: '2026-11-24T08:00:00.000Z', type: 'tool/result', data: { message: { toolCallId: callId }, ...extra } })

test('a cairn_write result bumps the revision', () => {
  assert.equal(foldLedgerEvent(null, call('c1', 'cairn_write')), null, 'a call alone changes nothing')
  const next = foldLedgerEvent(null, result('c1'))
  assert.deepEqual(next, { revision: 1, lastAt: '2026-11-24T08:00:00.000Z', tool: 'cairn_write', failed: false })
  const again = foldLedgerEvent(next, call('c2', 'cairn_settle'))
  assert.equal(again, next, 'unrelated events keep the same reference')
})

test('read-only tools never bump the revision', () => {
  foldLedgerEvent(null, call('r1', 'cairn_read'))
  assert.equal(foldLedgerEvent(null, result('r1')), null)
  foldLedgerEvent(null, call('r2', 'cairn_export'))
  assert.equal(foldLedgerEvent(null, result('r2')), null)
})

test('foreign tools and unknown call ids are ignored', () => {
  foldLedgerEvent(null, call('x1', 'bash'))
  assert.equal(foldLedgerEvent(null, result('x1')), null)
  assert.equal(foldLedgerEvent(null, result('nope')), null)
})

test('a failed write still bumps, and says so', () => {
  foldLedgerEvent(null, call('f1', 'cairn_write'))
  const next = foldLedgerEvent(null, result('f1', { isError: true }))
  assert.equal(next.revision, 1)
  assert.equal(next.failed, true)
})

test('the revision only grows', () => {
  let state = null
  for (const id of ['a', 'b', 'c']) {
    foldLedgerEvent(state, call(id, 'cairn_write'))
    state = foldLedgerEvent(state, result(id))
  }
  assert.equal(state.revision, 3)
})
