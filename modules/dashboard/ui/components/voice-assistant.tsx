"use client";

import * as React from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  AudioLinesIcon,
  CheckIcon,
  CircleCheckIcon,
  FileTextIcon,
  LoaderIcon,
  MicIcon,
  MicOffIcon,
  PhoneIcon,
  PhoneOffIcon,
  SendIcon,
  SparklesIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type VoiceStatus = "idle" | "connecting" | "active" | "ended" | "error";
type ArticleStatus = "none" | "generating" | "ready" | "approved" | "sending" | "sent";

type TranscriptLine = {
  role: "user" | "assistant";
  text: string;
};

type ArticleDraft = {
  headline: string;
  subheadline?: string;
  body: string;
  quote?: string;
  quotePerson?: string;
};

const SYSTEM_PROMPT = `You are Pressfy's voice press strategist — a fast, articulate
collaborator for founders, comms leads, and agency teams.

Your job in this short conversation is to help the user shape a publication-ready
press story. Keep responses concise (2-3 sentences) and conversational.

In the first turn, ask which announcement they want to work on (launch, raise,
hire, partnership, milestone, or something else).

Then walk them through, in order:
- The headline angle a journalist would actually open
- The 2-3 strongest proof points (numbers, customers, named partners)
- Who the quoted spokesperson is and the one quote that lands
- The audiences and beats they want this to reach

Be opinionated. Push back gently when the angle is weak, recommend stronger
hooks, and surface obvious follow-ups.

JOURNALIST DISTRIBUTION DATABASE:
You have access to a curated list of journalists across two industry verticals:
- Health — journalists and editors covering healthcare, wellness, biotech, and medical innovation
- Consumer Product — journalists covering consumer goods, retail, DTC brands, and product launches

When discussing target audiences, reference these two groups by name and help the user
decide which industries are the best fit for their announcement. Both groups can be targeted
simultaneously if the story has cross-industry appeal.

Once you have gathered enough information (headline angle, proof points, quote,
and target audience), tell the user: "Give me just a moment — I'm drafting your
press release now." Then immediately call the createArticle function with a
full, polished press release draft. After the tool call, say: "Your press release
is ready! Take a look at the draft on screen. Once you're happy with it, go ahead
and approve it — I'll take care of sending it out to the relevant journalists."

IMPORTANT: Always tell the user to wait briefly and then call createArticle.
The user must approve the article before it is sent.`;

const FIRST_MESSAGE =
  "Hey, this is Pressfy. Tell me what you're announcing and I'll help you sharpen the angle in a few minutes.";

export function VoiceAssistant() {
  const { user } = useUser();
  const journalists = useQuery(api.journalists.list) ?? [];

  const [status, setStatus] = React.useState<VoiceStatus>("idle");
  const [isMuted, setIsMuted] = React.useState(false);
  const [volume, setVolume] = React.useState(0);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = React.useState(false);
  const [transcript, setTranscript] = React.useState<TranscriptLine[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [callDurationMs, setCallDurationMs] = React.useState(0);
  const [articleStatus, setArticleStatus] = React.useState<ArticleStatus>("none");
  const [articleDraft, setArticleDraft] = React.useState<ArticleDraft | null>(null);
  const [sendError, setSendError] = React.useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vapiRef = React.useRef<any>(null);
  const callStartRef = React.useRef<number | null>(null);
  const transcriptScrollRef = React.useRef<HTMLDivElement | null>(null);

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_API_KEY ?? "";
  const elevenLabsVoiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID ?? "";

  const firstName = user?.firstName ?? user?.fullName?.split(" ")[0] ?? "there";

  React.useEffect(() => {
    if (!publicKey) return;
    let cancelled = false;

    void import("@vapi-ai/web").then(({ default: Vapi }) => {
      if (cancelled) return;
      const v = new Vapi(publicKey);
      vapiRef.current = v;

      v.on("call-start", () => {
        callStartRef.current = Date.now();
        setStatus("active");
        setCallDurationMs(0);
      });

      v.on("call-end", () => {
        setStatus("ended");
        setIsAssistantSpeaking(false);
      });

      v.on("speech-start", () => setIsAssistantSpeaking(true));
      v.on("speech-end", () => setIsAssistantSpeaking(false));
      v.on("volume-level", (vol: number) => setVolume(vol));

      v.on("error", (err: unknown) => {
        const message = err instanceof Error ? err.message : "Call error";
        setError(message);
        setStatus("error");
        setIsAssistantSpeaking(false);
      });

      v.on("message", (msg: Record<string, unknown>) => {
        if (msg.type === "transcript" && msg.transcriptType === "final") {
          const role = msg.role === "user" ? "user" : "assistant";
          const text = String(msg.transcript ?? "").trim();
          if (!text) return;
          setTranscript((prev) => [...prev, { role, text }]);
        }

        if (msg.type === "tool-calls") {
          const toolCallList = msg.toolCallList as Array<{
            id: string;
            function: { name: string; arguments: string };
          }> | undefined;

          const toolCall = toolCallList?.[0];
          if (!toolCall) return;

          if (toolCall.function.name === "createArticle") {
            setArticleStatus("generating");
            try {
              const args = JSON.parse(toolCall.function.arguments) as ArticleDraft;
              setArticleDraft(args);
              setArticleStatus("ready");
            } catch {
              setArticleStatus("none");
            }

            v.send({
              type: "add-message",
              message: {
                role: "tool",
                tool_call_id: toolCall.id,
                content:
                  "Article draft has been created and is now displayed to the user for review and approval.",
              },
            });
          }
        }
      });
    });

    return () => {
      cancelled = true;
      vapiRef.current?.stop?.();
      vapiRef.current = null;
    };
  }, [publicKey]);

  React.useEffect(() => {
    if (status !== "active") return;
    const id = window.setInterval(() => {
      if (callStartRef.current) {
        setCallDurationMs(Date.now() - callStartRef.current);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [status]);

  React.useEffect(() => {
    const node = transcriptScrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [transcript.length]);

  const startCall = React.useCallback(async () => {
    const vapi = vapiRef.current;
    if (!vapi) return;

    setError(null);
    setTranscript([]);
    setIsMuted(false);
    setStatus("connecting");

    const greeting = firstName === "there"
      ? FIRST_MESSAGE
      : `Hey ${firstName}, this is Pressfy. Tell me what you're announcing and I'll help you sharpen the angle in a few minutes.`;

    try {
      await vapi.start({
        model: {
          provider: "openai",
          model: "gpt-4o",
          messages: [{ role: "system", content: SYSTEM_PROMPT }],
          tools: [
            {
              type: "function",
              function: {
                name: "createArticle",
                description:
                  "Generates a full press release draft based on the conversation and presents it to the user for approval. Call this once you have the headline angle, key proof points, spokesperson quote, and target audience.",
                parameters: {
                  type: "object",
                  properties: {
                    headline: {
                      type: "string",
                      description: "The press release headline",
                    },
                    subheadline: {
                      type: "string",
                      description: "An optional subheadline or deck",
                    },
                    body: {
                      type: "string",
                      description:
                        "The full press release body text (3-5 paragraphs, newline-separated)",
                    },
                    quote: {
                      type: "string",
                      description: "The spokesperson quote",
                    },
                    quotePerson: {
                      type: "string",
                      description:
                        "The person being quoted — full name and title",
                    },
                  },
                  required: ["headline", "body"],
                },
              },
            },
          ],
        },
        voice: elevenLabsVoiceId
          ? { provider: "11labs", voiceId: elevenLabsVoiceId }
          : undefined,
        firstMessage: greeting,
        maxDurationSeconds: 1200,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start call.");
      setStatus("error");
    }
  }, [elevenLabsVoiceId, firstName]);

  const endCall = React.useCallback(() => {
    vapiRef.current?.stop?.();
    setStatus("ended");
  }, []);

  const toggleMute = React.useCallback(() => {
    const vapi = vapiRef.current;
    if (!vapi) return;
    const next = !isMuted;
    vapi.setMuted(next);
    setIsMuted(next);
  }, [isMuted]);

  const reset = React.useCallback(() => {
    setStatus("idle");
    setTranscript([]);
    setError(null);
    setSendError(null);
    setCallDurationMs(0);
    setArticleStatus("none");
    setArticleDraft(null);
    callStartRef.current = null;
  }, []);

  const handleSend = React.useCallback(async () => {
    if (!articleDraft || !journalists.length) return;
    setSendError(null);
    setArticleStatus("sending");
    try {
      const res = await fetch("/api/send-press-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleDraft, journalists }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to send");
      }
      setArticleStatus("sent");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send press release");
      setArticleStatus("approved");
    }
  }, [articleDraft, journalists]);

  if (!publicKey) {
    return <MissingKeyNotice />;
  }

  const isConnecting = status === "connecting";
  const isActive = status === "active";
  const isEnded = status === "ended";
  const isError = status === "error";

  return (
    <Card className="overflow-hidden rounded-none border-2 border-black bg-[#F5F0E8] py-0 text-black shadow-none ring-0">
      <CardHeader className="flex flex-row items-start justify-between gap-4 rounded-none border-b-2 border-black bg-black p-5 text-white sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center bg-[#fd5200] text-white">
            <SparklesIcon className="size-5" />
          </span>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-sm font-bold uppercase tracking-[0.2em]">
              Pressfy voice strategist
            </CardTitle>
            <p className="max-w-xl text-sm leading-relaxed text-white/70">
              Brainstorm angles, sharpen quotes, and turn a rough idea into a
              release-ready story — out loud, in under five minutes.
            </p>
          </div>
        </div>
        <StatusPill
          status={status}
          isMuted={isMuted}
          callDurationMs={callDurationMs}
        />
      </CardHeader>

      <CardContent className="flex flex-col gap-6 p-5 sm:p-6">
        <div className="relative flex items-center justify-center py-4">
          <Orb
            isActive={isActive}
            isAssistantSpeaking={isAssistantSpeaking}
            isConnecting={isConnecting}
            isEnded={isEnded}
            isError={isError}
            volume={volume}
          />
        </div>

        <Controls
          status={status}
          isMuted={isMuted}
          onStart={startCall}
          onEnd={endCall}
          onMuteToggle={toggleMute}
          onReset={reset}
        />

        {error ? (
          <p className="text-center text-sm text-destructive">{error}</p>
        ) : null}

        <Transcript
          ref={transcriptScrollRef}
          transcript={transcript}
          firstName={firstName}
          isActive={isActive}
        />

        <ArticlePreview
          articleStatus={articleStatus}
          articleDraft={articleDraft}
          journalistCount={journalists.length}
          sendError={sendError}
          onApprove={() => setArticleStatus("approved")}
          onSend={handleSend}
        />
      </CardContent>
    </Card>
  );
}

function MissingKeyNotice() {
  return (
    <Card className="rounded-none border-2 border-black bg-[#F5F0E8] py-0 shadow-none ring-0">
      <CardHeader className="rounded-none border-b-2 border-black bg-black p-5 text-white">
        <CardTitle className="text-sm font-bold uppercase tracking-[0.2em]">
          Voice strategist not configured
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-5 text-sm text-black/70">
        <p>
          Set{" "}
          <code className="bg-black px-1.5 py-0.5 text-white">
            NEXT_PUBLIC_VAPI_PUBLIC_API_KEY
          </code>{" "}
          in your environment to enable voice conversations.
        </p>
        <p>
          Optionally set{" "}
          <code className="bg-black px-1.5 py-0.5 text-white">
            NEXT_PUBLIC_ELEVENLABS_VOICE_ID
          </code>{" "}
          to use a custom ElevenLabs voice.
        </p>
      </CardContent>
    </Card>
  );
}

function StatusPill({
  status,
  isMuted,
  callDurationMs,
}: {
  status: VoiceStatus;
  isMuted: boolean;
  callDurationMs: number;
}) {
  if (status === "idle") {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 rounded-none border-white/40 text-white"
      >
        <span className="size-1.5 bg-[#fd5200]" />
        Ready
      </Badge>
    );
  }

  if (status === "connecting") {
    return (
      <Badge className="gap-1.5 rounded-none bg-[#fd5200] text-white">
        <LoaderIcon className="size-3 animate-spin" />
        Connecting
      </Badge>
    );
  }

  if (status === "active") {
    return (
      <Badge className="gap-1.5 rounded-none bg-[#fd5200] text-white">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-white" />
        </span>
        {isMuted ? "Muted" : "Live"} · {formatDuration(callDurationMs)}
      </Badge>
    );
  }

  if (status === "ended") {
    return (
      <Badge className="gap-1.5 rounded-none bg-white text-black">
        <CircleCheckIcon className="size-3" />
        Call ended
      </Badge>
    );
  }

  return (
    <Badge className="gap-1.5 rounded-none bg-white text-black">
      Error
    </Badge>
  );
}

function Orb({
  isActive,
  isAssistantSpeaking,
  isConnecting,
  isEnded,
  isError,
  volume,
}: {
  isActive: boolean;
  isAssistantSpeaking: boolean;
  isConnecting: boolean;
  isEnded: boolean;
  isError: boolean;
  volume: number;
}) {
  const pulseScale = 1 + Math.min(volume, 1) * 0.18;

  return (
    <div className="relative flex size-44 items-center justify-center">
      {isActive ? (
        <>
          <span
            className="absolute size-44 rounded-full bg-[#fd5200]/20"
            style={{
              animation: "ping 2.2s cubic-bezier(0,0,0.2,1) infinite",
            }}
          />
          <span
            className="absolute size-32 rounded-full bg-[#fd5200]/25"
            style={{
              animation: "ping 2.2s cubic-bezier(0,0,0.2,1) infinite 0.4s",
            }}
          />
        </>
      ) : null}

      <div
        className={cn(
          "relative flex size-28 items-center justify-center rounded-full border-2 transition-all duration-500",
          isActive
            ? "border-black bg-[#fd5200] text-white"
            : isEnded
              ? "border-black bg-white text-black"
              : isError
                ? "border-black bg-white text-black"
                : isConnecting
                  ? "border-black bg-[#fd5200]/15 text-black"
                  : "border-black bg-black text-white",
        )}
        style={
          isActive && isAssistantSpeaking
            ? { transform: `scale(${pulseScale})` }
            : undefined
        }
      >
        {isConnecting ? (
          <LoaderIcon className="size-10 animate-spin" />
        ) : isEnded ? (
          <CircleCheckIcon className="size-10" />
        ) : isActive ? (
          isAssistantSpeaking ? (
            <AudioLinesIcon className="size-10 animate-pulse" />
          ) : (
            <MicIcon className="size-10" />
          )
        ) : (
          <SparklesIcon className="size-10" />
        )}
      </div>
    </div>
  );
}

function Controls({
  status,
  isMuted,
  onStart,
  onEnd,
  onMuteToggle,
  onReset,
}: {
  status: VoiceStatus;
  isMuted: boolean;
  onStart: () => void;
  onEnd: () => void;
  onMuteToggle: () => void;
  onReset: () => void;
}) {
  if (status === "idle" || status === "error") {
    return (
      <div className="flex flex-col items-center gap-3">
        <Button
          size="lg"
          onClick={onStart}
          className="gap-2 rounded-none bg-black px-6 font-bold uppercase tracking-[0.16em] text-white hover:bg-black/80"
        >
          <PhoneIcon className="size-4" />
          Start voice session
        </Button>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-black/60">
          We&apos;ll ask for microphone access. Stop anytime.
        </p>
      </div>
    );
  }

  if (status === "connecting") {
    return (
      <div className="flex justify-center">
        <Button
          size="lg"
          disabled
          className="gap-2 rounded-none bg-black px-6 font-bold uppercase tracking-[0.16em] text-white"
        >
          <LoaderIcon className="size-4 animate-spin" />
          Connecting…
        </Button>
      </div>
    );
  }

  if (status === "active") {
    return (
      <div className="flex items-center justify-center gap-3">
        <Button
          variant={isMuted ? "destructive" : "outline"}
          size="icon-lg"
          onClick={onMuteToggle}
          className="rounded-none border-2 border-black bg-white text-black hover:bg-[#fd5200] hover:text-white"
          aria-label={isMuted ? "Unmute" : "Mute"}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <MicOffIcon className="size-5" />
          ) : (
            <MicIcon className="size-5" />
          )}
        </Button>
        <Button
          variant="destructive"
          size="lg"
          onClick={onEnd}
          className="gap-2 rounded-none bg-black px-6 font-bold uppercase tracking-[0.16em] text-white hover:bg-black/80"
        >
          <PhoneOffIcon className="size-4" />
          End session
        </Button>
      </div>
    );
  }

  return (
    <div className="flex justify-center gap-3">
      <Button
        variant="outline"
        onClick={onReset}
        className="rounded-none border-2 border-black bg-white font-bold uppercase tracking-[0.16em] text-black hover:bg-[#fd5200] hover:text-white"
      >
        Clear and reset
      </Button>
      <Button
        onClick={onStart}
        className="gap-2 rounded-none bg-black font-bold uppercase tracking-[0.16em] text-white hover:bg-black/80"
      >
        <PhoneIcon className="size-4" />
        Start a new session
      </Button>
    </div>
  );
}

const Transcript = React.forwardRef<
  HTMLDivElement,
  {
    transcript: TranscriptLine[];
    firstName: string;
    isActive: boolean;
  }
>(function Transcript({ transcript, firstName, isActive }, ref) {
  if (transcript.length === 0) {
    return (
      <div className="border-2 border-dashed border-black bg-white/50 p-6 text-center text-sm font-medium uppercase tracking-[0.14em] text-black/60">
        {isActive
          ? "Listening… your conversation will appear here in real time."
          : "Start a session and the live transcript will show up here."}
      </div>
    );
  }

  return (
    <div className="overflow-hidden border-2 border-black bg-white/50">
      <div className="flex items-center justify-between border-b-2 border-black bg-black px-4 py-2.5 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white">
          Live transcript
        </p>
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">
          {transcript.length} {transcript.length === 1 ? "line" : "lines"}
        </span>
      </div>
      <div
        ref={ref}
        className="flex h-64 flex-col gap-3 overflow-y-auto p-4"
      >
        {transcript.map((line, i) => (
          <div
            key={i}
            className={cn(
              "flex max-w-[85%] flex-col gap-1 border-2 border-black px-4 py-3 text-sm leading-relaxed",
              line.role === "user"
                ? "self-end bg-[#fd5200] text-white"
                : "self-start bg-white text-black",
            )}
          >
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider",
                line.role === "user"
                  ? "text-white/70"
                  : "text-black/50",
              )}
            >
              {line.role === "user" ? firstName : "Pressfy"}
            </span>
            <p className="whitespace-pre-wrap">{line.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
});

function ArticlePreview({
  articleStatus,
  articleDraft,
  journalistCount,
  sendError,
  onApprove,
  onSend,
}: {
  articleStatus: ArticleStatus;
  articleDraft: ArticleDraft | null;
  journalistCount: number;
  sendError: string | null;
  onApprove: () => void;
  onSend: () => void;
}) {
  if (articleStatus === "none") return null;

  if (articleStatus === "generating") {
    return (
      <div className="flex items-center gap-3 border-2 border-dashed border-black bg-white/50 p-5 text-sm font-medium uppercase tracking-[0.14em] text-black/60">
        <LoaderIcon className="size-4 shrink-0 animate-spin text-[#fd5200]" />
        <span>Drafting your press release — just a moment…</span>
      </div>
    );
  }

  if (articleStatus === "sent") {
    return (
      <div className="flex items-center gap-3 border-2 border-black bg-[#fd5200] p-5 text-sm font-bold uppercase tracking-[0.14em] text-white">
        <CircleCheckIcon className="size-4 shrink-0" />
        <span>Your press release has been sent to {journalistCount} journalist{journalistCount !== 1 ? "s" : ""}!</span>
      </div>
    );
  }

  if (!articleDraft) return null;

  const { headline, subheadline, body, quote, quotePerson } = articleDraft;
  const isApproved = articleStatus === "approved" || articleStatus === "sending";
  const isSending = articleStatus === "sending";

  return (
    <div className="overflow-hidden border-2 border-black bg-white/60">
      <div className="flex items-center justify-between border-b-2 border-black bg-black px-5 py-3 text-white">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em]">
          <FileTextIcon className="size-4 text-[#fd5200]" />
          Press release draft
        </div>
        {isApproved ? (
          <Badge
            variant="outline"
            className="gap-1.5 rounded-none border-white/40 text-white"
          >
            <CheckIcon className="size-3" />
            Approved
          </Badge>
        ) : (
          <Badge variant="outline" className="rounded-none border-white/40 text-white/70">
            Awaiting approval
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-bold uppercase leading-tight tracking-tight">
            {headline}
          </h3>
          {subheadline ? (
            <p className="text-sm leading-relaxed text-black/60">{subheadline}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 text-sm leading-relaxed text-black/80">
          {body.split("\n").filter(Boolean).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        {quote ? (
          <blockquote className="border-l-4 border-[#fd5200] pl-4 text-sm italic text-black/70">
            <p>&ldquo;{quote}&rdquo;</p>
            {quotePerson ? (
              <footer className="mt-1 text-xs font-bold uppercase tracking-[0.14em] not-italic text-black">
                — {quotePerson}
              </footer>
            ) : null}
          </blockquote>
        ) : null}

        {sendError ? (
          <p className="text-xs font-medium text-destructive">{sendError}</p>
        ) : null}

        <div className="flex items-center gap-3 pt-1">
          {!isApproved ? (
            <Button
              onClick={onApprove}
              className="gap-2 rounded-none bg-black font-bold uppercase tracking-[0.16em] text-white hover:bg-black/80"
            >
              <CheckIcon className="size-4" />
              Approve article
            </Button>
          ) : (
            <Button
              onClick={onSend}
              disabled={isSending}
              className="gap-2 rounded-none bg-[#fd5200] font-bold uppercase tracking-[0.16em] text-white hover:bg-[#e04a00] disabled:opacity-60"
            >
              {isSending ? (
                <LoaderIcon className="size-4 animate-spin" />
              ) : (
                <SendIcon className="size-4" />
              )}
              {isSending ? "Sending…" : `Send to ${journalistCount} journalist${journalistCount !== 1 ? "s" : ""}`}
            </Button>
          )}
          {!isApproved ? (
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-black/50">
              Review the draft above and approve it to send.
            </p>
          ) : !isSending ? (
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-black/50">
              Press release approved. Click Send when ready.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}
