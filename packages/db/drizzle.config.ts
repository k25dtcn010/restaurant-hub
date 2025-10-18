import dotenv from "dotenv"
import { defineConfig } from "drizzle-kit"

dotenv.config({
  path: "../../apps/server/.env",
})

export default defineConfig({
  schema: "./src/schema/**/*.ts",
  out: "./src/migrations",
  dialect: "turso",
  dbCredentials: {
    url: process.env.DATABASE_URL || "file:./local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  },
  verbose: true,
  strict: true,
})
