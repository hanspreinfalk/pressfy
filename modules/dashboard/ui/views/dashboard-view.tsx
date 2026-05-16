import { VoiceAssistant } from "@/modules/dashboard/ui/components/voice-assistant";

const workflow = [
  {
    label: "01 — Draft",
    copy: "Talk through the announcement and turn loose notes into a usable release angle.",
  },
  {
    label: "02 — Approve",
    copy: "Review the generated draft, tighten the story, and approve it before anything goes out.",
  },
  {
    label: "03 — Send",
    copy: "Move from voice session to distribution-ready copy without losing momentum.",
  },
];

export function DashboardView() {
  return (
    <div className="min-h-screen bg-[#F5F0E8] text-black">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="border-2 border-black bg-[#fd5200] p-5 text-white sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em]">
              01 — Workspace
            </p>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
              Voice-led press room
            </p>
          </div>
          <hr className="my-6 border-none border-t-2 border-black" />
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div>
              <h1 className="text-[clamp(3.5rem,10vw,9rem)] font-bold uppercase leading-[0.85] tracking-tight">
                Talk.
                <br />
                Draft.
                <br />
                Land.
              </h1>
            </div>
            <div className="border-2 border-black bg-black p-5 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#fd5200]">
                Today&apos;s brief
              </p>
              <p className="mt-4 text-2xl font-bold leading-tight">
                Start with your voice. Leave with a release-ready story.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-white/70">
                Pressfy keeps the dashboard as direct as the landing page:
                bold prompts, visible progress, and no extra chrome between you
                and the story.
              </p>
            </div>
          </div>
          <hr className="my-6 border-none border-t-2 border-black" />
          <div className="grid gap-5 md:grid-cols-3">
            {workflow.map((item) => (
              <div key={item.label} className="border-t-2 border-black pt-4">
                <p className="text-sm font-bold uppercase tracking-wider">
                  {item.label}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-white/80">
                  {item.copy}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <VoiceAssistant />

          <aside className="flex flex-col border-2 border-black bg-black p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#fd5200]">
              02 — Momentum
            </p>
            <hr className="my-5 border-none border-t border-white/40" />
            <p className="text-[clamp(2.5rem,5vw,4.5rem)] font-bold uppercase leading-[0.85] tracking-tight">
              Five
              <br />
              Minute
              <br />
              Draft
            </p>
            <hr className="my-5 border-none border-t border-white/40" />
            <p className="mt-auto text-sm leading-relaxed text-white/70">
              The assistant captures the angle, proof points, quote, and target
              audience before generating the article for approval.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
