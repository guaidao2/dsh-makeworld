/**
 * The model-facing surface: five tools.
 *
 * The previous generation of this plugin registered thirty-five tool names and
 * models only ever used three of them. Each name is a decision the model has to
 * re-make every step, so the surface is the product. Five verbs cover the loop:
 * open the task, write records, read the frontier, settle a ref, export.
 *
 * @module dsh-makeworld/tools
 */

import { tool } from '../tool.js'
import { BASES, CLAIM_KINDS, ENTITY_KINDS, EVIDENCE_KINDS, VERDICTS, VERDICTS_FOR, WRITE_KINDS } from './model.js'
import { LEDGER_PROTOCOL, LEDGER_SECTION, SECTION_ORDER } from './instructions.js'

/** The owning session of one tool call. */
function sessionOf(exec) {
  const session = exec.agent?.session
  if (session === undefined) throw new Error('makeworld tools require an owning agent session')
  return session
}

/**
 * Who wrote this record, for the log.
 *
 * `Agent` carries only an id; the human-facing name (`lead`, `reviewer/checker`)
 * comes from the subagent registry, with the session id as the honest fallback.
 */
function actorOf(ctx, exec) {
  const agent = exec.agent
  try {
    const names = ctx.subagents?.namesOf?.(agent)
    if (typeof names?.self === 'string' && names.self !== '') return names.self
  } catch {
    // No subagent registry in this scope: fall through to the session id.
  }
  return agent?.session?.id ?? agent?.id ?? 'agent'
}

/** Open object output: every view has a different shape. */
const objectOutput = {
  type: 'object',
  additionalProperties: true,
  properties: {},
}

function jsonRender(_args, value) {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

/** One record of any family. Fields are documented in the description. */
const recordSpec = {
  type: 'object',
  additionalProperties: true,
  description: 'One record. `kind` selects the family; extra fields are kept as given.',
  properties: {
    kind: { type: 'string', enum: WRITE_KINDS, required: true, description: 'Record family.' },
    alias: { type: 'string', description: 'Batch-local name; later records reference it as "$alias".' },
    id: { type: 'string', description: 'Omit to allocate one. An id that already exists is refused.' },
    type: {
      type: 'string',
      description: `Subtype. entity: ${ENTITY_KINDS.join('|')}. claim: ${CLAIM_KINDS.join('|')}. evidence: ${EVIDENCE_KINDS.join('|')}. fact: free text. constraint: allow|deny.`,
    },
    basis: { type: 'string', enum: BASES, description: 'fact only: observed | inferred | assumed | negative.' },
    title: { type: 'string', description: 'intent / claim / plan title.' },
    text: { type: 'string', description: 'goal text / constraint / hint / note.' },
    detail: { type: 'string', description: 'fact body, one line.' },
    subject: { type: 'string', description: 'fact: what the belief is about; hypotheses group by subject + type.' },
    label: { type: 'string', description: 'evidence label.' },
    value: { type: 'string', description: 'entity value: path, service, dataset, topic…' },
    expectedObservation: { type: 'string', description: 'intent: what would confirm or refute it.' },
    decides: { type: 'array', items: { type: 'string' }, description: 'intent: names of the competing readings this experiment separates.' },
    uncertainty: { type: 'number', description: 'intent: 0..1, how unsettled this area is.' },
    cost: { type: 'number', description: 'intent: 1..5, how expensive the experiment is.' },
    confidence: { type: 'number', description: 'fact / chain: 0..1.' },
    weight: { type: 'number', description: 'claim: 1..5, how much it matters.' },
    summary: { type: 'string', description: 'claim / plan: one-line summary.' },
    impact: { type: 'string', description: 'claim: what changes if it is true.' },
    status: { type: 'string', description: 'plan: suspected|validated|blocked; claim: pending|confirmed|resolved|rejected|accepted.' },
    cause: { type: 'string', description: 'chain: the upstream condition.' },
    transform: { type: 'string', description: 'chain: what happens in between.' },
    effect: { type: 'string', description: 'chain: the downstream consequence.' },
    claimId: { type: 'string', description: 'evidence: attach it to one claim.' },
    pre: { type: 'string', description: 'template: the precondition that must hold.' },
    action: { type: 'string', description: 'template: the step taken.' },
    observation: { type: 'string', description: 'template: what the step should reveal.' },
    post: { type: 'string', description: 'template: what follows when the observation holds.' },
    name: { type: 'string', description: 'template: short name for the pattern.' },
    steps: { type: 'array', items: { type: 'string' }, description: 'plan: ordered steps.' },
    acceptance: { type: 'string', description: 'goal: what evidence makes it met.' },
    goalId: { type: 'string' },
    intentId: { type: 'string' },
    entityIds: { type: 'array', items: { type: 'string' } },
    evidenceIds: { type: 'array', items: { type: 'string' } },
    derivedFromFactIds: { type: 'array', items: { type: 'string' }, description: 'intent: prerequisite fact ids (readiness gate).' },
    reproduceSteps: { type: 'array', items: { type: 'string' }, description: 'claim: how to check it again.' },
    content: { type: 'string', description: 'evidence: body text; stored by sha256 under .cairn/evidence/.' },
    refPath: { type: 'string', description: 'evidence: path when the body is a file that already exists.' },
    channel: { type: 'string', description: 'evidence: how it was observed (command, http, reading…).' },
    layers: { type: 'array', items: { type: 'string' }, description: 'evidence: per-layer interpretation when decoding is involved.' },
  },
}

/** The write tool description: one example teaches more than a field dump. */
const WRITE_DESCRIPTION = [
  'Append records to the ledger, all or nothing. Up to 24 per call, in dependency order.',
  'Example:',
  '{"records":[{"kind":"entity","alias":"mod","type":"module","value":"src/cache.js"},',
  '{"kind":"evidence","alias":"log","label":"test output","content":"expected fresh, got stale"},',
  '{"kind":"fact","detail":"second read returns the old value","basis":"observed","evidenceIds":["$log"],"entityIds":["$mod"]}]}',
  'A batch is all or nothing: one missing required field rolls back all 24.',
  'Families (`*` = required, everything else optional): intent{title*,expectedObservation,decides[],goalId,derivedFromFactIds[],entityIds[],uncertainty,cost} ·',
  'fact{detail*,basis*,intentId,subject,confidence,evidenceIds[],entityIds[]} ·',
  'claim{title*,type,weight,summary,evidenceIds[],reproduceSteps[]} · entity{type,value*} · evidence{label*, (content|refPath)* one of them, claimId, channel} ·',
  'goal{text*,acceptance} · chain{cause*,effect*,transform} · plan{title*,status} · constraint{text*,type:allow|deny} · hint{text*} · note{text*} ·',
  'template{pre*,action*,observation,post,name} (a reusable relation, not a payload).',
  'A fact without basis is refused; a reference to an id that does not exist is refused (build it earlier in the batch, or use an alias).',
].join('\n')

/** Register the ledger tools plus the protocol section. */
export function registerLedger(ctx, config = {}) {
  const service = ctx.makeworldLedger
  if (service === undefined) throw new Error('dsh-makeworld/tools-row requires the ledger service row')

  if (config.promptSection !== false) {
    ctx.systemPrompt.section({
      name: LEDGER_SECTION,
      order: SECTION_ORDER,
      text: LEDGER_PROTOCOL,
    })
  }

  ctx.tools.register(tool({
    name: 'cairn_open',
    description: 'Open (or adopt) this session\'s ledger at <cwd>/.cairn: subject, objective, acceptance criteria, constraints. Call once when a task is worth tracking; calling again without reset only updates the header. reset:true archives the old log (never deletes it).',
    parameters: {
      subject: { type: 'string', required: true, description: 'What is being worked on: repo, system, dataset, question.' },
      objective: { type: 'string', required: true, description: 'What must be true for the task to be done.' },
      acceptance: { type: 'string', description: 'Acceptance criteria: what evidence makes it done.' },
      constraints: {
        type: 'array',
        items: {
          oneOf: [
            { type: 'string' },
            { type: 'object', additionalProperties: true, properties: { type: { type: 'string', enum: ['allow', 'deny'] }, text: { type: 'string', required: true } } },
          ],
        },
        description: 'Boundaries stated by the user. A bare string is recorded as deny; use {type:"allow"|"deny", text} to be explicit.',
      },
      reset: { type: 'boolean', description: 'Archive the current log and start a new one.' },
    },
    output: { schema: objectOutput, render: jsonRender },
    execute: async (args, exec) => service.open(sessionOf(exec), actorOf(ctx, exec), args),
  }))

  ctx.tools.register(tool({
    name: 'cairn_write',
    description: WRITE_DESCRIPTION,
    parameters: {
      records: { type: 'array', items: recordSpec, required: true, description: 'Records to append.' },
    },
    output: { schema: objectOutput, render: jsonRender },
    execute: async (args, exec) => service.write(sessionOf(exec), actorOf(ctx, exec), args.records),
  }))

  ctx.tools.register(tool({
    name: 'cairn_read',
    description: 'Read the ledger. Default `next`: ranked frontier + belief gaps + templates. `state`: every record (capped). `coverage`: entities by evidenced / observed / untouched. `review`: what is still open. `report` / `ledger`: markdown deliverables. `templates`: reusable relation templates. `counterfactual` with `remove`: replay without those facts/evidence and diff the belief.',
    parameters: {
      view: {
        type: 'string',
        enum: ['next', 'state', 'coverage', 'review', 'report', 'ledger', 'templates', 'counterfactual'],
        description: 'Which view (default next).',
      },
      limit: { type: 'integer', description: 'next: frontier size (default 6, max 20).' },
      remove: { type: 'array', items: { type: 'string' }, description: 'counterfactual: fact or evidence ids to replay without.' },
    },
    output: { schema: objectOutput, render: jsonRender },
    execute: async (args, exec) => service.read(sessionOf(exec), args.view ?? 'next', { limit: args.limit, remove: args.remove }),
  }))

  ctx.tools.register(tool({
    name: 'cairn_settle',
    description: [
      'Record a verdict on one ref. The verdict must fit the ref:',
      `goal: ${VERDICTS_FOR.goal.join('|')} ·`,
      `intent: ${VERDICTS_FOR.intent.join('|')} ·`,
      `claim: ${VERDICTS_FOR.claim.join('|')} ·`,
      `fact: ${VERDICTS_FOR.fact.join('|')}.`,
      'Separately, evidence takes `retire`: it marks the facts that only it supported stale and bumps claims that lose all support back to pending.',
      'Settling a claim also appends an independent recheck record; the original conclusion is never rewritten.',
      'Promoting a fact from assumed to observed needs evidenceIds — otherwise write a new fact.',
    ].join(' '),
    parameters: {
      ref: { type: 'string', required: true, description: 'Record id to settle.' },
      verdict: { type: 'string', enum: VERDICTS, required: true, description: 'Verdict; must belong to the ref family.' },
      evidenceIds: { type: 'array', items: { type: 'string' }, description: 'Evidence ids; for retire this is usually left empty.' },
      reason: { type: 'string', description: 'One line: why.' },
    },
    output: { schema: objectOutput, render: jsonRender },
    execute: async (args, exec) => service.settle(sessionOf(exec), actorOf(ctx, exec), args),
  }))

  ctx.tools.register(tool({
    name: 'cairn_export',
    description: 'Write the deliverables beside the log: report.md, claims.json, coverage.json and a rebuilt LEDGER.md. Returns the absolute paths.',
    parameters: {},
    output: { schema: objectOutput, render: jsonRender },
    execute: async (_args, exec) => service.exportBundle(sessionOf(exec)),
  }))
}
