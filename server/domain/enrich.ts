// Runs the AI company lookup for an account in the background and stores the result.
import { db } from "../db.js";
import { researchCompany } from "./research.js";

export { aiEnabled, PENDING_TIMEOUT_MS } from "./research.js";

/**
 * Marks the account as being looked up and runs the lookup in the background.
 * The account page polls until it's done. Fills in the industry if you left it empty.
 */
export async function startLookup(owner: string, accountId: string): Promise<void> {
  const acc = await db.one<{ name: string; website: string; domain: string | null }>(
    `update accounts set ai_status = 'pending', ai_error = '', ai_updated_at = now()
     where id = $1 and owner_id = $2 and archived_at is null returning name, website, domain`,
    [accountId, owner],
  );
  if (!acc) return;
  const site = acc.website || acc.domain || "";
  void (async () => {
    try {
      const profile = await researchCompany(site, acc.name);
      await db.q(
        `update accounts set ai_profile = $3, ai_status = 'done', ai_error = '', ai_updated_at = now(),
                industry = case when industry = '' and $4::text is not null then $4 else industry end
         where id = $1 and owner_id = $2`,
        [accountId, owner, JSON.stringify(profile), profile.industry],
      );
    } catch (e) {
      console.error("Company lookup failed:", (e as Error).message);
      await db
        .q("update accounts set ai_status = 'failed', ai_error = $3, ai_updated_at = now() where id = $1 and owner_id = $2", [
          accountId,
          owner,
          (e as Error).message.slice(0, 300),
        ])
        .catch(() => {});
    }
  })();
}
