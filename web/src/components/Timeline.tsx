import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { channelLabel, outcomeLabel, type ActivityRow } from "@shared/model";
import { api } from "@/lib/api";
import { dmy, dmyTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Newest-first list of logged communication. */
export function Timeline({
  items,
  showAccount = false,
  showProject = false,
  empty = "Nothing logged yet.",
}: {
  items: ActivityRow[];
  /** Show which company each entry is about. */
  showAccount?: boolean;
  /** Show which project each entry is about. */
  showProject?: boolean;
  empty?: string;
}) {
  if (!items.length) return <p className="py-6 text-sm text-muted">{empty}</p>;

  async function remove(a: ActivityRow) {
    if (!confirm("Delete this entry?")) return;
    await api(`/activities/${a.id}`, "DELETE");
  }

  let lastDay = "";
  return (
    <ol>
      {items.map((a) => {
        const day = dmy(a.occurred_at);
        const showDay = day !== lastDay;
        lastDay = day;
        const meta = [
          a.direction === "inbound" && a.channel !== "note" ? "Inbound" : null,
          outcomeLabel(a.channel, a.outcome) || null,
          a.contact_name,
        ].filter(Boolean);
        return (
          <li key={a.id} className={cn("group grid grid-cols-[5.5rem_1fr_auto] gap-x-4 border-t border-line py-4", !showDay && "border-t-transparent pt-0")}>
            <time className="pt-px text-[13px] text-faint" dateTime={a.occurred_at} title={dmyTime(a.occurred_at)}>
              {showDay ? day : ""}
            </time>
            <div className="min-w-0">
              <p className="text-sm">
                <span className="font-medium">{channelLabel(a.channel)}</span>
                {meta.length > 0 && <span className="text-muted"> · {meta.join(" · ")}</span>}
                {showProject && a.project_id && (
                  <>
                    <span className="text-muted"> · </span>
                    <Link to={`/projects/${a.project_id}`} className="text-muted hover:text-accent">
                      {a.project_name}
                    </Link>
                  </>
                )}
                {showAccount && a.account_id && !(showProject && a.project_id) && (
                  <>
                    <span className="text-muted"> · </span>
                    <Link to={`/accounts/${a.account_id}`} className="text-muted hover:text-accent">
                      {a.account_name}
                    </Link>
                  </>
                )}
              </p>
              {a.summary && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">{a.summary}</p>}
            </div>
            <button
              onClick={() => remove(a)}
              className="self-start rounded p-1 text-faint opacity-0 transition-opacity hover:text-late focus:opacity-100 group-hover:opacity-100"
              aria-label="Delete entry"
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
