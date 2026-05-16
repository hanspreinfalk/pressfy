import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const userFields = {
  clerkId: v.string(),
  name: v.string(),
  email: v.string(),
  profileImageUrl: v.string(),
};

export const upsert = internalMutation({
  args: userFields,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        profileImageUrl: args.profileImageUrl,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", args);
  },
});

export const remove = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) return null;

    await ctx.db.delete(user._id);
    return user._id;
  },
});
