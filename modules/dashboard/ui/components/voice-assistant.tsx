"use client";

import * as React from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  AudioLinesIcon,
  CheckIcon,
  CircleCheckIcon,
  FileTextIcon,
  LoaderIcon,
  MailIcon,
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
type PressReleaseStatus =
  | "none"
  | "generating"
  | "ready"
  | "approved"
  | "rejected";
type EmailStatus =
  | "none"
  | "generating"
  | "ready"
  | "approved"
  | "sending"
  | "sent"
  | "rejected";

type Industry = Doc<"journalists">["industry"];

type TranscriptLine = {
  role: "user" | "assistant";
  text: string;
};

type CreatePressReleaseArgs = {
  headline: string;
  markdown: string;
  industries: Industry[];
};

type DraftEmailArgs = {
  subject: string;
  intro: string;
};

type EmailDraft = {
  subject: string;
  intro: string;
};

type PendingSend = {
  industries: string[];
  toolCallId: string;
};

const SYSTEM_PROMPT = `You are Pressfy's AI press strategist — a precise, articulate collaborator for startup founders and comms teams.

Your job: guide the user through creating a press release, drafting journalist outreach, and distributing it.

==========================
YOUR FOUR TOOLS
==========================

1. get_industries
   Returns the live journalist verticals for distribution.
   - Takes no arguments.
   - MUST be called before create_press_release.
   - MUST be called before send_press_release.

2. create_press_release
   Saves a complete press release draft for user review.
   - Arguments: headline (string), markdown (string), industries (string[])
   - Use ONLY industry values returned by get_industries.
   - Must include: # H1 headline, 3–5 body paragraphs, at least one > blockquote for a spokesperson quote.

3. draft_email
   Creates an outreach email draft for journalist distribution.
   - Only call this AFTER the system confirms the user approved the press release.
   - Arguments: subject (string), intro (string)
   - subject: a short punchy subject line (one sentence).
   - intro: a short personal pitch for the journalist (2–3 sentences ONLY). Say who you are, why this story matters to them, and what makes it newsworthy. Do NOT include the press release body — it is appended automatically.

4. send_press_release
   Sends the approved email to relevant journalists.
   - Only call this AFTER get_industries AND after the system confirms the user approved the email draft.
   - Arguments: industries (string[] from get_industries)

==========================
STEP-BY-STEP WORKFLOW
==========================

STEP 1 — GATHER INFORMATION
Ask the user about their announcement:
- Company and product
- Funding, traction, key metrics
- What makes it different from competitors
- Key spokesperson and their quote
- Target audience and journalist beats

Ask follow-up questions until you have enough for a strong, newsworthy story.

STEP 2 — CREATE PRESS RELEASE
When you have enough information, call get_industries (no arguments), then immediately call create_press_release with all three fields fully populated. Do NOT say anything before or during the tool calls.

After the tools respond, say: "Your press release is ready — review the draft on screen. Approve it when you're happy or tell me what to change."

STEP 3 — WAIT FOR PRESS RELEASE APPROVAL
Do NOT proceed until the system tells you the press release was approved or rejected.
- If approved → system message will say so. Proceed to Step 4.
- If rejected with feedback → call get_industries, then create_press_release again with full revisions.

STEP 4 — DRAFT OUTREACH EMAIL
Only start after the system says "User approved the press release."
Immediately call draft_email with:
- subject: a short punchy subject line (one sentence)
- intro: a 2–3 sentence personal pitch ONLY — who you are, why this story matters to the journalist, what makes it newsworthy. Do NOT include the press release content in intro; it is appended automatically.
Do NOT say anything before or during the tool call.

After the tool responds, say: "Here's your email draft — review it on screen. Approve it or tell me what to change."

STEP 5 — WAIT FOR EMAIL APPROVAL
Do NOT send until the system tells you the email was approved or rejected.
- If approved → system message will say so. Proceed to Step 6.
- If rejected with feedback → call draft_email again with the revised subject and body.

STEP 6 — SEND
Only start after the system says "User approved the email draft."
Call get_industries, then immediately call send_press_release with the industries. Do NOT say anything before or during the tool calls.

STEP 7 — CONFIRM
After send_press_release responds:
- If success: congratulate the user and mention how many journalists were reached.
- If failure: clearly explain the error and suggest a fix (e.g., check Resend API key).

==========================
QUICK-START SHORTCUT
==========================
If the user says "create a press release now", "use sample data", "demo it", "just make one", or similar:
1. Call get_industries immediately without saying anything first.
2. Call create_press_release with a complete, believable MOCK press release (invent company, product, numbers, spokesperson quote).
3. After the tool responds, say: "Here's a sample press release — take a look and let me know what to change."

==========================
HANDLING DISAPPROVAL
==========================
Press release disapproved:
- Call get_industries, then create_press_release with the full revised article. Do NOT say anything before or during the tool calls.
- After the tools respond, say: "I've revised it — take another look."

Email disapproved:
- Call draft_email immediately with a revised subject and intro. Do NOT say anything before or during the tool call.
- After the tool responds, say: "Here's the revised email — let me know if this works."

==========================
CRITICAL RULES
==========================
- NEVER speak before or during a tool call. Tool calls must be made silently.
- NEVER call a tool with empty or missing arguments. The arguments must be FULLY POPULATED in the SAME tool call. There is no "second step" — the model generates the complete content inside the tool call itself.
  • create_press_release: headline, markdown, and industries must ALL be present and non-empty. The markdown must be the complete press release text (400+ characters) in the same call.
  • draft_email: subject and intro must BOTH be present and non-empty. Generate them in the same tool call.
  • send_press_release: industries must be a non-empty array of values from get_industries.
- If you are about to call a tool but don't have all the arguments ready, STOP and ask the user for whatever you're missing instead.
- NEVER send emails without explicit user approval confirmed by the system.
- NEVER call send_press_release without calling get_industries immediately before it.
- NEVER skip steps in the workflow.
- Use ONLY industry values returned by get_industries — never invent them.
- The press release markdown MUST be complete (400+ characters, # H1, 3–5 paragraphs, > blockquote quote).
- Keep voice responses concise (2–3 sentences). Be opinionated and direct.`;

const FIRST_MESSAGE =
  "Hey, this is Pressfy. Tell me what you're announcing and I'll help you craft and send a journalist-ready press release. Or just say 'create an article now' for a quick demo.";

function buildFallbackPressRelease(
  industries: Industry[],
  transcript: TranscriptLine[],
): CreatePressReleaseArgs {
  const userContext = transcript
    .filter((line) => line.role === "user")
    .map((line) => line.text)
    .join(" ")
    .trim();
  const primaryIndustry = industries[0];
  const selectedIndustries = primaryIndustry ? [primaryIndustry] : [];
  const isShort = /\b(short|brief|quick|concise)\b/i.test(userContext);

  const headline =
    primaryIndustry === "Health"
      ? "MediPulse Launches AI Health Assistant to Improve Patient Care"
      : "NovaLaunch Introduces AI Platform for Faster Startup Announcements";

  const markdown = isShort
    ? `# ${headline}

MediPulse today announced the launch of an AI-powered health assistant designed to help clinics improve patient engagement, streamline follow-up care, and reduce administrative work for care teams.

The platform uses intelligent reminders, health insights, and workflow automation to help providers identify patient needs earlier and deliver more personalized support between appointments.

> "Healthcare teams need practical AI that saves time and improves outcomes," said Dr. Lisa Chen, CEO of MediPulse. "Our goal is to make proactive care easier for every clinic."

MediPulse is now available to healthcare providers across the United States.`
    : `# ${headline}

MediPulse, a health technology startup building AI tools for modern care teams, today announced the launch of its AI-powered health assistant for clinics and hospitals. The platform helps providers deliver proactive patient support through personalized reminders, real-time health insights, and automated follow-up workflows.

The assistant integrates with existing healthcare operations and gives care teams a clearer view of patient needs between appointments. Early pilots showed stronger patient engagement and helped clinical staff reduce time spent on repetitive administrative tasks.

> "Healthcare teams need practical AI that saves time and improves outcomes," said Dr. Lisa Chen, CEO of MediPulse. "Our goal is to make proactive care easier for every clinic."

The launch comes as providers look for tools that can improve patient experience without adding complexity to already stretched teams. MediPulse is now available to healthcare organizations across the United States, with additional integrations planned later this year.`;

  return {
    headline,
    markdown,
    industries: selectedIndustries,
  };
}

function buildFallbackEmailDraft(headline: string): EmailDraft {
  return {
    subject: `Story idea: ${headline}`,
    intro:
      "Hello, my name is Hans. I found something timely in the health technology space that may be relevant to your coverage: a new AI assistant designed to help care teams improve patient engagement and reduce administrative work. The press release is included below, and I would be happy to share more details or arrange an interview.",
  };
}

export function VoiceAssistant() {
  const { user } = useUser();
  const journalistsRaw = useQuery(api.journalists.list);
  const journalists = React.useMemo(
    () => journalistsRaw ?? [],
    [journalistsRaw],
  );
  const industriesRaw = useQuery(api.journalists.getUniqueIndustries);
  const industryOptions = React.useMemo(
    () => industriesRaw ?? [],
    [industriesRaw],
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

  // Press release state
  const [pressReleaseStatus, setPressReleaseStatus] =
    React.useState<PressReleaseStatus>("none");
  const [articleId, setArticleId] = React.useState<Id<"articles"> | null>(
    null,
  );

  // Email draft state
  const [emailStatus, setEmailStatus] = React.useState<EmailStatus>("none");
  const [emailDraft, setEmailDraft] = React.useState<EmailDraft | null>(null);

  // Error state
  const [sendError, setSendError] = React.useState<string | null>(null);

  // Bridges the VAPI message handler into the send effect (avoids stale closures)
  const [pendingSend, setPendingSend] = React.useState<PendingSend | null>(
    null,
  );

  const article = useQuery(
    api.articles.getById,
    articleId ? { id: articleId } : "skip",
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vapiRef = React.useRef<any>(null);
  const callStartRef = React.useRef<number | null>(null);
  const transcriptScrollRef = React.useRef<HTMLDivElement | null>(null);
  const transcriptRef = React.useRef<TranscriptLine[]>([]);
  const articleRef = React.useRef<Doc<"articles"> | null>(null);

  // Keep a ref to industryOptions so the VAPI handler always reads the latest
  // without triggering a VAPI reconnect every time industries load.
  const industryOptionsRef = React.useRef(industryOptions);
  React.useEffect(() => {
    industryOptionsRef.current = industryOptions;
  }, [industryOptions]);

  React.useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  React.useEffect(() => {
    articleRef.current = article ?? null;
  }, [article]);

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_API_KEY ?? "";
  const elevenLabsVoiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID ?? "";

  const firstName =
    user?.firstName ?? user?.fullName?.split(" ")[0] ?? "there";

  // VAPI setup effect
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
          const role: TranscriptLine["role"] =
            msg.role === "user" ? "user" : "assistant";
          const text = String(msg.transcript ?? "").trim();
          if (!text) return;
          setTranscript((prev) => {
            const next = [...prev, { role, text }];
            transcriptRef.current = next;
            return next;
          });
        }

        if (msg.type === "tool-calls") {
          console.log(
            "[Pressfy] tool-calls raw message:",
            JSON.stringify(msg, null, 2),
          );

          const toolCallList = msg.toolCallList as
            | Array<{
                id: string;
                function: { name: string; arguments: string | unknown };
              }>
            | undefined;

          const toolCall = toolCallList?.[0];
          if (!toolCall) {
            console.warn(
              "[Pressfy] tool-calls message had no toolCallList entries",
            );
            return;
          }

          console.log("[Pressfy] tool call received:", toolCall.function.name);

          function parseArgs<T>(raw: string | unknown): T {
            if (typeof raw === "string") return JSON.parse(raw) as T;
            return raw as T;
          }

          // ── get_industries ──────────────────────────────────────────────
          if (toolCall.function.name === "get_industries") {
            const available = industryOptionsRef.current.slice();
            console.log("[Pressfy] get_industries returning:", available);
            v.send({
              type: "add-message",
              message: {
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify({ industries: available }),
              },
            });
            return;
          }

          // ── create_press_release ────────────────────────────────────────
          if (toolCall.function.name === "create_press_release") {
            setPressReleaseStatus("generating");
            setSendError(null);

            void (async () => {
              try {
                let parsed = parseArgs<Partial<CreatePressReleaseArgs>>(
                  toolCall.function.arguments,
                );

                console.log(
                  "[Pressfy] parsed create_press_release args:",
                  parsed,
                );

                const fallbackPressRelease = buildFallbackPressRelease(
                  industryOptionsRef.current,
                  transcriptRef.current,
                );

                if (!parsed.headline || !parsed.markdown) {
                  console.warn(
                    "[Pressfy] create_press_release missing required fields; using fallback draft:",
                    parsed,
                  );
                  parsed = fallbackPressRelease;
                }

                const safeIndustries = (parsed.industries ?? []).filter(
                  (i): i is Industry =>
                    industryOptionsRef.current.includes(i as Industry),
                );
                const pressRelease: CreatePressReleaseArgs = {
                  headline: parsed.headline ?? fallbackPressRelease.headline,
                  markdown: parsed.markdown ?? fallbackPressRelease.markdown,
                  industries: safeIndustries,
                };

                const id = await createArticleMutation({
                  headline: pressRelease.headline,
                  markdown: pressRelease.markdown,
                  industries: pressRelease.industries,
                });

                console.log("[Pressfy] press release saved with id:", id);
                setArticleId(id);
                setPressReleaseStatus("ready");

                v.send({
                  type: "add-message",
                  message: {
                    role: "system",
                    content: `Press release draft saved (id: ${id}). It is now on the user's screen for review. Wait for them to approve or request changes.`,
                  },
                });

                v.send({
                  type: "add-message",
                  message: {
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: `Press release created with id ${id}. Awaiting user approval on screen.`,
                  },
                });
              } catch (err) {
                console.error("[Pressfy] create_press_release error:", err);
                const message =
                  err instanceof Error
                    ? err.message
                    : "Failed to save press release";
                setSendError(message);
                setPressReleaseStatus("none");
                v.send({
                  type: "add-message",
                  message: {
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: `Error creating press release: ${message}`,
                  },
                });
              }
            })();
            return;
          }

          // ── draft_email ─────────────────────────────────────────────────
          if (toolCall.function.name === "draft_email") {
            setEmailStatus("generating");
            try {
              let parsed = parseArgs<Partial<DraftEmailArgs>>(
                toolCall.function.arguments,
              );

              console.log("[Pressfy] draft_email args:", parsed);

              const fallbackEmailDraft = buildFallbackEmailDraft(
                articleRef.current?.headline ?? "New AI Health Story",
              );

              if (!parsed.subject || !parsed.intro) {
                console.warn(
                  "[Pressfy] draft_email missing required fields; using fallback draft:",
                  parsed,
                );
                parsed = fallbackEmailDraft;
              }
              const draft: EmailDraft = {
                subject: parsed.subject ?? fallbackEmailDraft.subject,
                intro: parsed.intro ?? fallbackEmailDraft.intro,
              };

              setEmailDraft(draft);
              setEmailStatus("ready");

              v.send({
                type: "add-message",
                message: {
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content:
                    "Email draft created. It is now on the user's screen for review. Wait for them to approve or request changes.",
                },
              });
            } catch (err) {
              console.error("[Pressfy] draft_email error:", err);
              const message =
                err instanceof Error
                  ? err.message
                  : "Failed to create email draft";
              setEmailStatus("none");
              v.send({
                type: "add-message",
                message: {
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: `Error creating email draft: ${message}`,
                },
              });
            }
            return;
          }

          // ── send_press_release ──────────────────────────────────────────
          if (toolCall.function.name === "send_press_release") {
            try {
              const parsed = parseArgs<{ industries: string[] }>(
                toolCall.function.arguments,
              );
              console.log("[Pressfy] send_press_release industries:", parsed.industries);
              setPendingSend({
                industries: parsed.industries ?? [],
                toolCallId: toolCall.id,
              });
            } catch (err) {
              const message =
                err instanceof Error ? err.message : "Invalid arguments";
              v.send({
                type: "add-message",
                message: {
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: `Error parsing send_press_release arguments: ${message}`,
                },
              });
            }
            return;
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

  // Pending send effect — fires when all required data is ready.
  // Using a state bridge avoids stale closures in the VAPI message handler.
  React.useEffect(() => {
    if (!pendingSend || !article || !emailDraft || !articleId) return;

    const { industries, toolCallId } = pendingSend;
    setPendingSend(null);
    setEmailStatus("sending");
    setSendError(null);

    const vapi = vapiRef.current;
    const articleSnapshot = {
      headline: article.headline,
      markdown: article.markdown,
    };
    const emailDraftSnapshot = { ...emailDraft };
    const articleIdSnapshot = articleId;
    const journalistsSnapshot = [...journalists];

    void (async () => {
      try {
        const res = await fetch("/api/send-press-release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            headline: articleSnapshot.headline,
            markdown: articleSnapshot.markdown,
            emailSubject: emailDraftSnapshot.subject,
            emailIntro: emailDraftSnapshot.intro,
            industries,
            journalists: journalistsSnapshot,
          }),
        });

        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Failed to send");
        }

        const data = (await res.json()) as { sent: number; failed: number };
        console.log(
          `[Pressfy] Send complete — sent: ${data.sent}, failed: ${data.failed}`,
        );

        await markSentMutation({ id: articleIdSnapshot });
        setEmailStatus("sent");

        vapi?.send?.({
          type: "add-message",
          message: {
            role: "tool",
            tool_call_id: toolCallId,
            content: `Successfully sent press release to ${data.sent} journalist${data.sent !== 1 ? "s" : ""}${data.failed > 0 ? `. ${data.failed} failed.` : "."}`,
          },
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to send press release";
        console.error("[Pressfy] send error:", message);
        setSendError(message);
        setEmailStatus("ready");

        vapi?.send?.({
          type: "add-message",
          message: {
            role: "tool",
            tool_call_id: toolCallId,
            content: `Failed to send press release: ${message}. Inform the user of the error clearly.`,
          },
        });
      }
    })();
  }, [pendingSend, article, emailDraft, articleId, journalists, markSentMutation]);

  // Call duration timer
  React.useEffect(() => {
    if (status !== "active") return;
    const id = window.setInterval(() => {
      if (callStartRef.current) {
        setCallDurationMs(Date.now() - callStartRef.current);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [status]);

  // Auto-scroll transcript
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
        : `Hey ${firstName}, this is Pressfy. Tell me what you're announcing and I'll help you craft and send a journalist-ready press release. Or say 'create an article now' for a quick demo.`;

    try {
      await vapi.start({
        model: {
          provider: "openai",
          model: "gpt-4o",
          temperature: 0.5,
          messages: [{ role: "system", content: SYSTEM_PROMPT }],
          tools: [
            {
              type: "function",
              function: {
                name: "get_industries",
                description:
                  "Returns the live list of journalist industry verticals available for press release distribution. Call this before create_press_release and before send_press_release.",
                parameters: {
                  type: "object",
                  properties: {},
                },
              },
            },
            {
              type: "function",
              function: {
                name: "create_press_release",
                description:
                  "Saves a complete press release draft for user review. MUST call get_industries first. Provide all three fields fully populated.",
                parameters: {
                  type: "object",
                  properties: {
                    headline: {
                      type: "string",
                      description:
                        "The press release headline. Non-empty, 10+ characters.",
                    },
                    markdown: {
                      type: "string",
                      description:
                        "The complete press release body in Markdown. Include a # H1 headline, 3–5 body paragraphs, and at least one > blockquote for a spokesperson quote.",
                    },
                    industries: {
                      type: "array",
                      description:
                        "Industry values from get_industries that match this story.",
                      items: { type: "string" },
                    },
                  },
                  required: ["headline", "markdown", "industries"],
                },
              },
            },
            {
              type: "function",
              function: {
                name: "draft_email",
                description:
                  "Creates a journalist outreach email draft for user review. Only call after the system confirms the user approved the press release. The press release body is appended automatically — do NOT put it in intro.",
                parameters: {
                  type: "object",
                  properties: {
                    subject: {
                      type: "string",
                      description:
                        "A short punchy email subject line (one sentence).",
                    },
                    intro: {
                      type: "string",
                      description:
                        "A 2–3 sentence personal pitch for the journalist: who you are, why this story is relevant, what makes it newsworthy. Keep it brief — the full press release is appended automatically.",
                    },
                  },
                  required: ["subject", "intro"],
                },
              },
            },
            {
              type: "function",
              function: {
                name: "send_press_release",
                description:
                  "Sends the approved email to relevant journalists. MUST call get_industries immediately before this. Only call after the system confirms the user approved the email draft.",
                parameters: {
                  type: "object",
                  properties: {
                    industries: {
                      type: "array",
                      description:
                        "Industry values from the most recent get_industries response.",
                      items: { type: "string" },
                    },
                  },
                  required: ["industries"],
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
    setPressReleaseStatus("none");
    setEmailStatus("none");
    setEmailDraft(null);
    setArticleId(null);
    setPendingSend(null);
    callStartRef.current = null;
  }, []);

  const handleApprovePressRelease = React.useCallback(async () => {
    if (!articleId) return;
    try {
      await approveArticleMutation({ id: articleId });
      setPressReleaseStatus("approved");
      vapiRef.current?.send?.({
        type: "add-message",
        message: {
          role: "system",
          content:
            "The user approved the press release. Proceed to Step 4: call draft_email now with a compelling subject and full body.",
        },
      });
    } catch (err) {
      console.error("[Pressfy] Error approving press release:", err);
    }
  }, [articleId, approveArticleMutation]);

  const handleRejectPressRelease = React.useCallback((feedback: string) => {
    const note = feedback.trim();
    vapiRef.current?.send?.({
      type: "add-message",
      message: {
        role: "system",
        content: `The user DISAPPROVED the press release. ${
          note
            ? `Their feedback: "${note}". `
            : "They did not give specific feedback — ask them what to change. "
        }Acknowledge briefly, then call get_industries and create_press_release again with a fully revised version.`,
      },
    });
    setPressReleaseStatus("rejected");
    setArticleId(null);
    setSendError(null);
  }, []);

  const handleApproveEmail = React.useCallback(async () => {
    if (!article || !articleId || !emailDraft) {
      setSendError("Missing approved press release or email draft.");
      setEmailStatus("ready");
      return;
    }

    const targetIndustries = (article.industries ?? []) as Industry[];
    const matchingJournalists = journalists.filter((j) =>
      targetIndustries.includes(j.industry),
    );

    if (targetIndustries.length === 0 || matchingJournalists.length === 0) {
      setSendError(
        "No matching journalists found for the selected industries.",
      );
      setEmailStatus("ready");
      return;
    }

    setEmailStatus("sending");
    setSendError(null);

    try {
      const res = await fetch("/api/send-press-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: article.headline,
          markdown: article.markdown,
          emailSubject: emailDraft.subject,
          emailIntro: emailDraft.intro,
          industries: targetIndustries,
          journalists,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        sent?: number;
        failed?: number;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to send press release");
      }

      await markSentMutation({ id: articleId });
      setEmailStatus("sent");

      vapiRef.current?.send?.({
        type: "add-message",
        message: {
          role: "system",
          content: `The approved press release was sent successfully to ${data.sent ?? matchingJournalists.length} journalist${(data.sent ?? matchingJournalists.length) !== 1 ? "s" : ""}. Briefly confirm success to the user.`,
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to send press release";
      console.error("[Pressfy] send error:", message);
      setSendError(message);
      setEmailStatus("ready");

      vapiRef.current?.send?.({
        type: "add-message",
        message: {
          role: "system",
          content: `Sending failed: ${message}. Tell the user clearly that the email was not sent.`,
        },
      });
    }
  }, [article, articleId, emailDraft, journalists, markSentMutation]);

  const handleRejectEmail = React.useCallback((feedback: string) => {
    const note = feedback.trim();
    vapiRef.current?.send?.({
      type: "add-message",
      message: {
        role: "system",
        content: `The user DISAPPROVED the email draft. ${
          note
            ? `Their feedback: "${note}". `
            : "They did not give specific feedback — ask them what to change. "
        }Acknowledge briefly, then call draft_email again with a fully revised subject and body.`,
      },
    });
    setEmailStatus("rejected");
    setEmailDraft(null);
  }, []);

  if (!publicKey) {
    return <MissingKeyNotice />;
  }

  const isConnecting = status === "connecting";
  const isActive = status === "active";
  const isEnded = status === "ended";
  const isError = status === "error";

  const matchingJournalistsCount = article
    ? journalists.filter((j) =>
        (article.industries as string[]).includes(j.industry),
      ).length
    : 0;

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

        <PressReleasePreview
          key={articleId ?? "none"}
          pressReleaseStatus={pressReleaseStatus}
          headline={article?.headline ?? null}
          markdown={article?.markdown ?? null}
          industries={(article?.industries ?? []) as Industry[]}
          journalists={journalists}
          onApprove={handleApprovePressRelease}
          onReject={handleRejectPressRelease}
        />

        <EmailDraftPreview
          key={emailDraft?.subject ?? "email-none"}
          emailStatus={emailStatus}
          subject={emailDraft?.subject ?? null}
          intro={emailDraft?.intro ?? null}
          matchingJournalistsCount={matchingJournalistsCount}
          sendError={sendError}
          onApprove={handleApproveEmail}
          onReject={handleRejectEmail}
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

function PressReleasePreview({
  pressReleaseStatus,
  headline,
  markdown,
  industries,
  journalists,
  onApprove,
  onReject,
}: {
  pressReleaseStatus: PressReleaseStatus;
  headline: string | null;
  markdown: string | null;
  industries: Industry[];
  journalists: Doc<"journalists">[];
  onApprove: () => void;
  onReject: (feedback: string) => void;
}) {
  const [feedback, setFeedback] = React.useState("");
  const [showFeedback, setShowFeedback] = React.useState(false);

  if (pressReleaseStatus === "none") return null;

  if (pressReleaseStatus === "generating") {
    return (
      <div className="flex items-center gap-3 border-2 border-dashed border-black bg-white/50 p-5 text-sm font-medium uppercase tracking-[0.14em] text-black/60">
        <LoaderIcon className="size-4 shrink-0 animate-spin text-[#fd5200]" />
        <span>Drafting your press release — just a moment…</span>
      </div>
    );
  }

  if (pressReleaseStatus === "rejected") {
    return (
      <div className="flex items-center gap-3 border-2 border-dashed border-black bg-white/50 p-5 text-sm font-medium uppercase tracking-[0.14em] text-black/60">
        <LoaderIcon className="size-4 shrink-0 animate-spin text-[#fd5200]" />
        <span>Revising your draft based on your feedback…</span>
      </div>
    );
  }

  if (!headline || !markdown) return null;

  const isApproved = pressReleaseStatus === "approved";

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
                {journalists.filter((j) => j.industry === industry).length}{" "}
                contacts
              </Badge>
            ))
          )}
        </div>

        <div className="prose prose-sm max-w-none border-2 border-black bg-white p-5 text-black prose-headings:font-bold prose-headings:uppercase prose-headings:tracking-tight prose-h1:text-2xl prose-h1:leading-tight prose-h2:text-lg prose-p:leading-relaxed prose-blockquote:border-l-4 prose-blockquote:border-[#fd5200] prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-black/70 prose-strong:text-black">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>

        {!isApproved ? (
          <>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                onClick={onApprove}
                className="gap-2 rounded-none bg-[#fd5200] font-bold uppercase tracking-[0.16em] text-white hover:bg-[#e04a00]"
              >
                <CheckIcon className="size-4" />
                Approve press release
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
                  htmlFor="pr-reject-feedback"
                  className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/60"
                >
                  What should change?
                </label>
                <textarea
                  id="pr-reject-feedback"
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
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-black/50">
            Press release approved — your outreach email is being drafted
            below.
          </p>
        )}
      </div>
    </div>
  );
}

function EmailDraftPreview({
  emailStatus,
  subject,
  intro,
  matchingJournalistsCount,
  sendError,
  onApprove,
  onReject,
}: {
  emailStatus: EmailStatus;
  subject: string | null;
  intro: string | null;
  matchingJournalistsCount: number;
  sendError: string | null;
  onApprove: () => void;
  onReject: (feedback: string) => void;
}) {
  const [feedback, setFeedback] = React.useState("");
  const [showFeedback, setShowFeedback] = React.useState(false);

  if (emailStatus === "none") return null;

  if (emailStatus === "generating") {
    return (
      <div className="flex items-center gap-3 border-2 border-dashed border-black bg-white/50 p-5 text-sm font-medium uppercase tracking-[0.14em] text-black/60">
        <LoaderIcon className="size-4 shrink-0 animate-spin text-[#fd5200]" />
        <span>Drafting your journalist outreach email…</span>
      </div>
    );
  }

  if (emailStatus === "rejected") {
    return (
      <div className="flex items-center gap-3 border-2 border-dashed border-black bg-white/50 p-5 text-sm font-medium uppercase tracking-[0.14em] text-black/60">
        <LoaderIcon className="size-4 shrink-0 animate-spin text-[#fd5200]" />
        <span>Revising your email draft based on your feedback…</span>
      </div>
    );
  }

  if (emailStatus === "sent") {
    return (
      <div className="flex items-center gap-3 border-2 border-black bg-[#fd5200] p-5 text-sm font-bold uppercase tracking-[0.14em] text-white">
        <CircleCheckIcon className="size-4 shrink-0" />
        <span>
          Press release sent to {matchingJournalistsCount} journalist
          {matchingJournalistsCount !== 1 ? "s" : ""}.
        </span>
      </div>
    );
  }

  if (!subject || !intro) return null;

  const isSending = emailStatus === "sending" || emailStatus === "approved";
  const isApprovedView = emailStatus === "approved" || emailStatus === "sending";

  return (
    <div className="overflow-hidden border-2 border-black bg-white/60">
      <div className="flex items-center justify-between border-b-2 border-black bg-black px-5 py-3 text-white">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em]">
          <MailIcon className="size-4 text-[#fd5200]" />
          Journalist outreach email
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
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/50">
            Subject
          </span>
          <p className="border-2 border-black bg-white px-4 py-3 text-sm font-medium text-black">
            {subject}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/50">
            Personal intro
          </span>
          <p className="border-2 border-black bg-white px-4 py-3 text-sm leading-relaxed text-black">
            {intro}
          </p>
        </div>

        <div className="flex items-center gap-2 border-2 border-dashed border-black/30 bg-black/5 px-4 py-3">
          <FileTextIcon className="size-3.5 shrink-0 text-black/40" />
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/40">
            Press release appended automatically
          </span>
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
                disabled={matchingJournalistsCount === 0}
                className="gap-2 rounded-none bg-[#fd5200] font-bold uppercase tracking-[0.16em] text-white hover:bg-[#e04a00] disabled:opacity-60"
              >
                <SendIcon className="size-4" />
                Approve &amp; send to {matchingJournalistsCount} journalist
                {matchingJournalistsCount !== 1 ? "s" : ""}
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

            {matchingJournalistsCount === 0 ? (
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-black/50">
                No journalists match the selected industries — go back and
                revise the press release to select broader industries.
              </p>
            ) : null}

            {showFeedback ? (
              <div className="flex flex-col gap-3 border-2 border-dashed border-black p-4">
                <label
                  htmlFor="email-reject-feedback"
                  className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/60"
                >
                  What should change?
                </label>
                <textarea
                  id="email-reject-feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="e.g. make the intro shorter, more personal, add urgency to the CTA…"
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
                Sending to journalists…
              </Badge>
            ) : null}
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
