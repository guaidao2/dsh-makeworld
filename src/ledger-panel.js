/**
 * Read-only HTTP surface for the ledger page.
 *
 * The Web client cannot read files, so it asks the host for a snapshot of the
 * ledger that belongs to one **live session's working directory**. Two
 * sessions in the same workspace intentionally share one ledger; a closed
 * session has no working directory to resolve, so it is a 404 here.
 *
 *   GET /makeworld/ledger?session=<sessionId>          → next + coverage + review
 *   GET /makeworld/ledger?session=<id>&view=report     → the markdown deliverable
 *   GET /makeworld/ledger?session=<id>&view=templates  → relation templates
 *
 * Read-only by construction: nothing here mutates the ledger.
 *
 * @module dsh-makeworld/ledger-panel
 */

export const name = 'makeworld-ledger-page'

export const inject = ['webServer', 'sessions', 'makeworldLedger']

/** Lists are capped so one page open cannot ship a megabyte of JSON. */
export const MAX_PANEL_ROWS = 50

function writeJson(res, status, payload) {
  if (res.headersSent === true) return
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  res.end(JSON.stringify(payload))
}

/** Trim a list to the panel budget, keeping the head (the ranked part). */
function head(list, limit = MAX_PANEL_ROWS) {
  const items = Array.isArray(list) ? list : []
  return items.length > limit ? items.slice(0, limit) : items
}

/**
 * Merge the three views the page renders into one payload.
 * Pure, so the shape is testable without a server or a session.
 */
export function mergePanelViews(next, coverage, review) {
  const gaps = next.gaps ?? {}
  return {
    initialized: next.initialized === true,
    hint: next.hint,
    ledger: next.ledger,
    task: next.task ?? null,
    lastAt: next.lastAt ?? '',
    counts: next.counts ?? {},
    frontier: head(next.frontier),
    gaps: {
      assumed: head(gaps.assumed),
      negative: head(gaps.negative),
      blockedIntents: head(gaps.blockedIntents),
      openGoals: head(gaps.openGoals),
      untestedEntities: head(gaps.untestedEntities),
      staleFacts: head(gaps.staleFacts),
      retiredEvidence: head(gaps.retiredEvidence),
      unsupportedClaims: head(gaps.unsupportedClaims),
    },
    causal: next.causal ?? {},
    hypotheses: head(next.hypotheses),
    templates: head(next.templates),
    ledgerProblems: head(next.ledgerProblems),
    ledgerProblemCount: next.ledgerProblemCount ?? (next.ledgerProblems ?? []).length,
    scoreNote: next.scoreNote ?? '',
    coverage: {
      total: coverage.total ?? 0,
      evidenced: coverage.evidenced ?? 0,
      observed: coverage.observed ?? 0,
      untouched: coverage.untouched ?? 0,
      entities: head(coverage.entities),
    },
    review: head(review.items),
    broken: next.broken ?? 0,
    brokenLines: head(next.brokenLines),
  }
}

/** The page's data endpoint. */
export function apply(ctx) {
  const service = ctx.makeworldLedger
  if (service === undefined) throw new Error(`${name} requires the ledger service row`)

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/makeworld/ledger',
    handler: async (req, res, peer) => {
      // Exact routes bypass the Gateway's access checks, so the owner check is
      // ours. It only bites on host builds whose web server admits requests with
      // a `peer` (the admission API); older builds pass no third argument, and
      // there the route inherits the server's own auth mode.
      if (peer !== undefined && peer?.principal?.kind !== 'owner') {
        writeJson(res, 403, { error: 'owner access required' })
        return
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        writeJson(res, 405, { error: 'method not allowed' })
        return
      }
      const url = new URL(req.url ?? '/', 'http://localhost')
      const sessionId = url.searchParams.get('session') ?? ''
      if (sessionId === '') {
        writeJson(res, 400, { error: 'session query parameter is required' })
        return
      }
      const session = ctx.sessions.get(sessionId)
      if (session === undefined) {
        writeJson(res, 404, { error: 'unknown or closed session' })
        return
      }
      const view = url.searchParams.get('view') ?? ''
      try {
        if (req.method === 'HEAD') {
          if (res.headersSent !== true) {
            res.writeHead(200, { 'cache-control': 'no-store' })
            res.end()
          }
          return
        }
        if (view === 'report' || view === 'ledger') {
          const result = await service.read(session, view)
          writeJson(res, 200, { ledger: result.ledger, markdown: view === 'report' ? result.report : result.markdown })
          return
        }
        if (view === 'templates') {
          const result = await service.read(session, 'templates')
          writeJson(res, 200, { ledger: result.ledger, templates: head(result.templates), note: result.note ?? '' })
          return
        }
        if (view !== '') {
          writeJson(res, 400, { error: `unknown view "${view}"; expected report, templates, ledger or none` })
          return
        }
        const snapshot = await service.panel(session)
        writeJson(res, 200, mergePanelViews(snapshot.next, snapshot.coverage, snapshot.review))
      } catch (error) {
        writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))
}
