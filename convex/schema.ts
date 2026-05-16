import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
    industry: v.union(
      v.literal("Health"), 
      v.literal("Consumer Product")
    ),
  }).index("by_email", ["email"])
  .index("by_industry", ["industry"]),
});
