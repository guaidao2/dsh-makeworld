/**
 * Bundle row: the ledger service (`ctx.makeworldLedger`).
 *
 * Mounted once at the profile root, so every session and every subagent shares
 * one implementation. Each session still owns its own directory under its
 * working directory; the service only resolves the path.
 *
 * @module dsh-makeworld/ledger
 */

export { default } from './makeworld/service.js'
