"use client";

import * as React from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
  RotateCcwIcon,
  SendIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type VoiceStatus = "idle" | "connecting" | "active" | "ended" | "error";
type ArticleStatus =
  | "none"
  | "generating"
  | "ready"
  | "approved"
  | "sending"
  | "sent"
  | "rejected";

type Industry = "Health" | "Consumer Product";

type TranscriptLine = {
  role: "user" | "assistant";
  text: string;
};

const SYSTEM_PROMPT = `You are Pressfy's voice press strategist — a fast, articulate
collaborator for founders, comms leads, and agency teams.

Your job is to help the user shape a publication-ready press story. Keep spoken
responses concise (2-3 sentences) and conversational.

==========================
THE createArticle TOOL
==========================
You have one tool: createArticle. It takes exactly three required arguments:

1. headline (string, non-empty, 10+ characters)
   The press release headline.

2. markdown (string, non-empty, 400+ characters)
   The COMPLETE press release body written in Markdown. Must contain:
   - a "# " H1 line that matches the headline
   - 3-5 body paragraphs separated by blank lines
   - at least one "> " blockquote line containing the spokesperson quote

3. industries (array of strings)
   Choose any subset of ["Health", "Consumer Product"] — every industry
   that genuinely fits the story. Use [] only if neither fits.
   - "Health" = healthcare, wellness, biotech, medical innovation
   - "Consumer Product" = consumer goods, retail, DTC brands, product launches

ABSOLUTE RULES for calling createArticle:
- Before invoking the tool, you MUST have fully written headline, markdown,
  and industries in your head. Write the entire markdown article BEFORE
  emitting the tool call. Never call the tool with an empty object {} or
  any missing field. Calls with empty arguments are silently rejected.
- Make exactly ONE complete call with all three fields populated.
- Right BEFORE calling the tool, say one short transitional sentence like
  "Okay, drafting that now." (so the user isn't left in dead silence).
  Then emit the tool call.

==========================
QUICK-START SHORTCUT
==========================
If the user says any variant of "create an article now", "just make one",
"use sample data", "demo it", "show me an example", or similar:
1. Say one short sentence: "Sure — drafting a sample release now."
2. Compose a complete, believable MOCK press release in your head (invent
   a company, product, numbers, spokesperson, and quote).
3. Call createArticle ONCE with all three fields fully filled in.

==========================
NORMAL CONVERSATION FLOW
==========================
Otherwise, in the first turn, ask which announcement they want to work on
(launch, raise, hire, partnership, milestone, or something else).

Then walk them through, in order:
- The headline angle a journalist would actually open
- The 2-3 strongest proof points (numbers, customers, named partners)
- The quoted spokesperson and the one quote that lands
- The target audience / beats

Be opinionated. Push back gently when the angle is weak.

Once you have enough information, say "Okay, drafting that now." and then
call createArticle with all three required fields fully populated.

==========================
AFTER THE TOOL RESPONDS
==========================
When you receive the tool response confirming the article was saved, say:
"Your press release is ready — take a look at the draft on screen. Approve
it when you're happy and I'll send it to the right journalists, or tell me
what to change."

==========================
HANDLING DISAPPROVAL
==========================
If the system tells you the user disapproved with feedback:
1. Say one short acknowledgment like "Got it — revising now."
2. Rewrite the complete article in your head with the feedback applied.
3. Call createArticle ONCE with all three fields fully repopulated.

IMPORTANT: Never send anything to journalists until the user approves on
screen. The user does the approving via the UI — not by voice.`;

const FIRST_MESSAGE =
  "Hey, this is Pressfy. Tell me what you're announcing and I'll help you sharpen the angle in a few minutes. Or just say 'create an article now' and I'll spin up a sample.";

const INDUSTRY_OPTIONS: Industry[] = ["Health", "Consumer Product"];

type CreateArticleArgs = {
  headline: string;
  markdown: string;
  industries: Industry[];
};

export function VoiceAssistant() {
  const { user } = useUser();
  const journalistsRaw = useQuery(api.journalists.list);
  const journalists = React.useMemo(
    () => journalistsRaw ?? [],
    [journalistsRaw],
  );
  const createArticleMutation = useMutation(api.articles.create);
  const approveArticleMutation = useMutation(api.articles.approve);
  const markSentMutation = useMutation(api.articles.markSent);

  const [status, setStatus] = React.useState<VoiceStatus>("idle");
  const [isMuted, setIsMuted] = React.useState(false);
  const [volume, setVolume] = React.useState(0);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = React.useState(false);
  const [transcript, setTranscript] = React.useState<TranscriptLine[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [callDurationMs, setCallDurationMs] = React.useState(0);
  const [articleStatus, setArticleStatus] =
    React.useState<ArticleStatus>("none");
  const [articleId, setArticleId] = React.useState<Id<"articles"> | null>(null);
  const [sendError, setSendError] = React.useState<string | null>(null);

  const article = useQuery(
    api.articles.getById,
    articleId ? { id: articleId } : "skip",
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vapiRef = React.useRef<any>(null);
  const callStartRef = React.useRef<number | null>(null);
  const transcriptScrollRef = React.useRef<HTMLDivElement | null>(null);

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_API_KEY ?? "";
  const elevenLabsVoiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID ?? "";

  const firstName =
    user?.firstName ?? user?.fullName?.split(" ")[0] ?? "there";

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
          console.log("[Pressfy] tool-calls raw message:", JSON.stringify(msg, null, 2));

          const toolCallList = msg.toolCallList as
            | Array<{
                id: string;
                function: { name: string; arguments: string | CreateArticleArgs };
              }>
            | undefined;

          const toolCall = toolCallList?.[0];
          if (!toolCall) {
            console.warn("[Pressfy] tool-calls message had no toolCallList entries");
            return;
          }

          console.log("[Pressfy] tool call received:", toolCall.function.name);
          console.log("[Pressfy] raw arguments:", toolCall.function.arguments);

          if (toolCall.function.name === "createArticle") {
            setArticleStatus("generating");
            setSendError(null);

            void (async () => {
              try {
                const rawArgs = toolCall.function.arguments;
                let parsed: CreateArticleArgs;

                if (typeof rawArgs === "string") {
                  parsed = JSON.parse(rawArgs) as CreateArticleArgs;
                } else {
                  parsed = rawArgs;
                }

                console.log("[Pressfy] parsed createArticle args:", parsed);

                if (!parsed.headline || !parsed.markdown) {
                  console.warn(
                    "[Pressfy] tool-call args missing required fields — telling agent to retry:",
                    parsed,
                  );
                  setArticleStatus("none");
                  v.send({
                    type: "add-message",
                    message: {
                      role: "tool",
                      tool_call_id: toolCall.id,
                      content:
                        "ERROR: createArticle was called with missing or empty fields. You must call it again, this time providing all three required arguments: a complete non-empty 'headline' string, a complete non-empty 'markdown' string (the full article body), and an 'industries' array. Do NOT call the tool with an empty object.",
                    },
                  });
                  return;
                }

                const safeIndustries = (parsed.industries ?? []).filter(
                  (i): i is Industry =>
                    INDUSTRY_OPTIONS.includes(i as Industry),
                );

                console.log("[Pressfy] safe industries:", safeIndustries);

                const id = await createArticleMutation({
                  headline: parsed.headline,
                  markdown: parsed.markdown,
                  industries: safeIndustries,
                });

                console.log("[Pressfy] article saved with id:", id);

                setArticleId(id);
                setArticleStatus("ready");

                v.send({
                  type: "add-message",
                  message: {
                    role: "system",
                    content: `Article draft saved (id: ${id}). It is now on the user's screen for review. Wait for them to approve or request changes.`,
                  },
                });

                v.send({
                  type: "add-message",
                  message: {
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: `Article created with id ${id}. Awaiting user approval.`,
                  },
                });
              } catch (err) {
                console.error("[Pressfy] createArticle error:", err);
                const message =
                  err instanceof Error ? err.message : "Failed to save article";
                setSendError(message);
                setArticleStatus("none");
                v.send({
                  type: "add-message",
                  message: {
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: `Error creating article: ${message}`,
                  },
                });
              }
            })();
          }
        }
      });
    });

    return () => {
      cancelled = true;
      vapiRef.current?.stop?.();
      vapiRef.current = null;
    };
  }, [publicKey, createArticleMutation]);

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

    const greeting =
      firstName === "there"
        ? FIRST_MESSAGE
        : `Hey ${firstName}, this is Pressfy. Tell me what you're announcing and I'll help you sharpen the angle in a few minutes. Or just say 'create an article now' and I'll spin up a sample.`;

    try {
      await vapi.start({
        model: {
          provider: "openai",
          model: "gpt-4.1",
          messages: [{ role: "system", content: SYSTEM_PROMPT }],
          tools: [
            {
              type: "function",
              function: {
                name: "createArticle",
                description:
                  "Saves a complete press release for user review. You MUST provide all three arguments fully populated: a non-empty headline string, a multi-paragraph markdown body string, and an industries array. NEVER call this with an empty object.",
                strict: true,
                parameters: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    headline: {
                      type: "string",
                      description:
                        "REQUIRED. The press release headline. Must be a non-empty string of at least 10 characters. Example: 'Acme Health Raises $20M Series B to Expand Remote Patient Monitoring'.",
                    },
                    markdown: {
                      type: "string",
                      description:
                        "REQUIRED. The complete press release written as Markdown. Must be a non-empty string of at least 400 characters. Must include: a # H1 headline matching the headline field, 3-5 body paragraphs separated by blank lines, and at least one > blockquote for the spokesperson quote.",
                    },
                    industries: {
                      type: "array",
                      description:
                        "REQUIRED. Journalist verticals to distribute to. Include every industry that applies. Use [] only if the story genuinely fits neither beat.",
                      items: {
                        type: "string",
                        enum: ["Health", "Consumer Product"],
                      },
                    },
                  },
                  required: ["headline", "markdown", "industries"],
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
    setArticleId(null);
    callStartRef.current = null;
  }, []);

  const handleApprove = React.useCallback(async () => {
    if (!articleId || !article) return;
    setSendError(null);
    setArticleStatus("sending");
    try {
      await approveArticleMutation({ id: articleId });

      const res = await fetch("/api/send-press-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: article.headline,
          markdown: article.markdown,
          industries: article.industries,
          journalists,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to send");
      }

      await markSentMutation({ id: articleId });
      setArticleStatus("sent");

      vapiRef.current?.send?.({
        type: "add-message",
        message: {
          role: "system",
          content:
            "The user approved the article and it has been sent to the matching journalists. Congratulate them briefly.",
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to send press release";
      setSendError(message);
      setArticleStatus("ready");
    }
  }, [
    article,
    articleId,
    approveArticleMutation,
    journalists,
    markSentMutation,
  ]);

  const handleReject = React.useCallback(
    (feedback: string) => {
      const vapi = vapiRef.current;
      const note = feedback.trim();

      vapi?.send?.({
        type: "add-message",
        message: {
          role: "system",
          content: `The user DISAPPROVED the draft. ${
            note
              ? `Their feedback: "${note}". `
              : "They did not give specific feedback — ask them what to change. "
          }Acknowledge briefly and then call createArticle again with a revised version that addresses every change.`,
        },
      });

      setArticleStatus("rejected");
      setArticleId(null);
      setSendError(null);
    },
    [],
  );

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
          key={articleId ?? "none"}
          articleStatus={articleStatus}
          headline={article?.headline ?? null}
          markdown={article?.markdown ?? null}
          industries={(article?.industries ?? []) as Industry[]}
          journalists={journalists}
          sendError={sendError}
          onApprove={handleApprove}
          onReject={handleReject}
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
    <Badge className="gap-1.5 rounded-none bg-white text-black">Error</Badge>
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
      <div ref={ref} className="flex h-64 flex-col gap-3 overflow-y-auto p-4">
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
                line.role === "user" ? "text-white/70" : "text-black/50",
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

type JournalistRecord = {
  _id: string;
  name: string;
  email: string;
  industry: Industry;
};

function ArticlePreview({
  articleStatus,
  headline,
  markdown,
  industries,
  journalists,
  sendError,
  onApprove,
  onReject,
}: {
  articleStatus: ArticleStatus;
  headline: string | null;
  markdown: string | null;
  industries: Industry[];
  journalists: JournalistRecord[];
  sendError: string | null;
  onApprove: () => void;
  onReject: (feedback: string) => void;
}) {
  const [feedback, setFeedback] = React.useState("");
  const [showFeedback, setShowFeedback] = React.useState(false);

  if (articleStatus === "none") return null;

  if (articleStatus === "generating") {
    return (
      <div className="flex items-center gap-3 border-2 border-dashed border-black bg-white/50 p-5 text-sm font-medium uppercase tracking-[0.14em] text-black/60">
        <LoaderIcon className="size-4 shrink-0 animate-spin text-[#fd5200]" />
        <span>Drafting your press release — just a moment…</span>
      </div>
    );
  }

  if (articleStatus === "rejected") {
    return (
      <div className="flex items-center gap-3 border-2 border-dashed border-black bg-white/50 p-5 text-sm font-medium uppercase tracking-[0.14em] text-black/60">
        <LoaderIcon className="size-4 shrink-0 animate-spin text-[#fd5200]" />
        <span>Revising your draft based on your feedback…</span>
      </div>
    );
  }

  const matchingJournalists = journalists.filter((j) =>
    industries.includes(j.industry),
  );

  if (articleStatus === "sent") {
    return (
      <div className="flex items-center gap-3 border-2 border-black bg-[#fd5200] p-5 text-sm font-bold uppercase tracking-[0.14em] text-white">
        <CircleCheckIcon className="size-4 shrink-0" />
        <span>
          Sent to {matchingJournalists.length} journalist
          {matchingJournalists.length !== 1 ? "s" : ""} across{" "}
          {industries.length > 0 ? industries.join(" + ") : "no industries"}.
        </span>
      </div>
    );
  }

  if (!headline || !markdown) return null;

  const isSending = articleStatus === "sending";
  const isApprovedView =
    articleStatus === "approved" || articleStatus === "sending";

  return (
    <div className="overflow-hidden border-2 border-black bg-white/60">
      <div className="flex items-center justify-between border-b-2 border-black bg-black px-5 py-3 text-white">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em]">
          <FileTextIcon className="size-4 text-[#fd5200]" />
          Press release draft
        </div>
        {isApprovedView ? (
          <Badge
            variant="outline"
            className="gap-1.5 rounded-none border-white/40 text-white"
          >
            <CheckIcon className="size-3" />
            Approved
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="rounded-none border-white/40 text-white/70"
          >
            Awaiting review
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/50">
            Target industries
          </span>
          {industries.length === 0 ? (
            <Badge
              variant="outline"
              className="rounded-none border-black text-black/60"
            >
              None selected
            </Badge>
          ) : (
            industries.map((industry) => (
              <Badge
                key={industry}
                className="rounded-none bg-black text-white"
              >
                {industry} ·{" "}
                {
                  journalists.filter((j) => j.industry === industry).length
                }{" "}
                contacts
              </Badge>
            ))
          )}
        </div>

        <div className="prose prose-sm max-w-none border-2 border-black bg-white p-5 text-black prose-headings:font-bold prose-headings:uppercase prose-headings:tracking-tight prose-h1:text-2xl prose-h1:leading-tight prose-h2:text-lg prose-p:leading-relaxed prose-blockquote:border-l-4 prose-blockquote:border-[#fd5200] prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-black/70 prose-strong:text-black">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>

        {sendError ? (
          <p className="border-2 border-destructive bg-destructive/10 p-3 text-xs font-medium text-destructive">
            {sendError}
          </p>
        ) : null}

        {!isApprovedView ? (
          <>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                onClick={onApprove}
                disabled={industries.length === 0 || matchingJournalists.length === 0}
                className="gap-2 rounded-none bg-[#fd5200] font-bold uppercase tracking-[0.16em] text-white hover:bg-[#e04a00] disabled:opacity-60"
              >
                <CheckIcon className="size-4" />
                Approve &amp; send to {matchingJournalists.length} journalist
                {matchingJournalists.length !== 1 ? "s" : ""}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowFeedback((s) => !s)}
                className="gap-2 rounded-none border-2 border-black bg-white font-bold uppercase tracking-[0.16em] text-black hover:bg-black hover:text-white"
              >
                <XIcon className="size-4" />
                Disapprove &amp; revise
              </Button>
            </div>

            {industries.length === 0 ? (
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-black/50">
                The AI selected no industries for this story — ask it to widen
                the scope or disapprove to revise.
              </p>
            ) : null}

            {showFeedback ? (
              <div className="flex flex-col gap-3 border-2 border-dashed border-black p-4">
                <label
                  htmlFor="reject-feedback"
                  className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/60"
                >
                  What should change?
                </label>
                <textarea
                  id="reject-feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="e.g. punchier headline, drop the metric in paragraph 2, change the quote to come from the CTO…"
                  rows={3}
                  className="resize-none border-2 border-black bg-white p-3 text-sm leading-relaxed text-black focus:outline-none focus:ring-2 focus:ring-[#fd5200]"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => onReject(feedback)}
                    className="gap-2 rounded-none bg-black font-bold uppercase tracking-[0.16em] text-white hover:bg-black/80"
                  >
                    <RotateCcwIcon className="size-4" />
                    Send feedback &amp; regenerate
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowFeedback(false)}
                    className="rounded-none font-bold uppercase tracking-[0.16em] text-black/60 hover:bg-transparent hover:text-black"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex items-center gap-3 pt-1">
            {isSending ? (
              <Badge className="gap-2 rounded-none bg-black px-3 py-2 text-white">
                <LoaderIcon className="size-4 animate-spin" />
                Sending…
              </Badge>
            ) : (
              <Badge className="gap-2 rounded-none bg-[#fd5200] px-3 py-2 text-white">
                <SendIcon className="size-4" />
                Delivering to {matchingJournalists.length} journalist
                {matchingJournalists.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        )}
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
