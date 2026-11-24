/**
 * The ledger service (`ctx.makeworldLedger`): resolves one session's working
 * directory and delegates everything else to the plain file layer.
 *
 * The service stays thin on purpose. `files.js` holds the behaviour and is
 * testable without Cordis; this class only knows how to map a session to a
 * directory and how to expose the operations on the Host service registry.
 *
 * @module dsh-makeworld/service
 */

import { Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

import { DEFAULT_DIR, Ledger } from './files.js'

export default class MakeworldLedger extends Service {
  static inject = ['workingDirectory']

  static Config = z.object({
    dirName: z.string().default(DEFAULT_DIR),
    writeMarkdown: z.boolean().default(true),
  })

  constructor(ctx, config = {}) {
    super(ctx, 'makeworldLedger')
    this.ledger = new Ledger(config)
    ctx.effect(() => () => {
      this.ledger.cache.clear()
      this.ledger.queues.clear()
    }, 'makeworld:ledger')
  }

  /** Session working directory, falling back to the process directory. */
  cwdOf(session) {
    try {
      return this.ctx.workingDirectory.get(session)
    } catch {
      return process.cwd()
    }
  }

  /** Absolute ledger directory for one session. */
  root(session) {
    return this.ledger.root(this.cwdOf(session))
  }

  open(session, actor, input) {
    return this.ledger.open(this.root(session), actor, input)
  }

  write(session, actor, records) {
    return this.ledger.write(this.root(session), actor, records)
  }

  settle(session, actor, input) {
    return this.ledger.settle(this.root(session), actor, input)
  }

  read(session, view, options) {
    return this.ledger.read(this.root(session), view, options)
  }

  panel(session) {
    return this.ledger.panel(this.root(session))
  }

  exportBundle(session) {
    return this.ledger.exportBundle(this.root(session))
  }

  archives(session) {
    return this.ledger.archives(this.root(session))
  }
}
