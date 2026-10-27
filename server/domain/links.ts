import type { Db } from "../db.js";
import { bad, notFound } from "../validate.js";

export interface Links {
  account_id?: string | null;
  contact_id?: string | null;
  deal_id?: string | null;
}

/**
 * The one place that decides whether a record may point at an account, contact and deal.
 * Every linked record must belong to the owner and not be archived, and the contact and deal
 * must belong to the same account. Fills in the account from the deal when it's missing.
 */
export async function resolveLinks(t: Db, owner: string, links: Links): Promise<Links> {
  const out: Links = { ...links };

  if (out.deal_id) {
    const deal = await t.one<{ account_id: string }>(
      "select account_id from deals where id = $1 and owner_id = $2 and archived_at is null",
      [out.deal_id, owner],
    );
    if (!deal) throw notFound("That deal");
    if (!out.account_id) out.account_id = deal.account_id;
    else if (out.account_id !== deal.account_id) throw bad("That deal belongs to a different account.");
  }

  if (out.account_id) {
    const account = await t.one("select 1 from accounts where id = $1 and owner_id = $2 and archived_at is null", [
      out.account_id,
      owner,
    ]);
    if (!account) throw notFound("That account");
  }

  if (out.contact_id) {
    const contact = await t.one<{ name: string; account_id: string | null }>(
      "select name, account_id from contacts where id = $1 and owner_id = $2 and archived_at is null",
      [out.contact_id, owner],
    );
    if (!contact) throw notFound("That contact");
    if (out.account_id && contact.account_id && contact.account_id !== out.account_id) {
      throw bad(`${contact.name} is a contact at a different account.`);
    }
  }

  return out;
}
