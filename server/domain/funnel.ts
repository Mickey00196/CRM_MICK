// The acquisition funnel: logged contact moves an account forward on its own.
import type { Db } from "../db.js";
import { accountStatusLabel, advanceStatus, type AccountStatus, type StatusMove } from "../../shared/model.js";

/** Moves the account along the funnel after contact is logged; returns the move, if any. */
export async function advanceAccount(
  t: Db,
  owner: string,
  accountId: string | null,
  channel: string,
  outcome: string | null,
): Promise<StatusMove | null> {
  if (!accountId) return null;
  const acc = await t.one<{ name: string; status: AccountStatus }>(
    "select name, status from accounts where id = $1 and owner_id = $2 for update",
    [accountId, owner],
  );
  if (!acc) return null;
  const to = advanceStatus(acc.status, channel, outcome);
  if (!to) return null;
  await t.q("update accounts set status = $2 where id = $1", [accountId, to]);
  await recordStageChange(t, owner, accountId, acc.status, to);
  return { account_id: accountId, account_name: acc.name, from: acc.status, to };
}

/** Writes "Moved to Proposal" into the account's log, so the log shows each stage the account went through. */
export async function recordStageChange(t: Db, owner: string, accountId: string, from: AccountStatus, to: AccountStatus) {
  if (from === to) return;
  await t.q(
    `insert into activities (owner_id, account_id, channel, summary, stage, source)
     values ($1, $2, 'stage', $3, $4, 'manual')`,
    [owner, accountId, `${accountStatusLabel(from)} → ${accountStatusLabel(to)}`, to],
  );
}

/** Sets an account's status and logs the move. Returns the previous status, or null if not found. */
export async function setAccountStatus(t: Db, owner: string, accountId: string, to: AccountStatus): Promise<AccountStatus | null> {
  const acc = await t.one<{ status: AccountStatus }>(
    "select status from accounts where id = $1 and owner_id = $2 and archived_at is null for update",
    [accountId, owner],
  );
  if (!acc) return null;
  if (acc.status !== to) {
    await t.q("update accounts set status = $2 where id = $1", [accountId, to]);
    await recordStageChange(t, owner, accountId, acc.status, to);
  }
  return acc.status;
}
