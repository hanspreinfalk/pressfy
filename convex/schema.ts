import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const industryValidator = v.union(
  v.literal("Health"),
  v.literal("Consumer Product"),
);

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    profileImageUrl: v.string(),
  }).index("by_clerkId", ["clerkId"]),
  journalists: defineTable({
    name: v.string(),
    email: v.string(),
    industry: industryValidator,
  })
    .index("by_email", ["email"])
    .index("by_industry", ["industry"]),
  articles: defineTable({
    userId: v.id("users"),
    approved: v.boolean(),
    markdown: v.string(),
    headline: v.string(),
    industries: v.array(industryValidator),
    sentAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),
});
