import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("public estimate approval route is registered", async () => {
  const app = await read("../src/App.jsx");
  assert.match(app, /path=["']\/estimate\/:token["']/);
  assert.match(app, /PublicEstimatePage/);
});

test("customer scheduling requires a signed agreement", async () => {
  const migration = await read(
    "../supabase/migrations/007_customer_approval_scheduling.sql",
  );
  assert.match(migration, /c\.signed_at is null then raise exception/i);
  assert.match(migration, /where c\.sign_token = p_token and c\.signed_at is not null/i);
});

test("online scheduling blocks Sundays in both storage and booking", async () => {
  const migration = await read(
    "../supabase/migrations/007_customer_approval_scheduling.sql",
  );
  assert.match(migration, /schedule_slots_no_sunday/i);
  assert.match(migration, /extract\(dow from s\.slot_date\) = 0/i);
  assert.match(
    migration,
    /Sunday appointments require direct approval from Valid Tree Service\./,
  );
});

test("contract explains stump-grinding chip removal is an extra service", async () => {
  const terms = await read("../src/lib/contractTerms.js");
  assert.match(terms, /Stump grindings, wood chips/i);
  assert.match(terms, /remain on the property/i);
  assert.match(terms, /additional charge/i);
});

test("office users can safely delete an estimate while preserving its contract", async () => {
  const estimates = await read("../src/pages/EstimatesPage.jsx");
  assert.match(estimates, /removeAndWait\('estimates', estimate\.id\)/);
  assert.match(estimates, /window\.confirm/);
  assert.match(estimates, /contract will be preserved/i);
  assert.match(estimates, /'Delete'/);
});

test("office users can edit an unsigned sent contract without replacing its signing link", async () => {
  const contracts = await read("../src/pages/ContractsPage.jsx");
  assert.match(contracts, /!contract\.signature_data && !contract\.signed_at/);
  assert.match(contracts, /\['draft', 'sent'\]\.includes\(contract\.status\)/);
  assert.match(contracts, /updateAndWait\('contracts', editing\.id/);
  assert.match(contracts, /The existing signing link will stay the same/);
  assert.match(contracts, />Edit contract</);
});
