import { test } from 'node:test'
import assert from 'node:assert/strict'

import { MAX_PANEL_RECORDS, MAX_PANEL_ROWS, mergePanelViews } from '../src/ledger-panel.js'

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

test('the panel forwards detail lists with the larger detail budget', () => {
  const long = Array.from({ length: MAX_PANEL_RECORDS + 10 }, (_, index) => ({ id: `f-${index}` }))
  const merged = mergePanelViews(
    { ...next, records: { facts: long, intents: long, totals: { facts: long.length } } },
    coverage,
    review,
  )
  assert.equal(merged.records.facts.length, MAX_PANEL_RECORDS)
  assert.equal(merged.records.intents.length, MAX_PANEL_RECORDS)
  assert.equal(merged.records.totals.facts, long.length)
  assert.equal(mergePanelViews(next, coverage, review).records, undefined, 'older payloads stay valid')
})

test('a family of huge rows is trimmed by bytes, keeping the newest', () => {
  const rows = Array.from({ length: 200 }, (_, index) => ({ id: `f-${index}`, detail: 'x'.repeat(4000) }))
  const merged = mergePanelViews(
    { ...next, records: { facts: rows, totals: { facts: rows.length } } },
    coverage,
    review,
  )
  assert.ok(merged.records.facts.length > 0)
  assert.ok(merged.records.facts.length < rows.length, 'a byte budget trimmed the list')
  assert.equal(merged.records.facts.at(-1).id, 'f-199', 'the newest row survives')
  assert.ok(JSON.stringify(merged.records.facts).length < 130 * 1024)
})

test('the byte budget never empties a family that has rows', () => {
  const rows = Array.from({ length: 3 }, (_, index) => ({ id: `f-${index}`, detail: 'x'.repeat(500 * 1024) }))
  const merged = mergePanelViews({ ...next, records: { facts: rows } }, coverage, review)
  assert.equal(merged.records.facts.length, 1, 'one oversized row still ships, otherwise the page lies')
})

test('the byte budget counts UTF-8 bytes, not UTF-16 code units', () => {
  const rows = Array.from({ length: 200 }, (_, index) => ({ id: `f-${index}`, detail: '中'.repeat(340) }))
  const merged = mergePanelViews({ ...next, records: { facts: rows } }, coverage, review)
  const bytes = Buffer.byteLength(JSON.stringify(merged.records.facts), 'utf8')
  assert.ok(bytes <= 130 * 1024, `cjk rows must respect the budget, got ${bytes}`)
  assert.ok(merged.records.facts.length < rows.length)
})
