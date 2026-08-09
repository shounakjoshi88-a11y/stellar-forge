import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL!;

export default defineConfig({
  schema: "prisma/schema.prisma",
  earlyAccess: true,
  migrate: {
    adapter: async () => {
      const { PrismaPg } = await import("@prisma/adapter-pg");
      const { Pool } = await import("pg");
      return new PrismaPg(new Pool({ connectionString }));
    },
  },
  client: {
    adapter: new PrismaPg(new Pool({ connectionString })),
  },
  datasource: {
    url: connectionString,
  },
});
