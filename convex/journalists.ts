import { query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("journalists").take(1000);
  },
});

export const getUniqueIndustries = query({
  args: {},
  handler: async (ctx) => {
    const journalists = await ctx.db.query("journalists").take(1000);
    return [...new Set(journalists.map((j) => j.industry))];
  },
});
