import type { Db } from "../db.js";
import { bad, notFound } from "../validate.js";

export interface Links {
  account_id?: string | null;
  contact_id?: string | null;
  project_id?: string | null;
}

/**
 * The one place that decides whether a record may point at a company, contact and project.
 * Every linked record must belong to the owner and not be archived. A project's company wins:
 * it fills in the company when missing and rejects a different one. A contact must work at
 * the same company.
 */
export async function resolveLinks(t: Db, owner: string, links: Links): Promise<Links> {
  const out: Links = { ...links };

  if (out.project_id) {
    const project = await t.one<{ account_id: string | null }>(
      "select account_id from projects where id = $1 and owner_id = $2 and archived_at is null",
      [out.project_id, owner],
    );
    if (!project) throw notFound("That project");
    if (project.account_id) {
      if (!out.account_id) out.account_id = project.account_id;
      else if (out.account_id !== project.account_id) throw bad("That project belongs to a different company.");
    }
  }

  if (out.account_id) {
    const account = await t.one("select 1 from accounts where id = $1 and owner_id = $2 and archived_at is null", [
      out.account_id,
      owner,
    ]);
    if (!account) throw notFound("That company");
  }

  if (out.contact_id) {
    const contact = await t.one<{ name: string; account_id: string | null }>(
      "select name, account_id from contacts where id = $1 and owner_id = $2 and archived_at is null",
      [out.contact_id, owner],
    );
    if (!contact) throw notFound("That contact");
    if (out.account_id && contact.account_id && contact.account_id !== out.account_id) {
      throw bad(`${contact.name} works at a different company.`);
    }
  }

  return out;
}
