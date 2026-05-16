import { v } from "convex/values";
import {
  mutation,
  query,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import { industryValidator } from "./schema";
import type { Doc, Id } from "./_generated/dataModel";

async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user) {
    throw new Error("User not synced yet — please wait a moment and retry.");
  }
  return user;
}

export const create = mutation({
  args: {
    markdown: v.string(),
    headline: v.string(),
    industries: v.array(industryValidator),
  },
  handler: async (ctx, args): Promise<Id<"articles">> => {
    const user = await requireUser(ctx);
    return await ctx.db.insert("articles", {
      userId: user._id,
      approved: false,
      markdown: args.markdown,
      headline: args.headline,
      industries: args.industries,
    });
  },
});

export const getById = query({
  args: { id: v.id("articles") },
  handler: async (ctx, args): Promise<Doc<"articles"> | null> => {
    const user = await requireUser(ctx);
    const article = await ctx.db.get(args.id);
    if (!article) return null;
    if (article.userId !== user._id) return null;
    return article;
  },
});

export const approve = mutation({
  args: { id: v.id("articles") },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const article = await ctx.db.get(args.id);
    if (!article) throw new Error("Article not found");
    if (article.userId !== user._id) throw new Error("Not allowed");
    await ctx.db.patch(args.id, { approved: true });
    return null;
  },
});

export const markSent = mutation({
  args: { id: v.id("articles") },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const article = await ctx.db.get(args.id);
    if (!article) throw new Error("Article not found");
    if (article.userId !== user._id) throw new Error("Not allowed");
    await ctx.db.patch(args.id, { sentAt: Date.now() });
    return null;
  },
});

export const listForUser = query({
  args: {},
  handler: async (ctx): Promise<Doc<"articles">[]> => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("articles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);
  },
});

export const getJournalistsForIndustries = query({
  args: { industries: v.array(industryValidator) },
  handler: async (ctx, args): Promise<Doc<"journalists">[]> => {
    await requireUser(ctx);
    if (args.industries.length === 0) return [];
    const results: Doc<"journalists">[] = [];
    for (const industry of args.industries) {
      const matched = await ctx.db
        .query("journalists")
        .withIndex("by_industry", (q) => q.eq("industry", industry))
        .take(1000);
      results.push(...matched);
    }
    const seen = new Set<string>();
    return results.filter((j) => {
      if (seen.has(j._id)) return false;
      seen.add(j._id);
      return true;
    });
  },
});
