import { createClient } from "@supabase/supabase-js";
import { SEED_DATA } from "../data/seed.ts";
import type { Database } from "../lib/db.ts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set before seeding",
  );
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const shouldReset = process.argv.includes("--reset");

async function resetSeedRows() {
  const { error } = await supabase.rpc("reset_seed_data", {
    seed_school_ids: SEED_DATA.schools.map((school) => school.id as string),
    seed_issue_ids: SEED_DATA.issues.map((issue) => issue.id as string),
    seed_report_ids: SEED_DATA.reports.map((report) => report.id as string),
    seed_status_event_ids: SEED_DATA.status_events.map((statusEvent) => statusEvent.id as string),
  });

  if (error) {
    throw new Error(`Could not reset seed data: ${error.message}`);
  }

  console.log("Removed existing seed rows.");
}

async function insertRows(
  table: "schools" | "issues" | "reports" | "status_events",
  rows: Database["public"]["Tables"][typeof table]["Insert"][],
) {
  const { error } = await supabase.from(table).insert(rows);

  if (error) {
    throw new Error(`Could not seed ${table}: ${error.message}`);
  }

  console.log(`Inserted ${rows.length} ${table} rows.`);
}

async function seed() {
  if (shouldReset) {
    await resetSeedRows();
  }

  await insertRows("schools", SEED_DATA.schools);
  await insertRows("issues", SEED_DATA.issues);
  await insertRows("reports", SEED_DATA.reports);
  await insertRows("status_events", SEED_DATA.status_events);
  console.log("Seed complete.");
}

seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
