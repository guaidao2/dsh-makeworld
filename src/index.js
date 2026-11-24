/**
 * dsh-makeworld — bundle root seat.
 *
 * The package root row exists for two reasons:
 *  - the Web client-modules scanner attributes the browser half to a row that
 *    names the package root, so the root must resolve to a module;
 *  - the host half of this row is inert: the ledger, the tools and the platform
 *    conveniences live on their own subpath rows.
 *
 * use the less, make more.
 *
 * @module dsh-makeworld
 */

/** Host plugin body: no host-side behavior at the package root. */
export function apply() {}
