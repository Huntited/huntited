// Cloche de l'en-tête : activité de tes chasses (nouveaux messages, chasse
// déclenchée ou non), tenue par ActivityWatcher (src/lib/inbox.ts).
import { Link } from "@tanstack/react-router";
import { Bell, CircleCheck, CircleX, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { inboxItems, markRead, onInboxChange, type InboxItem, type InboxKind } from "@/lib/inbox";

const TEXT: Record<InboxKind, MessageKey> = {
  message: "inbox.message",
  activated: "inbox.activated",
  failed: "inbox.failed",
};
const ICON: Record<InboxKind, typeof Bell> = {
  message: MessageSquare,
  activated: CircleCheck,
  failed: CircleX,
};

export function NotificationBell() {
  const { t, relative } = useI18n();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const read = () => setItems(inboxItems());
    read();
    window.addEventListener("storage", read);
    const stop = onInboxChange(read);
    return () => {
      window.removeEventListener("storage", read);
      stop();
    };
  }, []);

  const unread = items.filter((i) => !i.read).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread ? t("inbox.openUnread", { n: unread }) : t("inbox.open")}
        >
          <Bell aria-hidden />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h2 className="text-sm font-semibold">{t("inbox.title")}</h2>
          {unread > 0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => markRead()}
            >
              {t("inbox.markRead")}
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("inbox.empty")}</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {items.map((i) => {
              const Icon = ICON[i.kind];
              return (
                <li key={i.id}>
                  <Link
                    to="/hunt/$id"
                    params={{ id: i.huntId }}
                    onClick={() => {
                      markRead({ huntId: i.huntId });
                      setOpen(false);
                    }}
                    className={`flex gap-2.5 px-3 py-2.5 text-sm hover:bg-muted ${i.read ? "text-muted-foreground" : ""}`}
                  >
                    <Icon
                      aria-hidden
                      className={`mt-0.5 size-4 shrink-0 ${i.kind === "failed" ? "text-muted-foreground" : "text-primary"}`}
                    />
                    <span className="flex-1">
                      <span className={i.read ? "" : "font-medium"}>
                        {t(TEXT[i.kind], { title: i.title })}
                      </span>
                      <span className="block text-xs text-muted-foreground">{relative(i.at)}</span>
                    </span>
                    {!i.read && (
                      <span
                        aria-hidden
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
