/**
 * Ledger file layer: append-only events, cached folds, evidence blobs and the
 * derived documents. Plain Node — no Cordis, no Host services.
 *
 * Keeping this layer free of runtime dependencies is deliberate: it is the part
 * that must stay testable with `node --test`, and it is the part that has to
 * keep working after a profile upgrade.
 *
 * Two invariants this file is responsible for:
 *   1. a batch either lands whole or not at all (validate everything, then one
 *      append);
 *   2. a reference that points at nothing is refused at write time, because
 *      every view reads through those references.
 *
 * @module dsh-makeworld/files
 */

import { createHash } from 'node:crypto'
import { appendFile, mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  BASES, CLAIM_KINDS, CLAIM_STATES, EVIDENCE_KINDS, ENTITY_KINDS, GOAL_STATES,
  INTENT_STATES, PLAN_STATES, VERDICTS_FOR, WRITE_KINDS,
  REF_FIELDS, REF_TARGET, activeFacts, clamp01, clampInt, familyById, familyKeys, familyOf, fold, knownIds, nextId,
  nowIso, parseLog, referenceProblems, text,
} from './model.js'
import {
  counterfactualView, coverageView, ledgerMarkdown, nextView, reportMarkdown, reviewView,
  shortSummary, stateView, templatesView,
} from './views.js'

/** Hard caps that keep one view or one batch from eating the context window. */
export const MAX_RECORDS_PER_WRITE = 24
const EXCERPT_CHARS = 280

/** "a"/"an" for error messages. */
function article(word) {
  return /^[aeiou]/i.test(word) ? 'an' : 'a'
}

/** Default directory name for the ledger. */
export const DEFAULT_DIR = '.cairn'

export class Ledger {
  constructor(options = {}) {
    this.dirName = typeof options.dirName === 'string' && options.dirName.trim() !== '' ? options.dirName.trim() : DEFAULT_DIR
    this.writeMarkdown = options.writeMarkdown !== false
    this.cache = new Map()
    this.queues = new Map()
  }

  /** Absolute ledger directory below one session working directory. */
  root(cwd) {
    return path.join(cwd ?? process.cwd(), this.dirName)
  }

  /** Serialize work per ledger directory. A failed task still releases the queue. */
  async serialized(key, task) {
    const previous = this.queues.get(key) ?? Promise.resolve()
    const run = previous.then(task, task)
    const tail = run.then(() => undefined, () => undefined)
    this.queues.set(key, tail)
    tail.then(() => {
      if (this.queues.get(key) === tail) this.queues.delete(key)
    })
    return run
  }

  /** Read the log, reusing a cached fold while the file is untouched. */
  async load(root, options = {}) {
    const file = path.join(root, 'ledger.jsonl')
    let info
    try {
      info = await stat(file)
    } catch {
      return { ...fold([]), events: [], root, file, missing: true, broken: 0, brokenLines: [] }
    }
    const key = `${info.mtimeMs}:${info.size}`
    const cached = this.cache.get(root)
    if (!options.fresh && cached !== undefined && cached.key === key) return cached.value
    const parsed = parseLog(await readFile(file, 'utf8'))
    const value = {
      ...fold(parsed.events),
      events: parsed.events,
      root,
      file,
      missing: false,
      broken: parsed.broken,
      brokenLines: parsed.brokenLines,
    }
    this.cache.set(root, { key, value })
    return value
  }

  /** Append one event and drop the cache. */
  async appendEvents(root, events) {
    if (events.length === 0) return []
    const { state } = await this.load(root)
    const written = []
    let seq = state.seq
    const at = nowIso()
    for (const event of events) {
      seq += 1
      written.push({
        seq,
        at,
        actor: text(event.actor) || 'agent',
        op: event.op,
        id: event.id ?? '',
        body: event.body ?? {},
      })
    }
    await mkdir(root, { recursive: true })
    await appendFile(path.join(root, 'ledger.jsonl'), written.map(record => `${JSON.stringify(record)}\n`).join(''), 'utf8')
    this.cache.delete(root)
    return written
  }

  /** Rewrite the human view after a mutation. */
  async refreshMarkdown(root) {
    if (!this.writeMarkdown) return
    const { state } = await this.load(root, { fresh: true })
    await mkdir(root, { recursive: true })
    await writeFile(path.join(root, 'LEDGER.md'), ledgerMarkdown(state), 'utf8')
  }

  /* ------------------------------------------------------------ operations */

  /**
   * Open (or adopt) a ledger. A second call without `reset` only updates the
   * task header; `reset` archives the old log instead of deleting it.
   */
  async open(root, actor, input = {}) {
    return this.serialized(root, async () => {
      const loaded = await this.load(root)
      const archived = []
      if (input.reset === true && loaded.state.events > 0) {
        const stamp = nowIso().replace(/[:.]/g, '-')
        const to = path.join(root, `ledger.${stamp}.jsonl`)
        await rename(path.join(root, 'ledger.jsonl'), to)
        this.cache.delete(root)
        archived.push(to)
      }
      const previous = archived.length > 0 ? {} : loaded.state.task ?? {}
      const task = {
        subject: text(input.subject) || previous.subject || '',
        objective: text(input.objective) || previous.objective || '',
        acceptance: text(input.acceptance) || previous.acceptance || '',
        status: text(input.status) || previous.status || 'active',
      }
      const constraints = Array.isArray(input.constraints) ? input.constraints : []
      if (constraints.length > MAX_RECORDS_PER_WRITE) {
        throw new Error(`at most ${MAX_RECORDS_PER_WRITE} constraints per call, got ${constraints.length}`)
      }
      const events = [{ op: 'task.open', actor, body: task }]
      // After a reset the numbering starts over: the archived log is not base.
      let state = archived.length > 0 ? fold([]).state : loaded.state
      for (const item of constraints) {
        const body = typeof item === 'string' ? { kind: 'deny', text: item } : item
        const constraintText = text(body?.text)
        if (constraintText === '') throw new Error('constraints: every entry needs text (a bare string, or {type, text})')
        const id = nextId(state, 'constraint', new Set(events.map(event => event.id)))
        const declared = text(body?.type) || text(body?.kind)
        const record = { kind: 'constraint', constraintKind: declared === 'allow' ? 'allow' : 'deny', text: constraintText, origin: 'user' }
        events.push({ op: 'record.add', actor, id, body: record })
        state = { ...state, constraints: [...state.constraints, { id, ...record }] }
      }
      await this.appendEvents(root, events)
      await this.refreshMarkdown(root)
      const final = await this.load(root, { fresh: true })
      return {
        ledger: root,
        files: { events: final.file, markdown: path.join(root, 'LEDGER.md') },
        archived,
        task: final.state.task,
        constraints: final.state.constraints.length,
        summary: shortSummary(final.state),
      }
    })
  }

  /**
   * Validate and normalize one record into `{ id, body }`.
   *
   * `state` is the working state (existing records plus the ones prepared so
   * far in this batch), so ids and references resolve inside the batch.
   */
  prepareRecord(state, record, index, aliases, reserved) {
    const kind = text(record?.kind)
    if (!WRITE_KINDS.includes(kind)) {
      throw new Error(`record[${index}]: unknown kind "${kind}"; expected one of ${WRITE_KINDS.join(', ')}`)
    }
    const fail = message => {
      throw new Error(`record[${index}] (${kind}): ${message}`)
    }
    const resolve = (value, field) => {
      const raw = text(value)
      if (!raw.startsWith('$')) return raw
      const name = raw.slice(1)
      if (!aliases.has(name)) {
        const known = [...aliases.keys()]
        fail(`${field} references alias "${raw}", but no earlier record declared it${known.length > 0 ? ` (known: ${known.join(', ')})` : ''}`)
      }
      return aliases.get(name)
    }
    const resolveList = (list, field) => {
      if (list === undefined || list === null) return []
      if (!Array.isArray(list)) fail(`${field} must be an array`)
      return list.map(item => resolve(item, field)).filter(item => item !== '')
    }

    const explicitId = text(record.id)
    let id
    if (explicitId !== '') {
      if (!/^[a-z]{1,3}-\d+$/.test(explicitId)) fail(`id "${explicitId}" is not an id (expected <prefix>-<number>, e.g. f-3)`)
      if (reserved.has(explicitId)) fail(`id "${explicitId}" is used twice in one batch`)
      if (knownIds(state).has(explicitId)) fail(`id "${explicitId}" already exists; omit id to allocate one`)
      id = explicitId
    } else {
      id = nextId(state, kind, reserved)
    }

    /** Keep every field the caller sent; `alias`, `kind` and `content` are bookkeeping. */
    const keep = (extra = {}) => {
      const body = { ...record, ...extra }
      delete body.alias
      delete body.kind
      delete body.content
      return { kind, ...body }
    }

    if (kind === 'goal') {
      if (text(record.text) === '') fail('goal needs text')
      return { id, body: keep({
        text: text(record.text),
        acceptance: text(record.acceptance),
        status: GOAL_STATES.includes(record.status) ? record.status : 'open',
        evidenceIds: resolveList(record.evidenceIds, 'evidenceIds'),
      }) }
    }

    if (kind === 'intent') {
      if (text(record.title) === '') fail('intent needs title')
      return { id, body: keep({
        title: text(record.title),
        detail: text(record.detail),
        expectedObservation: text(record.expectedObservation),
        state: INTENT_STATES.includes(record.state) ? record.state : 'open',
        goalId: resolve(record.goalId, 'goalId'),
        derivedFromFactIds: resolveList(record.derivedFromFactIds, 'derivedFromFactIds'),
        entityIds: resolveList(record.entityIds, 'entityIds'),
        decides: resolveList(record.decides, 'decides'),
        uncertainty: clamp01(record.uncertainty, 0.5),
        cost: clampInt(record.cost, 1, 5, 2),
        priority: clampInt(record.priority, -100, 100, 0),
      }) }
    }

    if (kind === 'fact') {
      const detail = text(record.detail ?? record.text)
      if (detail === '') fail('fact needs detail')
      if (!BASES.includes(record.basis)) fail(`fact needs basis (${BASES.join('|')}), got "${text(record.basis)}"`)
      return { id, body: keep({
        intentId: resolve(record.intentId, 'intentId'),
        type: text(record.type) || 'info',
        subject: text(record.subject),
        detail,
        basis: record.basis,
        confidence: clamp01(record.confidence, record.basis === 'assumed' ? 0.4 : 0.7),
        provenance: text(record.provenance),
        evidenceIds: resolveList(record.evidenceIds, 'evidenceIds'),
        entityIds: resolveList(record.entityIds, 'entityIds'),
        state: record.state === 'dismissed' ? 'dismissed' : 'active',
      }) }
    }

    if (kind === 'claim') {
      if (text(record.title) === '') fail('claim needs title')
      const declared = text(record.type)
      return { id, body: keep({
        intentId: resolve(record.intentId, 'intentId'),
        type: CLAIM_KINDS.includes(declared) ? declared : 'insight',
        title: text(record.title),
        weight: clampInt(record.weight, 1, 5, 3),
        summary: text(record.summary),
        impact: text(record.impact),
        status: CLAIM_STATES.includes(record.status) ? record.status : 'pending',
        entityIds: resolveList(record.entityIds, 'entityIds'),
        evidenceIds: resolveList(record.evidenceIds, 'evidenceIds'),
        reproduceSteps: resolveList(record.reproduceSteps, 'reproduceSteps'),
        evidenceVersion: clampInt(record.evidenceVersion, 0, 1e6, 0),
      }) }
    }

    if (kind === 'entity') {
      const value = text(record.value)
      if (value === '') fail('entity needs value')
      const declared = text(record.type)
      return { id, body: keep({
        type: ENTITY_KINDS.includes(declared) ? declared : 'other',
        value,
        identifier: text(record.identifier) || value,
        origin: record.origin === 'scope' ? 'scope' : 'discovered',
        parentId: resolve(record.parentId, 'parentId'),
        meta: text(record.meta),
      }) }
    }

    if (kind === 'evidence') {
      const label = text(record.label)
      if (label === '') fail('evidence needs label')
      const declared = text(record.type)
      const content = typeof record.content === 'string' ? record.content : ''
      const refPath = text(record.refPath)
      if (content === '' && refPath === '') fail('evidence needs content or refPath')
      const buffer = content === '' ? undefined : Buffer.from(content, 'utf8')
      return {
        id,
        body: keep({
          intentId: resolve(record.intentId, 'intentId'),
          claimId: resolve(record.claimId, 'claimId'),
          type: EVIDENCE_KINDS.includes(declared) ? declared : 'text',
          label,
          refPath,
          contentSha: buffer === undefined ? '' : createHash('sha256').update(buffer).digest('hex'),
          size: buffer === undefined ? 0 : buffer.byteLength,
          excerpt: content === '' ? '' : content.length > EXCERPT_CHARS ? `${content.slice(0, EXCERPT_CHARS)}…` : content,
          channel: text(record.channel),
          layers: resolveList(record.layers, 'layers'),
          state: 'active',
        }),
        blob: buffer,
      }
    }

    if (kind === 'chain') {
      if (text(record.cause) === '' || text(record.effect) === '') fail('chain needs cause and effect')
      return { id, body: keep({
        cause: text(record.cause),
        transform: text(record.transform),
        effect: text(record.effect),
        evidenceIds: resolveList(record.evidenceIds, 'evidenceIds'),
        confidence: clamp01(record.confidence, 0.6),
      }) }
    }

    if (kind === 'plan') {
      if (text(record.title) === '') fail('plan needs title')
      const steps = Array.isArray(record.steps)
        ? record.steps.map(step => (typeof step === 'string' ? step : text(step?.note ?? step?.text))).filter(Boolean)
        : []
      return { id, body: keep({
        title: text(record.title),
        status: PLAN_STATES.includes(record.status) ? record.status : 'suspected',
        summary: text(record.summary),
        steps,
      }) }
    }

    if (kind === 'constraint') {
      const constraintText = text(record.text)
      if (constraintText === '') fail('constraint needs text')
      return { id, body: keep({
        constraintKind: record.type === 'allow' ? 'allow' : 'deny',
        text: constraintText,
        origin: text(record.origin) || 'user',
      }) }
    }

    if (kind === 'hint') {
      const hintText = text(record.text)
      if (hintText === '') fail('hint needs text')
      return { id, body: keep({ text: hintText, source: record.source === 'human' ? 'human' : 'agent', state: 'active' }) }
    }

    if (kind === 'template') {
      if (text(record.pre) === '' || text(record.action) === '') fail('template needs pre and action')
      return { id, body: keep({
        name: text(record.name),
        pre: text(record.pre),
        action: text(record.action),
        observation: text(record.observation),
        post: text(record.post),
        evidenceIds: resolveList(record.evidenceIds, 'evidenceIds'),
      }) }
    }

    const noteText = text(record.text)
    if (noteText === '') fail('note needs text')
    return { id, body: keep({ text: noteText, intentId: resolve(record.intentId, 'intentId') }) }
  }

  /** Append one or more records: all of them, or none. */
  async write(root, actor, records = []) {
    if (!Array.isArray(records) || records.length === 0) throw new Error('records must be a non-empty array')
    if (records.length > MAX_RECORDS_PER_WRITE) {
      throw new Error(`at most ${MAX_RECORDS_PER_WRITE} records per call, got ${records.length}`)
    }
    return this.serialized(root, async () => {
      const loaded = await this.load(root)
      const aliases = new Map()
      const reserved = new Set()
      const prepared = []
      const blobs = []

      // A batch before open still needs a header; it is part of the same append.
      const header = loaded.state.task === null
        ? [{ op: 'task.open', actor, body: { subject: '未命名任务', objective: '未命名任务', acceptance: '', status: 'active' } }]
        : []

      let working = header.length > 0
        ? { ...loaded.state, task: { subject: '未命名任务', objective: '未命名任务', acceptance: '', status: 'active' } }
        : loaded.state
      for (let index = 0; index < records.length; index += 1) {
        const record = records[index]
        const { id, body, blob } = this.prepareRecord(working, record, index, aliases, reserved)
        const alias = text(record?.alias)
        if (alias !== '') {
          if (aliases.has(alias)) throw new Error(`record[${index}]: alias "${alias}" is already declared`)
          aliases.set(alias, id)
        }
        reserved.add(id)
        prepared.push({ id, body })
        if (blob !== undefined) blobs.push({ sha: body.contentSha, blob })
        // Push into the working state so later records can reference this one.
        working = { ...working, [familyOf(body.kind)]: [...working[familyOf(body.kind)], { id, ...body }] }
      }

      this.assertReferences(working, prepared)

      for (const item of blobs) {
        const dir = path.join(root, 'evidence')
        await mkdir(dir, { recursive: true })
        await writeFile(path.join(dir, `${item.sha}.txt`), item.blob, 'utf8')
      }
      await this.appendEvents(root, [
        ...header,
        ...prepared.map(item => ({ op: 'record.add', actor, id: item.id, body: item.body })),
      ])
      await this.refreshMarkdown(root)
      const final = await this.load(root, { fresh: true })
      return {
        created: prepared.map(item => ({ id: item.id, kind: item.body.kind })),
        aliases: Object.fromEntries(aliases),
        summary: shortSummary(final.state),
        ledger: root,
        untested: coverageView(final.state).untouched,
        danglingRefs: referenceProblems(final.state).length,
      }
    })
  }

  /**
   * Every reference a batch introduced must resolve inside the batch.
   *
   * Scans the generic reference fields rather than a per-family list: unknown
   * fields are kept as given, so a reference can arrive on any record.
   */
  assertReferences(state, prepared) {
    const byId = familyById(state)
    for (const { id, body } of prepared) {
      for (const field of REF_FIELDS) {
        const value = body[field]
        const list = Array.isArray(value) ? value : value === '' || value === undefined ? [] : [value]
        for (const item of list) {
          if (typeof item !== 'string') continue
          const kind = byId.get(item)
          if (kind === undefined) {
            throw new Error(`record ${id}: ${field} points at "${item}", which does not exist yet (create it earlier in this batch, or use an alias)`)
          }
          const expected = REF_TARGET[field]
          if (expected !== undefined && kind !== expected) {
            throw new Error(`record ${id}: ${field} points at "${item}", which is ${article(kind)} ${kind}; it must be ${article(expected)} ${expected}`)
          }
          if (kind === 'evidence' && state.evidence.find(record => record.id === item)?.state === 'retired') {
            throw new Error(`record ${id}: ${field} points at retired evidence "${item}"; retired evidence cannot support a new record`)
          }
        }
      }
    }
  }

  /**
   * Settle: one verdict on one record.
   *
   * The verdict must belong to the ref family; a claim verdict appends an
   * independent recheck record as well. The original record's evidence is
   * never dropped, and a fact is never silently promoted to `observed`.
   */
  async settle(root, actor, input = {}) {
    const ref = text(input.ref)
    const verdict = text(input.verdict)
    if (ref === '') throw new Error('settle needs ref')
    return this.serialized(root, async () => {
      const { state } = await this.load(root)
      const evidenceIds = Array.isArray(input.evidenceIds) ? input.evidenceIds.map(item => text(item)).filter(Boolean) : []
      const reason = text(input.reason ?? input.notes)
      const byId = familyById(state)
      for (const evidenceId of evidenceIds) {
        const kind = byId.get(evidenceId)
        if (kind === undefined) throw new Error(`evidenceIds: "${evidenceId}" does not exist`)
        if (kind !== 'evidence') throw new Error(`evidenceIds: "${evidenceId}" is ${article(kind)} ${kind}, not evidence`)
        if (state.evidence.find(item => item.id === evidenceId)?.state === 'retired') {
          throw new Error(`evidenceIds: "${evidenceId}" is retired; retired evidence cannot support a verdict`)
        }
      }

      const families = familyKeys().filter(kind => (state[familyOf(kind)] ?? []).some(item => item.id === ref))
      if (families.length === 0) throw new Error(`unknown ref "${ref}"`)
      const settlable = families.filter(kind => ['goal', 'intent', 'claim', 'fact', 'evidence'].includes(kind))
      if (settlable.length === 0) throw new Error(`"${ref}" is a ${families[0]}; settle accepts goal, intent, claim, fact or evidence`)
      if (settlable.length > 1) throw new Error(`"${ref}" is ambiguous across families: ${settlable.join(', ')}`)
      const family = settlable[0]
      if (!VERDICTS_FOR[family].includes(verdict)) {
        throw new Error(`verdict "${verdict}" does not apply to a ${family}; use one of ${VERDICTS_FOR[family].join('|')}`)
      }

      const event = { op: 'record.status', actor, id: ref }
      const results = []

      if (family === 'goal') {
        const status = verdict === 'met' ? 'met' : verdict === 'abandoned' ? 'abandoned' : 'open'
        await this.appendEvents(root, [{
          ...event,
          body: { kind: 'goal', fields: { status, evidenceIds: [...new Set([...(state.goals.find(item => item.id === ref).evidenceIds ?? []), ...evidenceIds])], reason } },
        }])
        results.push({ ref, changed: 'goal.status', status })
      }

      if (family === 'intent') {
        const map = { done: 'done', blocked: 'blocked', stale: 'paused', reopen: 'open' }
        const nextState = map[verdict]
        await this.appendEvents(root, [{ ...event, body: { kind: 'intent', fields: { state: nextState, reason } } }])
        results.push({ ref, changed: 'intent.state', state: nextState })
      }

      if (family === 'fact') {
        const fact = state.facts.find(item => item.id === ref)
        const mergedEvidence = [...new Set([...(fact.evidenceIds ?? []), ...evidenceIds])]
        if (verdict === 'holds') {
          if (mergedEvidence.length === 0) {
            throw new Error('promoting a fact to observed needs evidence: pass evidenceIds, or write a new fact instead')
          }
          await this.appendEvents(root, [{ ...event, body: { kind: 'fact', fields: { basis: 'observed', state: 'active', evidenceIds: mergedEvidence, reason } } }])
          results.push({ ref, changed: 'fact', basis: 'observed', state: 'active' })
        } else if (verdict === 'refuted') {
          await this.appendEvents(root, [{ ...event, body: { kind: 'fact', fields: { basis: 'negative', state: 'active', evidenceIds: mergedEvidence, reason } } }])
          results.push({ ref, changed: 'fact', basis: 'negative', state: 'active' })
        } else if (verdict === 'stale') {
          await this.appendEvents(root, [{ ...event, body: { kind: 'fact', fields: { state: 'stale', evidenceIds: mergedEvidence, reason } } }])
          results.push({ ref, changed: 'fact', state: 'stale' })
        } else {
          await this.appendEvents(root, [{ ...event, body: { kind: 'fact', fields: { state: 'active', evidenceIds: mergedEvidence, reason } } }])
          results.push({ ref, changed: 'fact', state: 'active' })
        }
      }

      if (family === 'evidence') {
        const evidence = state.evidence.find(item => item.id === ref)
        if (evidence?.state === 'retired') {
          return { results: [{ ref, changed: 'evidence', state: 'retired', alreadyRetired: true }], summary: shortSummary(state), ledger: root }
        }
        const stillActive = ids => (ids ?? []).filter(id => id !== ref && state.evidence.find(item => item.id === id)?.state === 'active')
        const retiredAt = nowIso()
        await this.appendEvents(root, [{ ...event, body: { kind: 'evidence', fields: { state: 'retired', retiredAt, retiredReason: reason } } }])
        const factsLosingSupport = []
        for (const fact of state.facts) {
          if (!(fact.evidenceIds ?? []).includes(ref)) continue
          if (fact.state === 'stale' || fact.state === 'dismissed') continue
          if (stillActive(fact.evidenceIds).length > 0) continue
          await this.appendEvents(root, [{
            ...event, id: fact.id,
            body: { kind: 'fact', fields: { state: 'stale', reason: `证据 ${ref} 已退役，这条事实失去支撑` } },
          }])
          factsLosingSupport.push(fact.id)
        }
        const claimsBumped = []
        for (const claim of state.claims) {
          if (!(claim.evidenceIds ?? []).includes(ref)) continue
          if (stillActive(claim.evidenceIds).length > 0) continue
          const status = ['confirmed', 'resolved', 'accepted'].includes(claim.status) ? 'pending' : claim.status
          await this.appendEvents(root, [{
            ...event, id: claim.id,
            body: { kind: 'claim', fields: { status, evidenceVersion: (claim.evidenceVersion ?? 0) + 1, reason: `证据 ${ref} 已退役` } },
          }])
          claimsBumped.push(claim.id)
        }
        results.push({ ref, changed: 'evidence', state: 'retired', factsLosingSupport, claimsBumped })
      }

      if (family === 'claim') {
        const claim = state.claims.find(item => item.id === ref)
        const map = { holds: 'confirmed', refuted: 'rejected', stale: 'resolved', reopen: 'pending' }
        const status = map[verdict]
        const events = [{
          ...event,
          body: { kind: 'claim', fields: { status, evidenceIds: [...new Set([...(claim.evidenceIds ?? []), ...evidenceIds])], reason } },
        }]
        const recheckId = nextId(state, 'recheck')
        events.push({
          op: 'record.add',
          actor,
          id: recheckId,
          body: { kind: 'recheck', claimId: ref, verdict, notes: reason, evidenceIds, claimStatusAtCheck: status },
        })
        await this.appendEvents(root, events)
        results.push({ ref, changed: 'claim.status', status, recheck: recheckId })
      }

      await this.refreshMarkdown(root)
      const final = await this.load(root, { fresh: true })
      return { results, summary: shortSummary(final.state), ledger: root }
    })
  }

  /**
   * Everything the ledger page needs, from one fold.
   *
   * The page used to call `read()` three times, which meant three full reloads
   * of the same file per open. This keeps the same views and reads once.
   */
  async panel(root) {
    const loaded = await this.load(root, { fresh: true })
    const state = loaded.state
    return {
      // Same shape `read('next')` returns: the page branches on `initialized`
      // and prints `ledger`, and nextView alone never produces either.
      next: {
        ledger: root,
        initialized: state.task !== null,
        missing: loaded.missing,
        broken: loaded.broken,
        brokenLines: loaded.brokenLines,
        ...nextView(state, {}),
      },
      coverage: coverageView(state),
      review: reviewView(state),
    }
  }

  /** Read one view. */
  async read(root, view = 'next', options = {}) {
    const loaded = await this.load(root, { fresh: true })
    const state = loaded.state
    const broken = loaded.broken
    const brokenLines = loaded.brokenLines
    if (view === 'state') return { ledger: root, initialized: state.task !== null, broken, brokenLines, ...stateView(state) }
    if (view === 'coverage') return { ledger: root, broken, brokenLines, ...coverageView(state) }
    if (view === 'review') return { ledger: root, broken, brokenLines, ...reviewView(state) }
    if (view === 'report') return { ledger: root, broken, brokenLines, report: reportMarkdown(state) }
    if (view === 'templates') return { ledger: root, broken, brokenLines, ...templatesView(state) }
    if (view === 'counterfactual') return { ledger: root, ...counterfactualView(state, options.remove ?? []) }
    if (view === 'ledger') return { ledger: root, broken, brokenLines, markdown: ledgerMarkdown(state) }
    return {
      ledger: root,
      initialized: state.task !== null,
      missing: loaded.missing,
      broken,
      brokenLines,
      ...nextView(state, options),
    }
  }

  /** Write the deliverables next to the log. */
  async exportBundle(root) {
    return this.serialized(root, async () => {
      const { state } = await this.load(root, { fresh: true })
      await mkdir(root, { recursive: true })
      const files = {
        report: path.join(root, 'report.md'),
        claims: path.join(root, 'claims.json'),
        coverage: path.join(root, 'coverage.json'),
        ledger: path.join(root, 'LEDGER.md'),
      }
      await writeFile(files.report, reportMarkdown(state), 'utf8')
      await writeFile(files.claims, JSON.stringify(state.claims, null, 2), 'utf8')
      await writeFile(files.coverage, JSON.stringify(coverageView(state), null, 2), 'utf8')
      await writeFile(files.ledger, ledgerMarkdown(state), 'utf8')
      return { ledger: root, files, counts: { claims: state.claims.length, events: state.events } }
    })
  }

  /** Archived logs kept by `open({ reset: true })`. */
  async archives(root) {
    try {
      const names = await readdir(root)
      return names.filter(name => /^ledger\..*\.jsonl$/.test(name)).map(name => path.join(root, name))
    } catch {
      return []
    }
  }
}

export { activeFacts }
