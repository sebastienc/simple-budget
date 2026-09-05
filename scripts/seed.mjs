#!/usr/bin/env node
/**
 * Fills a running app with demo data so there is something to look at.
 *
 * Goes through the HTTP API rather than writing SQLite directly, so seeded
 * rows pass exactly the same validation as anything typed into the UI, and
 * this script needs no knowledge of the schema.
 *
 *   npm run dev:demo     # in one terminal — app against a throwaway database
 *   npm run seed         # in another
 *
 * Refuses to run against a database that already holds accounts, so it cannot
 * quietly scatter fake bills through real finances. --force overrides.
 */

const API = process.env.SIMPLE_BUDGET_API || 'http://127.0.0.1:5680/api';
const force = process.argv.includes('--force');

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const today = new Date();
/** An ISO date `months` from today, clamped to a day that exists in that month. */
const monthsOut = (months, day) => {
  const d = new Date(today.getFullYear(), today.getMonth() + months, 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return iso(d);
};
const monthsAgo = (months, day) => monthsOut(-months, day);
const daysAgo = (days) => {
  const d = new Date(today);
  d.setDate(d.getDate() - days);
  return iso(d);
};

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

async function waitForApp(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await api('GET', '/accounts');
    } catch {
      if (Date.now() > deadline) {
        throw new Error(`No app answering at ${API}. Start it with: npm run dev:demo`);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

/*
 * Opens the account six months back and corrects it a few days ago — which is
 * how the app is meant to be used, and the only ordering the API accepts: a
 * correction may not predate the starting balance.
 *
 * The corrected figure is derived from what the app itself projects for that
 * day, nudged by `driftCents`. Hand-picking a "current balance" instead makes
 * it contradict the recurring items, and the accuracy feature then reports a
 * drift of thousands a month — technically correct, and useless as demo data.
 */
async function createAccount(name, openedCents, items, driftCents) {
  const account = await api('POST', '/accounts', { name });
  await api('PATCH', `/accounts/${account.id}`, { startingBalanceCents: openedCents, startingBalanceDate: monthsAgo(6, 1) });
  for (const item of items) {
    await api('POST', `/accounts/${account.id}/recurring-items`, item);
  }

  const correctedOn = daysAgo(3);
  const [projected] = await api('GET', `/accounts/${account.id}/projection?from=${correctedOn}&to=${correctedOn}`);
  await api('POST', `/accounts/${account.id}/checkpoints`, { date: correctedOn, balanceCents: projected.balanceCents - driftCents });

  console.log(`  ${name}: ${items.length} recurring items, 1 balance correction`);
  return account;
}

const chequing = [
  { name: 'Pay', amountCents: 284750, frequency: 'semimonthly', interval: 1, startDate: monthsAgo(6, 1), semiMonthlyDay1: 15, semiMonthlyDay2: 30 },
  { name: 'Transfer to Joint', amountCents: -260000, frequency: 'monthly', interval: 1, startDate: monthsAgo(6, 20) },
  { name: 'Groceries', amountCents: -18500, frequency: 'weekly', interval: 1, startDate: monthsAgo(6, 6) },
  { name: 'Hydro', amountCents: -11840, frequency: 'monthly', interval: 1, startDate: monthsAgo(6, 8) },
  { name: 'Internet', amountCents: -8995, frequency: 'monthly', interval: 1, startDate: monthsAgo(6, 3) },
  { name: 'Phone', amountCents: -6200, frequency: 'monthly', interval: 1, startDate: monthsAgo(6, 12) },
  { name: 'Credit card', amountCents: -120000, frequency: 'monthly', interval: 1, startDate: monthsAgo(6, 2) },
  { name: 'Savings transfer', amountCents: -60000, frequency: 'monthly', interval: 1, startDate: monthsAgo(6, 21) },
  // a yearly bill that has been running a while — its set-aside is already on track
  { name: 'Car insurance', amountCents: -84000, frequency: 'yearly', interval: 1, startDate: monthsAgo(11, 22), sinkingFund: true },
];

const joint = [
  { name: 'Mortgage', amountCents: -124000, frequency: 'semimonthly', interval: 1, startDate: monthsAgo(6, 1), semiMonthlyDay1: 15, semiMonthlyDay2: 30 },
  { name: 'Transfer from Chequing', amountCents: 260000, frequency: 'monthly', interval: 1, startDate: monthsAgo(6, 20) },
  { name: 'Home insurance', amountCents: -115000, frequency: 'yearly', interval: 1, startDate: monthsAgo(8, 5), sinkingFund: true },
  // the two bills the sinking-fund feature exists for: both land ~3 months out,
  // nothing set aside yet, and together they push the account under
  { name: 'School tax', amountCents: -120000, frequency: 'yearly', interval: 1, startDate: monthsOut(3, 1), sinkingFund: true },
  { name: 'Municipal tax', amountCents: -240000, frequency: 'yearly', interval: 1, startDate: monthsOut(3, 1), sinkingFund: true },
  // start === end is how the UI records a one-time payment
  { name: 'Roof repair', amountCents: -120000, frequency: 'daily', interval: 1, startDate: monthsOut(1, 12), endDate: monthsOut(1, 12) },
];

const run = async () => {
  console.log(`Seeding ${API}`);
  const existing = await waitForApp();

  if (existing.length > 0 && !force) {
    console.error(`\nRefusing to seed: ${existing.length} account(s) already exist (${existing.map((a) => a.name).join(', ')}).`);
    console.error('This looks like a real database. Use a throwaway one:\n');
    console.error('    npm run dev:demo\n');
    console.error('or re-run with --force if you really mean it.');
    process.exit(1);
  }

  // Small, believable drift: the forecast ran a little low on one and a little
  // high on the other, which is what a real reconciliation looks like.
  await createAccount('Chequing', 250000, chequing, -18000);
  await createAccount('Joint', 280000, joint, 12000);

  console.log('\nDone. Chequing stays healthy; Joint takes a one-time hit in a month and then goes under when the two tax bills land.');
};

run().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
