"use client";

import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import { logout } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import { useDataSaver } from "@/components/kick/data-saver";

export interface ShellUser {
  name: string | null;
  email: string | null;
  isAdmin: boolean;
}

function initial(user: ShellUser) {
  return (user.name ?? user.email ?? "?").trim().charAt(0).toUpperCase() || "?";
}

const itemClass =
  "flex min-h-11 w-full cursor-default items-center rounded-xl px-3 text-[15px] font-bold text-ink outline-none select-none data-highlighted:bg-blue-tint data-highlighted:text-kick-blue";

/** Avatar button and account menu (§7.1): Profile, Eligibility report, Data saver, Admin, Sign out. */
export function AvatarMenu({ user, tone }: { user: ShellUser; tone: "night" | "light" }) {
  const { on, setOn } = useDataSaver();

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Account menu"
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-kick-blue font-display text-lg font-bold text-white",
          tone === "night" && "ring-2 ring-white/35",
        )}
      >
        {initial(user)}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <Menu.Popup className="w-72 origin-(--transform-origin) rounded-2xl bg-white p-2 shadow-raised outline-none data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0">
            <div className="px-3 pt-2 pb-3">
              {user.name && <p className="truncate text-[15px] font-bold text-ink">{user.name}</p>}
              {user.email && <p className="truncate text-sm text-ink-3">{user.email}</p>}
            </div>
            <Menu.Separator className="mx-1 my-1 h-px bg-line" />
            <Menu.Item className={itemClass} render={<Link href="/profile" />}>
              Profile
            </Menu.Item>
            <Menu.Item className={itemClass} render={<Link href="/eligibility" />}>
              Eligibility report
            </Menu.Item>
            <Menu.CheckboxItem
              checked={on}
              onCheckedChange={(checked) => setOn(checked)}
              closeOnClick={false}
              className={cn(itemClass, "justify-between gap-4")}
            >
              <span>
                <span className="block">Data saver</span>
                <span className="block text-[13px] font-normal text-ink-3">Hide pictures to use less data</span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors",
                  on ? "bg-kick-blue" : "bg-line-strong",
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform",
                    on && "translate-x-5",
                  )}
                />
              </span>
            </Menu.CheckboxItem>
            {user.isAdmin && (
              <Menu.Item className={itemClass} render={<Link href="/admin" />}>
                Admin
              </Menu.Item>
            )}
            <Menu.Separator className="mx-1 my-1 h-px bg-line" />
            <form action={logout}>
              <Menu.Item className={itemClass} render={<button type="submit" />} nativeButton>
                Sign out
              </Menu.Item>
            </form>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
