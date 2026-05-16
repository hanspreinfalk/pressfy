import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type ArticleDraft = {
  headline: string;
  subheadline?: string;
  body: string;
  quote?: string;
  quotePerson?: string;
};

type Journalist = {
  _id: string;
  name: string;
  email: string;
  industry: string;
};

function buildEmailHtml(draft: ArticleDraft, journalist: Journalist): string {
  const bodyParagraphs = draft.body
    .split("\n")
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px 0;line-height:1.6;">${p}</p>`)
    .join("");

  const quoteBlock = draft.quote
    ? `<blockquote style="border-left:4px solid #fd5200;margin:24px 0;padding:12px 20px;background:#fdf7f2;">
        <p style="margin:0 0 8px 0;font-style:italic;color:#333;">&ldquo;${draft.quote}&rdquo;</p>
        ${draft.quotePerson ? `<footer style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#111;">— ${draft.quotePerson}</footer>` : ""}
      </blockquote>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:#000;padding:20px 28px;">
            <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:#fd5200;">Pressfy</span>
            <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:rgba(255,255,255,0.5);margin-left:12px;">Press Release</span>
          </td>
        </tr>
        <!-- Industry Tag -->
        <tr>
          <td style="background:#fd5200;padding:8px 28px;">
            <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:#fff;">${journalist.industry}</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background:#fff;padding:32px 28px;border:2px solid #000;border-top:none;">
            <h1 style="margin:0 0 8px 0;font-size:26px;font-weight:700;text-transform:uppercase;line-height:1.15;letter-spacing:-0.02em;">${draft.headline}</h1>
            ${draft.subheadline ? `<p style="margin:0 0 24px 0;font-size:14px;color:#555;line-height:1.5;">${draft.subheadline}</p>` : ""}
            <hr style="border:none;border-top:2px solid #000;margin:20px 0;" />
            <div style="font-size:15px;color:#222;">
              ${bodyParagraphs}
            </div>
            ${quoteBlock}
            <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
            <p style="margin:0;font-size:12px;color:#888;">
              Hi ${journalist.name}, this press release was sent to you because you cover the ${journalist.industry} beat.
              Sent via <strong>Pressfy</strong>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    articleDraft: ArticleDraft;
    journalists: Journalist[];
  };

  const { articleDraft, journalists } = body;

  if (!articleDraft?.headline || !articleDraft?.body) {
    return NextResponse.json({ error: "Missing article content" }, { status: 400 });
  }

  if (!journalists?.length) {
    return NextResponse.json({ error: "No journalists to send to" }, { status: 400 });
  }

  const results = await Promise.allSettled(
    journalists.map((journalist) =>
      resend.emails.send({
        from: "onboarding@resend.dev",
        to: journalist.email,
        subject: articleDraft.headline,
        html: buildEmailHtml(articleDraft, journalist),
      })
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ success: true, sent, failed });
}
