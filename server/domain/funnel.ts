// The acquisition funnel: logged contact moves an account forward on its own.
import type { Db } from "../db.js";
import { advanceStatus, type AccountStatus, type StatusMove } from "../../shared/model.js";

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
  return { account_id: accountId, account_name: acc.name, from: acc.status, to };
}
