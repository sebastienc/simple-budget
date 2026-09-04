import express, { Router } from 'express';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, unlink } from 'fs/promises';
import SqliteDatabase from 'better-sqlite3';
import { accountsQueries, recurringItemsQueries } from '../db/queries';
import { toAccountJson, toRecurringItemJson } from './mappers';
import { projectBalance, type Frequency, type RecurringItemInput } from '../projection';
import { backupDbTo, replaceDbWith } from '../db';

export const apiRouter = Router();

const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly', 'yearly', 'semimonthly'];

function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  return !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function isValidDayOfMonth(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 31;
}

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

apiRouter.get('/accounts', async (_req, res) => {
  res.json((await accountsQueries.list()).map(toAccountJson));
});

apiRouter.post('/accounts', async (req, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  res.status(201).json(toAccountJson(await accountsQueries.create({ name })));
});

apiRouter.patch('/accounts/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: 'account not found' });
    return;
  }
  const account = await accountsQueries.get(id);
  if (!account) {
    res.status(404).json({ error: 'account not found' });
    return;
  }

  const { name, startingBalanceCents, startingBalanceDate } = req.body ?? {};
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    res.status(400).json({ error: 'name must be a non-empty string' });
    return;
  }
  if (startingBalanceCents !== undefined && typeof startingBalanceCents !== 'number') {
    res.status(400).json({ error: 'startingBalanceCents must be a number' });
    return;
  }
  if (startingBalanceDate !== undefined && startingBalanceDate !== null && !isValidDateString(startingBalanceDate)) {
    res.status(400).json({ error: 'startingBalanceDate must be YYYY-MM-DD' });
    return;
  }

  res.json(toAccountJson(await accountsQueries.update(id, { name, startingBalanceCents, startingBalanceDate })));
});

apiRouter.delete('/accounts/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const account = id === null ? undefined : await accountsQueries.get(id);
  if (!account) {
    res.status(404).json({ error: 'account not found' });
    return;
  }
  await accountsQueries.delete(id as number);
  res.status(204).send();
});

apiRouter.get('/accounts/:id/recurring-items', async (req, res) => {
  const id = parseId(req.params.id);
  const account = id === null ? undefined : await accountsQueries.get(id);
  if (!account) {
    res.status(404).json({ error: 'account not found' });
    return;
  }
  res.json((await recurringItemsQueries.list(id as number)).map(toRecurringItemJson));
});

apiRouter.post('/accounts/:id/recurring-items', async (req, res) => {
  const id = parseId(req.params.id);
  const account = id === null ? undefined : await accountsQueries.get(id);
  if (!account) {
    res.status(404).json({ error: 'account not found' });
    return;
  }

  const { name, amountCents, frequency, interval, startDate, endDate, semiMonthlyDay1, semiMonthlyDay2 } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (typeof amountCents !== 'number') {
    res.status(400).json({ error: 'amountCents must be a number' });
    return;
  }
  if (!FREQUENCIES.includes(frequency)) {
    res.status(400).json({ error: `frequency must be one of ${FREQUENCIES.join(', ')}` });
    return;
  }
  if (!Number.isInteger(interval) || interval < 1) {
    res.status(400).json({ error: 'interval must be a positive integer' });
    return;
  }
  if (!isValidDateString(startDate)) {
    res.status(400).json({ error: 'startDate must be YYYY-MM-DD' });
    return;
  }
  if (endDate !== undefined && endDate !== null && !isValidDateString(endDate)) {
    res.status(400).json({ error: 'endDate must be YYYY-MM-DD' });
    return;
  }
  if (frequency === 'semimonthly' && (!isValidDayOfMonth(semiMonthlyDay1) || !isValidDayOfMonth(semiMonthlyDay2))) {
    res.status(400).json({ error: 'semiMonthlyDay1 and semiMonthlyDay2 are required (1-31) for semimonthly frequency' });
    return;
  }

  res.status(201).json(
    toRecurringItemJson(
      await recurringItemsQueries.create({
        accountId: id as number,
        name,
        amountCents,
        frequency,
        interval,
        startDate,
        endDate,
        semiMonthlyDay1,
        semiMonthlyDay2,
      }),
    ),
  );
});

apiRouter.patch('/recurring-items/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const item = id === null ? undefined : await recurringItemsQueries.get(id);
  if (!item) {
    res.status(404).json({ error: 'recurring item not found' });
    return;
  }

  const { name, amountCents, frequency, interval, startDate, endDate, semiMonthlyDay1, semiMonthlyDay2 } = req.body ?? {};
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    res.status(400).json({ error: 'name must be a non-empty string' });
    return;
  }
  if (amountCents !== undefined && typeof amountCents !== 'number') {
    res.status(400).json({ error: 'amountCents must be a number' });
    return;
  }
  if (frequency !== undefined && !FREQUENCIES.includes(frequency)) {
    res.status(400).json({ error: `frequency must be one of ${FREQUENCIES.join(', ')}` });
    return;
  }
  if (interval !== undefined && (!Number.isInteger(interval) || interval < 1)) {
    res.status(400).json({ error: 'interval must be a positive integer' });
    return;
  }
  if (startDate !== undefined && !isValidDateString(startDate)) {
    res.status(400).json({ error: 'startDate must be YYYY-MM-DD' });
    return;
  }
  if (endDate !== undefined && endDate !== null && !isValidDateString(endDate)) {
    res.status(400).json({ error: 'endDate must be YYYY-MM-DD' });
    return;
  }
  if (semiMonthlyDay1 !== undefined && semiMonthlyDay1 !== null && !isValidDayOfMonth(semiMonthlyDay1)) {
    res.status(400).json({ error: 'semiMonthlyDay1 must be an integer from 1 to 31' });
    return;
  }
  if (semiMonthlyDay2 !== undefined && semiMonthlyDay2 !== null && !isValidDayOfMonth(semiMonthlyDay2)) {
    res.status(400).json({ error: 'semiMonthlyDay2 must be an integer from 1 to 31' });
    return;
  }
  if (frequency === 'semimonthly' && (!isValidDayOfMonth(semiMonthlyDay1) || !isValidDayOfMonth(semiMonthlyDay2))) {
    res.status(400).json({ error: 'semiMonthlyDay1 and semiMonthlyDay2 are required (1-31) for semimonthly frequency' });
    return;
  }

  res.json(
    toRecurringItemJson(
      await recurringItemsQueries.update(id as number, {
        name,
        amountCents,
        frequency,
        interval,
        startDate,
        endDate,
        semiMonthlyDay1,
        semiMonthlyDay2,
      }),
    ),
  );
});

apiRouter.delete('/recurring-items/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const item = id === null ? undefined : await recurringItemsQueries.get(id);
  if (!item) {
    res.status(404).json({ error: 'recurring item not found' });
    return;
  }
  await recurringItemsQueries.delete(id as number);
  res.status(204).send();
});

apiRouter.get('/accounts/:id/projection', async (req, res) => {
  const id = parseId(req.params.id);
  const account = id === null ? undefined : await accountsQueries.get(id);
  if (!account) {
    res.status(404).json({ error: 'account not found' });
    return;
  }

  const { from, to } = req.query;
  if (!isValidDateString(from) || !isValidDateString(to)) {
    res.status(400).json({ error: 'from and to must be YYYY-MM-DD' });
    return;
  }
  if (to < from) {
    res.status(400).json({ error: 'to must not be before from' });
    return;
  }
  if (!account.starting_balance_date) {
    res.status(422).json({ error: 'starting_balance_not_set' });
    return;
  }

  const items: RecurringItemInput[] = (await recurringItemsQueries.list(id as number)).map((row) => ({
    id: row.id,
    name: row.name,
    amountCents: row.amount_cents,
    frequency: row.frequency as Frequency,
    interval: row.interval,
    startDate: row.start_date,
    endDate: row.end_date,
    semiMonthlyDay1: row.semi_monthly_day1,
    semiMonthlyDay2: row.semi_monthly_day2,
  }));

  res.json(
    projectBalance({
      startingBalanceCents: account.starting_balance_cents,
      startingBalanceDate: account.starting_balance_date,
      items,
      from,
      to,
    }),
  );
});

const SQLITE_HEADER = 'SQLite format 3\0';

apiRouter.get('/backup/export', async (_req, res) => {
  const tempPath = join(tmpdir(), `simple-budget-export-${Date.now()}.db`);
  try {
    await backupDbTo(tempPath);
    const today = new Date().toISOString().slice(0, 10);
    res.download(tempPath, `simple-budget-backup-${today}.db`, (err) => {
      unlink(tempPath).catch(() => {});
      if (err) {
        console.error('Backup export download failed', err);
      }
    });
  } catch (error) {
    console.error('Backup export failed', error);
    res.status(500).json({ error: 'export_failed' });
  }
});

apiRouter.post('/backup/import', express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length < 16 || req.body.subarray(0, 16).toString('utf8') !== SQLITE_HEADER) {
    res.status(400).json({ error: 'invalid_backup_file' });
    return;
  }

  const tempPath = join(tmpdir(), `simple-budget-import-${Date.now()}.db`);
  await writeFile(tempPath, req.body);

  try {
    const check = new SqliteDatabase(tempPath, { readonly: true });
    const tables = check
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('accounts', 'recurring_items')")
      .all() as { name: string }[];
    check.close();

    if (tables.length !== 2) {
      await unlink(tempPath).catch(() => {});
      res.status(400).json({ error: 'invalid_backup_file' });
      return;
    }

    await replaceDbWith(tempPath);
    await unlink(tempPath).catch(() => {});
    res.json({ ok: true });
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    console.error('Backup import failed', error);
    res.status(400).json({ error: 'invalid_backup_file' });
  }
});
