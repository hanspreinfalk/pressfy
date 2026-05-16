"use client";

import * as React from "react";
import { useUser } from "@clerk/nextjs";
import {
  AudioLinesIcon,
  CircleCheckIcon,
  LoaderIcon,
  MicIcon,
  MicOffIcon,
  PhoneIcon,
  PhoneOffIcon,
  SparklesIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type VoiceStatus = "idle" | "connecting" | "active" | "ended" | "error";

type TranscriptLine = {
  role: "user" | "assistant";
  text: string;
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
hooks, and surface obvious follow-ups. End with a clean, spoken summary the
user can copy into their draft.`;

const FIRST_MESSAGE =
  "Hey, this is Pressfy. Tell me what you're announcing and I'll help you sharpen the angle in a few minutes.";

export function VoiceAssistant() {
  const { user } = useUser();

  const [status, setStatus] = React.useState<VoiceStatus>("idle");
  const [isMuted, setIsMuted] = React.useState(false);
  const [volume, setVolume] = React.useState(0);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = React.useState(false);
  const [transcript, setTranscript] = React.useState<TranscriptLine[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [callDurationMs, setCallDurationMs] = React.useState(0);

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
    setCallDurationMs(0);
    callStartRef.current = null;
  }, []);

  if (!publicKey) {
    return <MissingKeyNotice />;
  }

  const isConnecting = status === "connecting";
  const isActive = status === "active";
  const isEnded = status === "ended";
  const isError = status === "error";

  return (
    <Card className="overflow-hidden border-foreground/5">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/60 pb-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <SparklesIcon className="size-5" />
          </span>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">Pressfy voice strategist</CardTitle>
            <p className="text-sm text-muted-foreground">
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

      <CardContent className="flex flex-col gap-6">
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
      </CardContent>
    </Card>
  );
}

function MissingKeyNotice() {
  return (
    <Card className="border-foreground/5">
      <CardHeader>
        <CardTitle>Voice strategist not configured</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          Set{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
            NEXT_PUBLIC_VAPI_PUBLIC_API_KEY
          </code>{" "}
          in your environment to enable voice conversations.
        </p>
        <p>
          Optionally set{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
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
      <Badge variant="outline" className="gap-1.5">
        <span className="size-1.5 rounded-full bg-muted-foreground/60" />
        Ready
      </Badge>
    );
  }

  if (status === "connecting") {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <LoaderIcon className="size-3 animate-spin" />
        Connecting
      </Badge>
    );
  }

  if (status === "active") {
    return (
      <Badge variant="default" className="gap-1.5 bg-emerald-600/15 text-emerald-700 dark:text-emerald-400">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        {isMuted ? "Muted" : "Live"} · {formatDuration(callDurationMs)}
      </Badge>
    );
  }

  if (status === "ended") {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <CircleCheckIcon className="size-3" />
        Call ended
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="gap-1.5">
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
            className="absolute size-44 rounded-full bg-primary/15"
            style={{
              animation: "ping 2.2s cubic-bezier(0,0,0.2,1) infinite",
            }}
          />
          <span
            className="absolute size-32 rounded-full bg-primary/20"
            style={{
              animation: "ping 2.2s cubic-bezier(0,0,0.2,1) infinite 0.4s",
            }}
          />
        </>
      ) : null}

      <div
        className={cn(
          "relative flex size-28 items-center justify-center rounded-full border transition-all duration-500",
          isActive
            ? "border-primary/30 bg-primary text-primary-foreground shadow-lg shadow-primary/30"
            : isEnded
              ? "border-border bg-card text-foreground"
              : isError
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : isConnecting
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-muted text-muted-foreground",
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
        <Button size="lg" onClick={onStart} className="gap-2 px-6">
          <PhoneIcon className="size-4" />
          Start voice session
        </Button>
        <p className="text-xs text-muted-foreground">
          We&apos;ll ask for microphone access. Stop anytime.
        </p>
      </div>
    );
  }

  if (status === "connecting") {
    return (
      <div className="flex justify-center">
        <Button size="lg" disabled className="gap-2 px-6">
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
          className="gap-2 px-6"
        >
          <PhoneOffIcon className="size-4" />
          End session
        </Button>
      </div>
    );
  }

  return (
    <div className="flex justify-center gap-3">
      <Button variant="outline" onClick={onReset}>
        Clear and reset
      </Button>
      <Button onClick={onStart} className="gap-2">
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
      <div className="rounded-3xl border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
        {isActive
          ? "Listening… your conversation will appear here in real time."
          : "Start a session and the live transcript will show up here."}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-muted/30">
      <div className="flex items-center justify-between border-b border-border bg-card/40 px-4 py-2.5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Live transcript
        </p>
        <span className="text-xs text-muted-foreground">
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
              "flex max-w-[85%] flex-col gap-1 rounded-2xl px-4 py-3 text-sm leading-relaxed",
              line.role === "user"
                ? "self-end bg-primary text-primary-foreground"
                : "self-start bg-card text-card-foreground ring-1 ring-border",
            )}
          >
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider",
                line.role === "user"
                  ? "text-primary-foreground/70"
                  : "text-muted-foreground",
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

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}
