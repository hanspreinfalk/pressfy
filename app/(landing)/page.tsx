"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import FlowArt, { FlowSection } from "@/components/ui/story-scroll";

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/dashboard");
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-sm font-bold uppercase tracking-[0.2em]">
          Loading...
        </p>
      </main>
    );
  }

  const showAuthButtons = isLoaded && !isSignedIn;

  return (
    <FlowArt aria-label="Pressfy story">
      <FlowSection
        aria-label="Who we are"
        style={{ backgroundColor: "#fd5200", color: "#fff" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.2em]">
            01 — Who we are
          </p>
          {showAuthButtons && (
            <div className="flex items-center gap-3">
              <Link
                href="/sign-in"
                className="text-xs font-bold uppercase tracking-[0.2em] border border-black/30 px-4 py-2 hover:bg-black/10 transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/sign-up"
                className="text-xs font-bold uppercase tracking-[0.2em] bg-black text-white px-4 py-2 hover:bg-black/80 transition-colors"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
        <hr className="my-[2vw] border-none border-t border-black opacity-100" />
        <div>
          <h1 className="text-[clamp(3.5rem,12vw,14rem)] font-bold leading-[0.85] uppercase tracking-tight">
            Press
            <br />
            That
            <br />
            Lands
          </h1>
        </div>
        <hr className="my-[2vw] border-none border-t border-black opacity-100" />
        <p className="mt-auto max-w-[50ch] text-[clamp(1rem,2.5vw,2rem)] font-normal leading-relaxed">
          Pressfy is the modern newsroom for founders and brands. Write once,
          distribute everywhere, and turn every announcement into momentum.
        </p>
      </FlowSection>

      <FlowSection
        aria-label="The mission"
        style={{ backgroundColor: "#000", color: "#fff" }}
      >
        <p className="text-xs font-bold uppercase tracking-[0.2em]">
          02 — The mission
        </p>
        <hr className="my-[2vw] border-none border-t border-white/60" />
        <div>
          <h2 className="text-[clamp(3.5rem,12vw,14rem)] font-bold leading-[0.85] uppercase tracking-tight">
            Stories
            <br />
            That
            <br />
            Travel
          </h2>
        </div>
        <hr className="my-[2vw] border-none border-t border-white/60" />
        <p className="max-w-[50ch] text-[clamp(1rem,2.5vw,2rem)] font-normal leading-relaxed">
          We&apos;re replacing the wire-service tax and the PR agency markup
          with software. One workspace from draft to coverage — built for the
          teams shipping the news, not the ones gatekeeping it.
        </p>
        <hr className="my-[2vw] border-none border-t border-white/60" />
        <div className="flex flex-wrap gap-[3vw]">
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider">
              Drafting
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed opacity-75">
              AI-assisted release writing trained on the headlines reporters
              actually open.
            </p>
          </div>
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider">
              Distribution
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed opacity-75">
              Syndicate to wires, niche outlets, and your own newsroom in a
              single click.
            </p>
          </div>
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider">
              Pricing
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed opacity-75">
              Flat-rate plans. No per-word fees. No mystery agency retainers.
            </p>
          </div>
        </div>
        <hr className="my-[2vw] border-none border-t border-white/60" />
        <div className="flex flex-wrap gap-[3vw]">
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider">
              Newsrooms
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed opacity-75">
              Hosted, branded press pages with a real RSS feed and a real
              schema.
            </p>
          </div>
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider">
              Outreach
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed opacity-75">
              Pitch the right journalist, on the right beat, at the right hour.
            </p>
          </div>
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider">
              Analytics
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed opacity-75">
              Coverage tracking, sentiment, and pickups — all in one
              dashboard.
            </p>
          </div>
        </div>
        <hr className="my-[2vw] border-none border-t border-white/60" />
        <p className="mt-auto ml-auto max-w-[50ch] text-right text-[clamp(1rem,2.5vw,2rem)] font-normal leading-relaxed">
          Every feature we ship answers one question — does it get the story
          read?
        </p>
      </FlowSection>

      <FlowSection
        aria-label="How it works"
        style={{ backgroundColor: "#F5F0E8", color: "#000" }}
      >
        <p className="text-xs font-bold uppercase tracking-[0.2em]">
          03 — How it works
        </p>
        <hr className="my-[2vw] border-none border-t border-black/60" />
        <div>
          <h2 className="text-[clamp(3.5rem,12vw,14rem)] font-bold leading-[0.85] uppercase tracking-tight">
            Draft.
            <br />
            Send.
            <br />
            Land.
          </h2>
        </div>
        <hr className="my-[2vw] border-none border-t border-black/60" />
        <p className="max-w-[50ch] text-[clamp(1rem,2.5vw,2rem)] font-normal leading-relaxed">
          Three steps from blank page to bylines. No wire codes, no gatekeepers,
          no waiting on Monday morning send windows.
        </p>
        <hr className="my-[2vw] border-none border-t border-black/60" />
        <div className="flex flex-wrap gap-[3vw]">
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider">
              01 — Draft
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed opacity-75">
              Start from a brief. Pressfy turns bullet points into a
              publication-ready release in under a minute.
            </p>
          </div>
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider">
              02 — Target
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed opacity-75">
              Pick beats, regions, and outlets. We surface the journalists
              actively covering your space this week.
            </p>
          </div>
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider">
              03 — Send
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed opacity-75">
              Distribute to wires, your newsroom, and inboxes — embargoes,
              attachments, and tracking included.
            </p>
          </div>
        </div>
        <hr className="my-[2vw] border-none border-t border-black/60" />
        <div className="flex flex-wrap gap-[3vw]">
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider">
              04 — Track
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed opacity-75">
              Watch opens, clicks, pickups, and quote attribution as they
              happen.
            </p>
          </div>
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider">
              05 — Follow up
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed opacity-75">
              One-click reply templates, scheduled bumps, and CRM-style notes
              on every contact.
            </p>
          </div>
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider">
              06 — Report
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed opacity-75">
              Beautiful coverage reports your CMO and your investors will
              actually read.
            </p>
          </div>
        </div>
      </FlowSection>

      <FlowSection
        aria-label="The vision"
        style={{ backgroundColor: "#1A3DE8", color: "#fff" }}
      >
        <p className="text-xs font-bold uppercase tracking-[0.2em]">
          04 — The vision
        </p>
        <hr className="my-[2vw] border-none border-t border-white/50" />
        <div>
          <h2 className="text-[clamp(3.5rem,12vw,14rem)] font-bold leading-[0.85] uppercase tracking-tight">
            Future
            <br />
            Of
            <br />
            PR
          </h2>
        </div>
        <hr className="my-[2vw] border-none border-t border-white/50" />
        <p className="max-w-[50ch] text-[clamp(1rem,2.5vw,2rem)] font-normal leading-relaxed">
          The wire was built for fax machines. Pressfy is built for the way
          news actually moves now — fast, measurable, and accountable.
        </p>
        <hr className="my-[2vw] border-none border-t border-white/50" />
        <div className="flex flex-wrap gap-[3vw]">
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider">
              5K+
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed opacity-75">
              Founders, comms teams, and agencies running their newsroom on
              Pressfy.
            </p>
          </div>
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider">
              45K+
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed opacity-75">
              Verified journalist contacts, refreshed weekly. No stale media
              lists.
            </p>
          </div>
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider">
              90%
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed opacity-75">
              Less time spent formatting, chasing, and reporting on each
              release.
            </p>
          </div>
        </div>
        <hr className="my-[2vw] border-none border-t border-white/50" />
        <p className="max-w-[50ch] text-[clamp(1rem,2.5vw,2rem)] font-normal leading-relaxed">
          Communications has been stuck in 2008 for too long. Pressfy is the
          push the industry has been waiting for.
        </p>
        <hr className="my-[2vw] border-none border-t border-white/50" />
        <div className="flex flex-wrap gap-[3vw]">
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider">
              Open access
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed opacity-75">
              No invite codes. No annual contracts. Sign up and ship a release
              today.
            </p>
          </div>
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider">
              Global reach
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed opacity-75">
              Distribute in 40+ markets and 12 languages from one workspace.
            </p>
          </div>
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider">
              Honest pricing
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed opacity-75">
              One flat plan. Unlimited releases. No surprise per-word
              surcharges.
            </p>
          </div>
        </div>
      </FlowSection>

      <FlowSection
        aria-label="Join us"
        style={{ backgroundColor: "#000", color: "#fff" }}
      >
        <p className="text-xs font-bold uppercase tracking-[0.2em]">
          05 — Join us
        </p>
        <hr className="my-[2vw] border-none border-t border-white/40" />
        <div>
          <h2 className="text-[clamp(3.5rem,12vw,14rem)] font-bold leading-[0.85] uppercase tracking-tight">
            Ready
            <br />
            To
            <br />
            Ship?
          </h2>
        </div>
        <hr className="my-[2vw] border-none border-t border-white/40" />
        <p className="mt-auto max-w-[50ch] text-[clamp(1rem,2.5vw,2rem)] font-normal leading-relaxed">
          Take your story off the wire and onto the front page. Start your
          first Pressfy release in under five minutes — free.
        </p>
        <div className="mt-[3vw] flex flex-wrap gap-4">
          {showAuthButtons && (
            <>
              <Link
                href="/sign-up"
                className="text-sm font-bold uppercase tracking-[0.2em] bg-[#fd5200] text-white px-8 py-4 hover:bg-[#e04a00] transition-colors"
              >
                Get started free
              </Link>
              <Link
                href="/sign-in"
                className="text-sm font-bold uppercase tracking-[0.2em] border border-white/40 px-8 py-4 hover:bg-white/10 transition-colors"
              >
                Log in
              </Link>
            </>
          )}
        </div>
      </FlowSection>
    </FlowArt>
  );
}
