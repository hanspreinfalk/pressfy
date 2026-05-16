import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

type ClerkUserEvent = {
  type: "user.created" | "user.updated";
  data: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
    image_url?: string | null;
    profile_image_url?: string | null;
    primary_email_address_id?: string | null;
    email_addresses?: Array<{
      id: string;
      email_address?: string | null;
    }>;
  };
};

type ClerkDeletedUserEvent = {
  type: "user.deleted";
  data: {
    id?: string | null;
  };
};

type ClerkWebhookEvent = ClerkUserEvent | ClerkDeletedUserEvent;

http.route({
  path: "/webhook/clerk/user",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return new Response("Missing CLERK_WEBHOOK_SECRET", {
        status: 500,
      });
    }

    const payload = await req.text();
    const isValid = await verifySvixSignature(req.headers, payload, webhookSecret);
    if (!isValid) {
      return new Response("Invalid webhook signature", { status: 400 });
    }

    let event: ClerkWebhookEvent;
    try {
      event = JSON.parse(payload) as ClerkWebhookEvent;
    } catch {
      return new Response("Invalid webhook payload", { status: 400 });
    }

    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const { data } = event;
        const email = getPrimaryEmail(data);
        const name = getDisplayName(data, email);

        await ctx.runMutation(internal.users.upsert, {
          clerkId: data.id,
          name,
          email,
          profileImageUrl: data.image_url ?? data.profile_image_url ?? "",
        });

        return new Response("User synced", { status: 200 });
      }

      case "user.deleted": {
        const clerkId = event.data.id;
        if (!clerkId) {
          return new Response("Missing Clerk user id", { status: 400 });
        }

        await ctx.runMutation(internal.users.remove, { clerkId });
        return new Response("User deleted", { status: 200 });
      }

      default:
        return new Response("Webhook ignored", { status: 200 });
    }
  }),
});

function getPrimaryEmail(data: ClerkUserEvent["data"]) {
  const primaryEmail = data.email_addresses?.find(
    (email) => email.id === data.primary_email_address_id,
  )?.email_address;

  return primaryEmail ?? data.email_addresses?.[0]?.email_address ?? "";
}

function getDisplayName(data: ClerkUserEvent["data"], email: string) {
  const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ");
  return fullName || data.username || email || "Unknown user";
}

async function verifySvixSignature(
  headers: Headers,
  payload: string,
  secret: string,
) {
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return false;
  }

  const timestamp = Number(svixTimestamp);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const fiveMinutesInSeconds = 5 * 60;
  if (Math.abs(Date.now() / 1000 - timestamp) > fiveMinutesInSeconds) {
    return false;
  }

  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
  const expectedSignature = await createHmacSignature(signedContent, secret);
  const signatures = svixSignature
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1,"))
    .map((part) => part.slice(3));

  return signatures.some((signature) =>
    constantTimeEqual(signature, expectedSignature),
  );
}

async function createHmacSignature(payload: string, secret: string) {
  const secretBytes = base64ToBytes(secret.replace(/^whsec_/, ""));
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );

  return bytesToBase64(new Uint8Array(signature));
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function constantTimeEqual(a: string, b: string) {
  const maxLength = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;

  for (let i = 0; i < maxLength; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }

  return diff === 0;
}

export default http;
