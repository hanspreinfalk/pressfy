import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type Industry = "Health" | "Consumer Product";

type Journalist = {
  _id: string;
  name: string;
  email: string;
  industry: Industry;
};

type Payload = {
  headline: string;
  markdown: string;
  industries: Industry[];
  journalists: Journalist[];
};

function renderMarkdownToHtml(markdown: string): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const lines = markdown.split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(" ");
    const inline = text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
    blocks.push(
      `<p style="margin:0 0 16px 0;line-height:1.6;font-size:15px;color:#222;">${inline}</p>`,
    );
    paragraph = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    const headingMatch = /^(#{1,4})\s+(.*)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      const sizes = [26, 22, 18, 16];
      blocks.push(
        `<h${level} style="margin:24px 0 10px 0;font-size:${sizes[level - 1]}px;font-weight:700;line-height:1.2;text-transform:${level === 1 ? "uppercase" : "none"};letter-spacing:${level === 1 ? "-0.01em" : "normal"};color:#111;">${escape(headingMatch[2])}</h${level}>`,
      );
      continue;
    }
    if (/^>\s+/.test(line)) {
      flushParagraph();
      blocks.push(
        `<blockquote style="border-left:4px solid #fd5200;margin:16px 0;padding:8px 16px;background:#fdf7f2;font-style:italic;color:#333;">${escape(line.replace(/^>\s+/, ""))}</blockquote>`,
      );
      continue;
    }
    paragraph.push(escape(line));
  }
  flushParagraph();

  return blocks.join("\n");
}

function buildEmailHtml(
  headline: string,
  markdown: string,
  journalist: Journalist,
): string {
  const body = renderMarkdownToHtml(markdown);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:#000;padding:20px 28px;">
            <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:#fd5200;">Pressfy</span>
            <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:rgba(255,255,255,0.5);margin-left:12px;">Press Release</span>
          </td>
        </tr>
        <tr>
          <td style="background:#fd5200;padding:8px 28px;">
            <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:#fff;">${journalist.industry}</span>
          </td>
        </tr>
        <tr>
          <td style="background:#fff;padding:32px 28px;border:2px solid #000;border-top:none;">
            <h1 style="margin:0 0 16px 0;font-size:26px;font-weight:700;text-transform:uppercase;line-height:1.15;letter-spacing:-0.02em;">${headline}</h1>
            <hr style="border:none;border-top:2px solid #000;margin:16px 0;" />
            ${body}
            <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
            <p style="margin:0;font-size:12px;color:#888;">
              Hi ${journalist.name}, this press release was sent to you because you cover the ${journalist.industry} beat.
              The full article is attached as a Markdown document. Sent via <strong>Pressfy</strong>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "press-release";
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Payload;
  const { headline, markdown, industries, journalists } = body;

  if (!headline || !markdown) {
    return NextResponse.json(
      { error: "Missing article content" },
      { status: 400 },
    );
  }

  const targetIndustries = new Set(industries ?? []);
  const recipients = (journalists ?? []).filter((j) =>
    targetIndustries.has(j.industry),
  );

  if (recipients.length === 0) {
    return NextResponse.json(
      {
        error:
          industries.length === 0
            ? "No industries selected — nothing to send."
            : "No journalists match the selected industries.",
      },
      { status: 400 },
    );
  }

  const attachmentContent = Buffer.from(
    `# ${headline}\n\n${markdown}\n`,
    "utf-8",
  ).toString("base64");
  const filename = `${slugify(headline)}.md`;

  const results = await Promise.allSettled(
    recipients.map((journalist) =>
      resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
        to: journalist.email,
        subject: headline,
        html: buildEmailHtml(headline, markdown, journalist),
        attachments: [
          {
            filename,
            content: attachmentContent,
          },
        ],
      }),
    ),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({
    success: true,
    sent,
    failed,
    recipientCount: recipients.length,
  });
}
