import { test } from 'node:test'
import assert from 'node:assert/strict'

import { MAX_PANEL_ROWS, mergePanelViews } from '../src/ledger-panel.js'

const next = {
  initialized: true,
  ledger: 'C:/work/.cairn',
  task: { subject: 'repo', objective: 'fix cache' },
  counts: { goals: 1, intents: 2, facts: 3, claims: 1, entities: 2, evidence: 1, templates: 0 },
  frontier: [{ id: 'i-1', title: 'repro', score: 1.2, ready: true }],
  gaps: { assumed: [], negative: [], untestedEntities: [], unsupportedClaims: [] },
  causal: { cycles: [], danglingRefs: [], danglingRefCount: 0 },
  hypotheses: [],
  templates: [],
  ledgerProblems: [],
  scoreNote: 'heuristic',
  broken: 0,
}

const coverage = { total: 2, evidenced: 1, observed: 1, untouched: 0, entities: [{ id: 'x-1', tier: 'evidenced' }] }
const review = { items: [{ kind: 'goal', ref: 'g-1', status: 'incomplete', text: 'g' }] }

test('the panel merges the three views into one payload', () => {
  const merged = mergePanelViews(next, coverage, review)
  assert.equal(merged.initialized, true)
  assert.equal(merged.task.objective, 'fix cache')
  assert.deepEqual(merged.coverage, { total: 2, evidenced: 1, observed: 1, untouched: 0, entities: [{ id: 'x-1', tier: 'evidenced' }] })
  assert.equal(merged.review.length, 1)
  assert.equal(merged.frontier[0].id, 'i-1')
})

test('a missing or partial view degrades to empty collections', () => {
  const merged = mergePanelViews({ initialized: false, hint: 'open first' }, {}, {})
  assert.equal(merged.initialized, false)
  assert.equal(merged.hint, 'open first')
  assert.deepEqual(merged.frontier, [])
  for (const key of ['assumed', 'negative', 'blockedIntents', 'openGoals', 'untestedEntities', 'staleFacts', 'retiredEvidence', 'unsupportedClaims']) {
    assert.deepEqual(merged.gaps[key], [], `gaps.${key} must degrade to an array`)
  }
  assert.deepEqual(merged.review, [])
  assert.deepEqual(merged.coverage, { total: 0, evidenced: 0, observed: 0, untouched: 0, entities: [] })
})

test('every list is capped so one page open cannot ship a megabyte', () => {
  const long = Array.from({ length: MAX_PANEL_ROWS + 20 }, (_, index) => ({ id: `f-${index}` }))
  const merged = mergePanelViews(
    { ...next, frontier: long, templates: long, ledgerProblems: long, hypotheses: long, gaps: { assumed: long } },
    { ...coverage, entities: long },
    { items: long },
  )
  for (const list of [merged.frontier, merged.templates, merged.ledgerProblems, merged.hypotheses, merged.gaps.assumed, merged.coverage.entities, merged.review]) {
    assert.equal(list.length, MAX_PANEL_ROWS)
  }
})

test('the merge reports data health instead of hiding it', () => {
  const merged = mergePanelViews({ ...next, broken: 2, ledgerProblems: [{ kind: 'unknownOp', seq: 4 }] }, coverage, review)
  assert.equal(merged.broken, 2)
  assert.equal(merged.ledgerProblemCount, 1)
  assert.equal(merged.ledgerProblems[0].kind, 'unknownOp')
})
