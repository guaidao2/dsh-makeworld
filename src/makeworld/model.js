/**
 * Record vocabularies and the pure fold that turns the append-only event log
 * into the belief state.
 *
 * The log is the truth: every change is one `op` line, nothing is overwritten.
 * Folding replays the log in file order, so the same file always yields the
 * same state and an old verdict stays readable after a newer one lands.
 *
 * @module dsh-makeworld/model
 */

/** Closed vocabularies. Tools validate against these; views assume them. */
export const BASES = ['observed', 'inferred', 'assumed', 'negative']
export const GOAL_STATES = ['open', 'met', 'abandoned']
export const INTENT_STATES = ['open', 'running', 'paused', 'done', 'blocked', 'exhausted', 'stopped']
export const CLAIM_KINDS = ['defect', 'risk', 'insight', 'decision', 'artifact', 'answer']
export const CLAIM_STATES = ['pending', 'confirmed', 'resolved', 'rejected', 'accepted']
export const ENTITY_KINDS = ['file', 'module', 'service', 'dataset', 'doc', 'system', 'topic', 'person', 'other']
export const EVIDENCE_KINDS = ['command', 'file', 'log', 'http', 'measure', 'text', 'image']
export const PLAN_STATES = ['suspected', 'validated', 'blocked']
export const VERDICTS = ['done', 'blocked', 'met', 'abandoned', 'holds', 'refuted', 'stale', 'reopen', 'retire']

/** Which verdicts each ref family accepts. Anything else is a caller error. */
export const VERDICTS_FOR = {
  goal: ['met', 'abandoned', 'reopen'],
  intent: ['done', 'blocked', 'stale', 'reopen'],
  claim: ['holds', 'refuted', 'stale', 'reopen'],
  fact: ['holds', 'refuted', 'stale', 'reopen'],
  evidence: ['retire'],
}

/** Record families the single write tool accepts. */
export const WRITE_KINDS = [
  'goal', 'intent', 'fact', 'claim', 'entity', 'evidence',
  'chain', 'plan', 'constraint', 'hint', 'note', 'template',
]

/** The field that holds a family-specific subtype, normalized to `type`. */
export const TYPE_FIELD = {
  fact: 'factKind', claim: 'claimKind', entity: 'entityKind', evidence: 'evidenceKind',
}

/** Id prefix per record family. Kept short: ids show up in every view. */
export const ID_PREFIX = {
  goal: 'g', intent: 'i', fact: 'f', claim: 'c', entity: 'x', evidence: 'e',
  chain: 'k', plan: 'p', recheck: 'r', hint: 'h', constraint: 'n', note: 'm',
  template: 't',
}

/** Timestamp helper shared by the service and the tests. */
export function nowIso() {
  return new Date().toISOString()
}

/** Parse one jsonl log, tolerating truncated or hand-edited lines. */
export function parseLog(content) {
  const events = []
  const brokenLines = []
  const lines = String(content).split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim()
    if (trimmed === '') continue
    try {
      events.push(JSON.parse(trimmed))
    } catch {
      brokenLines.push(index + 1)
    }
  }
  return { events, broken: brokenLines.length, brokenLines }
}

/** Coerce to a trimmed string. */
export function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/** A finite number or the fallback (0 is a real value, not a missing one). */
export function numberOr(value, fallback) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Clamp into 0..1 with a fallback. */
export function clamp01(value, fallback) {
  const parsed = numberOr(value, Number.NaN)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.min(1, parsed))
}

/** Clamp an integer into a range with a fallback. */
export function clampInt(value, min, max, fallback) {
  const parsed = numberOr(value, Number.NaN)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.round(parsed)))
}

/** Empty state for a fresh ledger. */
export function emptyState() {
  return {
    task: null,
    goals: [],
    intents: [],
    facts: [],
    claims: [],
    entities: [],
    evidence: [],
    chains: [],
    plans: [],
    rechecks: [],
    hints: [],
    constraints: [],
    notes: [],
    templates: [],
    edges: [],
    events: 0,
    lastAt: '',
    seq: 0,
  }
}

/** Family list keyed by record kind. */
const FAMILY = {
  goal: 'goals', intent: 'intents', fact: 'facts', claim: 'claims', entity: 'entities',
  evidence: 'evidence', chain: 'chains', plan: 'plans', recheck: 'rechecks',
  hint: 'hints', constraint: 'constraints', note: 'notes', template: 'templates',
}

/** Look up the array that holds one family. */
export function familyOf(kind) {
  return FAMILY[kind]
}

/** Every family key. */
export function familyKeys() {
  return Object.keys(FAMILY)
}

/** Next deterministic id for one family, skipping ids already in use. */
export function nextId(state, kind, reserved = new Set()) {
  const list = FAMILY[kind] === undefined ? [] : state[FAMILY[kind]]
  const prefix = ID_PREFIX[kind] ?? 'z'
  const pattern = new RegExp(`^${prefix}-(\\d+)$`)
  let highest = 0
  for (const record of list) {
    const match = pattern.exec(record.id ?? '')
    if (match !== null) highest = Math.max(highest, Number(match[1]))
  }
  for (const id of reserved) {
    const match = pattern.exec(id)
    if (match !== null) highest = Math.max(highest, Number(match[1]))
  }
  let candidate = `${prefix}-${highest + 1}`
  while (list.some(record => record.id === candidate) || reserved.has(candidate)) {
    highest += 1
    candidate = `${prefix}-${highest + 1}`
  }
  return candidate
}

/** Replace one record in place, preserving list order. */
function upsert(list, record) {
  const at = list.findIndex(item => item.id === record.id)
  if (at < 0) list.push(record)
  else list[at] = { ...list[at], ...record }
}

/** Merge a status patch into an existing record; unknown ids are ignored. */
function patchStatus(list, id, patch) {
  const at = list.findIndex(item => item.id === id)
  if (at < 0) return false
  list[at] = { ...list[at], ...patch, kind: list[at].kind, updatedAt: patch.updatedAt ?? nowIso() }
  return true
}

/**
 * Fold the event log into state.
 * @param events - parsed lines in file order.
 * @returns belief state plus reference problems.
 */
export function fold(events) {
  const state = emptyState()
  const problems = []

  for (const raw of events) {
    const seq = state.seq + 1
    state.seq = seq
    state.events = seq
    const at = typeof raw?.at === 'string' && raw.at !== '' ? raw.at : nowIso()
    state.lastAt = at
    const op = typeof raw?.op === 'string' ? raw.op : ''
    const id = typeof raw?.id === 'string' ? raw.id : ''
    const body = raw?.body !== null && typeof raw?.body === 'object' && !Array.isArray(raw?.body) ? raw.body : {}
    const actor = typeof raw?.actor === 'string' && raw.actor !== '' ? raw.actor : 'agent'

    if (op === 'task.open') {
      const previous = state.task ?? {}
      state.task = {
        subject: text(body.subject) || previous.subject || '',
        objective: text(body.objective) || previous.objective || '',
        acceptance: text(body.acceptance) || previous.acceptance || '',
        status: text(body.status) || previous.status || 'active',
        openedAt: state.task?.openedAt ?? at,
        updatedAt: at,
      }
      continue
    }

    if (op === 'record.add') {
      const kind = text(body.kind)
      const list = FAMILY[kind] === undefined ? undefined : state[FAMILY[kind]]
      if (list === undefined) {
        problems.push({ kind: 'unknownRecordKind', seq, value: kind })
        continue
      }
      if (id === '') {
        problems.push({ kind: 'missingRecordId', seq, value: kind })
        continue
      }
      const record = { ...body }
      // Logs written before the `type` rename still carry the family-specific key.
      if (record.type === undefined) {
        const legacy = TYPE_FIELD[record.kind]
        if (legacy !== undefined && record[legacy] !== undefined) record.type = record[legacy]
      }
      if (list.some(item => item.id === id)) problems.push({ kind: 'duplicateRecordId', seq, value: id })
      upsert(list, { ...record, id, createdAt: at, actor, seq })
      continue
    }

    if (op === 'record.status') {
      const kind = text(body.kind)
      const list = FAMILY[kind] === undefined ? undefined : state[FAMILY[kind]]
      if (list === undefined) {
        problems.push({ kind: 'unknownRecordKind', seq, value: kind })
        continue
      }
      const fields = body.fields !== null && typeof body.fields === 'object' && !Array.isArray(body.fields) ? { ...body.fields } : {}
      delete fields.id
      delete fields.kind
      if (!patchStatus(list, id, fields)) problems.push({ kind: 'unknownRef', seq, value: id })
      continue
    }

    if (op === 'graph.touch') {
      const srcId = text(body.srcId)
      const dstId = text(body.dstId)
      const edgeKind = text(body.kind) || 'leads_to'
      if (srcId === '' || dstId === '') {
        problems.push({ kind: 'missingEdgeEnd', seq, value: `${srcId}->${dstId}` })
        continue
      }
      const at0 = state.edges.findIndex(edge => edge.srcId === srcId && edge.dstId === dstId && edge.kind === edgeKind)
      const weight = clamp01(body.weight, 0.5)
      const pheromone = clamp01(body.pheromone, 0.5)
      if (at0 < 0) state.edges.push({ id: `ed-${state.edges.length + 1}`, kind: edgeKind, srcId, dstId, weight, pheromone, updatedAt: at })
      else state.edges[at0] = { ...state.edges[at0], weight, pheromone, updatedAt: at }
      continue
    }

    problems.push({ kind: 'unknownOp', seq, value: op })
  }

  state.problems = problems
  return { state, problems, dangling: referenceProblems(state) }
}

/** Every id the graph can point at. */
export function knownIds(state) {
  const ids = new Set()
  for (const family of Object.values(FAMILY)) {
    for (const record of state[family]) ids.add(record.id)
  }
  return ids
}

/**
 * References that point at nothing.
 *
 * The frontier, the coverage tiers and the report all read through these
 * fields, so a silent dangling id turns into a confidently wrong answer.
 */
export const REF_FIELDS = ['goalId', 'intentId', 'claimId', 'parentId', 'entityIds', 'evidenceIds', 'derivedFromFactIds']

/** Which family each reference field must point at. */
export const REF_TARGET = {
  goalId: 'goal',
  intentId: 'intent',
  claimId: 'claim',
  parentId: 'entity',
  entityIds: 'entity',
  evidenceIds: 'evidence',
  derivedFromFactIds: 'fact',
}

/** Record id -> family, for type-aware reference checks. */
export function familyById(state) {
  const map = new Map()
  for (const kind of familyKeys()) for (const record of state[familyOf(kind)] ?? []) map.set(record.id, kind)
  return map
}

/**
 * References that point at nothing, or at the wrong kind of record.
 *
 * `evidenceIds: ['g-1']` is as wrong as a missing id: the coverage tier and the
 * frontier both read these fields, so a loosely-typed reference silently buys
 * credibility.
 */
export function referenceProblems(state) {
  const byId = familyById(state)
  const problems = []
  const check = (owner, field, value) => {
    if (value === '' || value === undefined) return
    const kind = byId.get(value)
    if (kind === undefined) {
      problems.push({ kind: 'danglingRef', owner, field, value })
      return
    }
    const expected = REF_TARGET[field]
    if (expected !== undefined && kind !== expected) {
      problems.push({ kind: 'wrongRefKind', owner, field, value, expected, actual: kind })
    }
  }
  for (const kind of familyKeys()) {
    for (const record of state[familyOf(kind)] ?? []) {
      for (const field of REF_FIELDS) {
        const value = record[field]
        if (Array.isArray(value)) for (const item of value) check(record.id, field, item)
        else if (typeof value === 'string') check(record.id, field, value)
      }
    }
  }
  // Edges live outside FAMILY because they are keyed by src/dst, not by a family row.
  for (const edge of state.edges ?? []) {
    check(edge.id, 'srcId', edge.srcId)
    check(edge.id, 'dstId', edge.dstId)
  }
  return problems
}

/** Active belief: not dismissed, not stale. */
export function activeFacts(state) {
  return state.facts.filter(fact => fact.state !== 'dismissed' && fact.state !== 'stale')
}

/** A claim still standing: not rejected, and not a duplicate. */
export function liveClaims(state) {
  return state.claims.filter(claim => claim.status !== 'rejected')
}

/**
 * Entities by evidence tier.
 *
 *   evidenced  a live claim anchors it, or a fact with evidence anchors it
 *   observed   a fact with an observation basis anchors it, but carries no evidence
 *   untouched  only assumptions point at it, or nothing does
 *
 * Assumptions alone never raise a tier: "we think this service exists" is not
 * an observation of the service.
 */
export function entityTiers(state) {
  const tiers = new Map()
  for (const entity of state.entities) tiers.set(entity.id, 'untouched')
  const rank = { untouched: 0, observed: 1, evidenced: 2 }
  const raise = (id, tier) => {
    if (!tiers.has(id)) return
    if (rank[tier] > rank[tiers.get(id)]) tiers.set(id, tier)
  }
  const evidenceState = new Map((state.evidence ?? []).map(item => [item.id, item.state]))
  const liveEvidence = ids => (ids ?? []).filter(id => evidenceState.get(id) === 'active')
  for (const fact of activeFacts(state)) {
    const evidenced = liveEvidence(fact.evidenceIds).length > 0
    const observed = fact.basis === 'observed' || fact.basis === 'inferred' || fact.basis === 'negative'
    const tier = evidenced ? 'evidenced' : observed ? 'observed' : 'untouched'
    for (const entityId of fact.entityIds ?? []) raise(entityId, tier)
  }
  // A claim without evidence is a reading, not an observation of the entity.
  for (const claim of liveClaims(state)) {
    if (liveEvidence(claim.evidenceIds).length === 0) continue
    for (const entityId of claim.entityIds ?? []) raise(entityId, 'evidenced')
  }
  return tiers
}

/** Entities no observation reaches. */
export function untestedEntities(state) {
  const tiers = entityTiers(state)
  return state.entities.filter(entity => tiers.get(entity.id) === 'untouched')
}

/**
 * Frontier score for one intent.
 *
 * Heuristic, and labelled as such everywhere it surfaces: readiness is a gate,
 * the rest is `uncertainty × breadth / cost`. `decides` is the one field that
 * makes the number mean anything — it names how many competing readings this
 * experiment could separate.
 */
export function intentScore(intent, state) {
  const factIds = new Set(activeFacts(state).map(fact => fact.id))
  const missing = (intent.derivedFromFactIds ?? []).filter(id => !factIds.has(id))
  const ready = missing.length === 0
  const uncertainty = clamp01(intent.uncertainty, 0.5)
  const cost = clampInt(intent.cost, 1, 5, 2)
  const decides = Array.isArray(intent.decides) ? intent.decides.length : 0
  const leverage = 1 + (intent.entityIds ?? []).length + (intent.goalId ? 1 : 0)
  const score = ready ? (uncertainty * (1 + decides) * leverage) / cost : -1
  return { ready, missing, score: Math.round(score * 1000) / 1000 }
}

/** Intents still in play, best first. */
export function frontier(state, limit = 6) {
  const size = Math.max(0, Math.min(50, Number.isFinite(limit) ? Math.trunc(limit) : 6))
  const metGoalIds = new Set(state.goals.filter(goal => goal.status === 'met').map(goal => goal.id))
  return state.intents
    .filter(intent => (intent.state ?? 'open') === 'open' || intent.state === 'running')
    .filter(intent => !(intent.goalId && metGoalIds.has(intent.goalId)))
    .map((intent) => {
      const scored = intentScore(intent, state)
      return {
        id: intent.id,
        title: intent.title,
        state: intent.state ?? 'open',
        goalId: intent.goalId ?? '',
        decides: intent.decides ?? [],
        uncertainty: clamp01(intent.uncertainty, 0.5),
        cost: clampInt(intent.cost, 1, 5, 2),
        expectedObservation: intent.expectedObservation ?? '',
        ready: scored.ready,
        missingDeps: scored.missing,
        score: scored.score,
      }
    })
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, size)
}

/** Competing readings of the same subject, grouped by subject + fact type. */
export function hypotheses(state) {
  const groups = new Map()
  for (const fact of state.facts) {
    if (fact.state === 'dismissed' || fact.state === 'stale') continue
    const key = `${fact.subject ?? ''}\u0000${fact.type ?? 'info'}`
    if (!groups.has(key)) {
      groups.set(key, { subject: fact.subject ?? '', type: fact.type ?? 'info', basis: { observed: [], inferred: [], assumed: [], negative: [] } })
    }
    groups.get(key).basis[fact.basis]?.push(fact.id)
  }
  return [...groups.values()].filter(group => group.basis.negative.length > 0 || group.basis.assumed.length > 0 || group.basis.observed.length > 1)
}

/**
 * Replay the belief state without a set of facts/evidence and report what
 * changes. Read-only: it never writes, and it exists to answer "does this
 * conclusion still stand if that observation was wrong?".
 */
export function counterfactual(state, removeIds = []) {
  const removed = new Set(removeIds)
  const byId = familyById(state)
  const unsupported = [...removed].filter(id => !['fact', 'evidence', 'claim', 'recheck'].includes(byId.get(id) ?? ''))
  if (unsupported.length > 0) {
    const detail = unsupported.map(id => `${id}${byId.has(id) ? ` is a ${byId.get(id)}` : ' does not exist'}`).join(', ')
    throw new Error(`counterfactual replays facts, evidence and claims only: ${detail}`)
  }
  const strip = record => ({ ...record, evidenceIds: (record.evidenceIds ?? []).filter(id => !removed.has(id)) })
  const keptFacts = state.facts.filter(fact => !removed.has(fact.id))
  const keptClaims = state.claims.filter(claim => !removed.has(claim.id))
  const facts = keptFacts.map(strip)
  const evidence = state.evidence.filter(item => !removed.has(item.id))
  const claims = keptClaims.map(strip)
  const before = entityTiers(state)
  const after = entityTiers({ ...state, facts, evidence, claims })
  const countTier = (tiers, tier) => [...tiers.values()].filter(value => value === tier).length
  /** Support is lost when every evidence id a record cited is being removed. */
  const losesSupport = (record) => {
    const cited = record.evidenceIds ?? []
    return cited.length > 0 && cited.every(id => removed.has(id))
  }
  return {
    removed: [...removed],
    removedFacts: state.facts.filter(fact => removed.has(fact.id)).map(fact => fact.id),
    removedEvidence: state.evidence.filter(item => removed.has(item.id)).map(item => item.id),
    factsLosingSupport: keptFacts.filter(losesSupport).map(fact => ({ id: fact.id, detail: fact.detail })),
    claimsLosingSupport: keptClaims.filter(losesSupport).map(claim => ({ id: claim.id, title: claim.title })),
    hypothesesBefore: hypotheses(state).length,
    hypothesesAfter: hypotheses({ ...state, facts }).length,
    coverageBefore: { evidenced: countTier(before, 'evidenced'), observed: countTier(before, 'observed'), untouched: countTier(before, 'untouched') },
    coverageAfter: { evidenced: countTier(after, 'evidenced'), observed: countTier(after, 'observed'), untouched: countTier(after, 'untouched') },
    danglingEdges: state.edges.filter(edge => removed.has(edge.srcId) || removed.has(edge.dstId)).length,
  }
}

/** Directed cycles over recorded edges. */
export function findCycles(edges) {
  const adjacency = new Map()
  for (const edge of edges) {
    if (!adjacency.has(edge.srcId)) adjacency.set(edge.srcId, [])
    adjacency.get(edge.srcId).push(edge.dstId)
  }
  const color = new Map()
  const stack = []
  const cycles = []
  const visit = (node) => {
    color.set(node, 1)
    stack.push(node)
    for (const next of adjacency.get(node) ?? []) {
      if (color.get(next) === 1) {
        const start = stack.indexOf(next)
        if (start >= 0) cycles.push([...stack.slice(start), next])
      } else if (color.get(next) !== 2) {
        visit(next)
      }
    }
    stack.pop()
    color.set(node, 2)
  }
  for (const node of adjacency.keys()) if (color.get(node) === undefined) visit(node)
  return cycles
}
