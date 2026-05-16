import { UserButton } from "@clerk/nextjs";
import { ZapIcon } from "lucide-react";

import { VoiceAssistant } from "@/modules/dashboard/ui/components/voice-assistant";

export function DashboardView() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-background/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ZapIcon className="size-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            Pressfy
          </span>
        </div>
        <UserButton />
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Workspace
          </span>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Talk it through, ship the story.
          </h1>
          <p className="max-w-xl text-base text-muted-foreground">
            Skip the blank page. Start a voice session and Pressfy will help
            you sharpen your angle, tighten the quote, and line up the
            distribution beats — all in real time.
          </p>
        </div>

        <VoiceAssistant />
      </main>
    </div>
  );
}
