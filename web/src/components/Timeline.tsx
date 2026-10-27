import { Link } from "react-router-dom";
import { Eye, Link2, Mail, MessageCircle, MessageSquare, Phone, StickyNote, Trash2, Users } from "lucide-react";
import { channelLabel, outcomeLabel, type ActivityRow, type Channel } from "@shared/model";
import { api } from "@/lib/api";
import { daysBetween, dmy, dmyTime, relative, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

// Filled circles in system colours, like the app icons they stand for.
const CHANNEL_TONE: Partial<Record<Channel, string>> = {
  call: "bg-green text-white",
  email: "bg-accent text-white",
  linkedin: "bg-indigo text-white",
  meeting: "bg-orange text-white",
  viewing: "bg-purple text-white",
  whatsapp: "bg-teal text-white",
  note: "bg-yellow text-[#5c4300]",
};

const CHANNEL_ICON: Partial<Record<Channel, typeof Phone>> = {
  call: Phone,
  email: Mail,
  linkedin: Link2,
  meeting: Users,
  viewing: Eye,
  whatsapp: MessageCircle,
  note: StickyNote,
};

/** "today", "3 days ago", or the date once it's more than a week back. */
function when(ts: string) {
  const day = todayISO(new Date(ts));
  return Math.abs(daysBetween(day, todayISO())) < 7 ? relative(day) : dmy(day);
}

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
  if (!items.length) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;

  async function remove(a: ActivityRow) {
    if (!confirm("Delete this entry?")) return;
    await api(`/activities/${a.id}`, "DELETE");
  }

  return (
    <ol className="relative">
      {items.map((a, i) => {
        const Icon = CHANNEL_ICON[a.channel] ?? MessageSquare;
        const meta = [
          a.direction === "inbound" && a.channel !== "note" ? "Inbound" : null,
          outcomeLabel(a.channel, a.outcome) || null,
          a.contact_name,
        ].filter(Boolean);
        return (
          <li key={a.id} className="group relative grid grid-cols-[28px_1fr_auto] gap-x-3 py-3">
            {i < items.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[13.5px] top-11 w-px bg-line" />}
            <span
              className={cn("relative mt-0.5 grid size-7 place-items-center rounded-full", CHANNEL_TONE[a.channel] ?? "bg-gray text-white")}
              title={channelLabel(a.channel)}
            >
              <Icon className="size-3.5" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-semibold">{channelLabel(a.channel)}</span>
                <time className="text-[12.5px] text-faint" dateTime={a.occurred_at} title={dmyTime(a.occurred_at)}>
                  {when(a.occurred_at)}
                </time>
              </p>
              {(meta.length > 0 || (showProject && a.project_id) || (showAccount && a.account_id)) && (
                <p className="mt-0.5 text-[13px] text-muted">
                  {meta.join(" · ")}
                  {showProject && a.project_id && (
                    <>
                      {meta.length > 0 && " · "}
                      <Link to={`/projects/${a.project_id}`} className="text-accent hover:underline">
                        {a.project_name}
                      </Link>
                    </>
                  )}
                  {showAccount && a.account_id && !(showProject && a.project_id) && (
                    <>
                      {meta.length > 0 && " · "}
                      <Link to={`/accounts/${a.account_id}`} className="text-accent hover:underline">
                        {a.account_name}
                      </Link>
                    </>
                  )}
                </p>
              )}
              {a.summary && <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg/85">{a.summary}</p>}
            </div>
            <button
              onClick={() => remove(a)}
              className="self-start rounded-md p-1 text-faint opacity-0 transition-opacity hover:bg-hover hover:text-late focus:opacity-100 group-hover:opacity-100"
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
