import express, { Router } from 'express';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, unlink } from 'fs/promises';
import SqliteDatabase from 'better-sqlite3';
import type { Selectable } from 'kysely';
import type { RecurringItemsTable } from '../db/schema';
import { accountsQueries, recurringItemsQueries, balanceCheckpointsQueries, wipeAllData } from '../db/queries';
import { toAccountJson, toRecurringItemJson, toRecurringItemInput, toBalanceCheckpointJson } from './mappers';
import {
  projectBalance,
  sumProjections,
  mergeCheckpoints,
  computeSinkingFundContribution,
  computeCorrectionAccuracy,
  type Frequency,
} from '../projection';
import { backupBeforeDestructiveChange, backupDbTo, replaceDbWith } from '../db';
import { readBackupSettings, writeBackupSettings } from '../backup/settings';
import { detectSyncedFolders, isWritableDirectory } from '../backup/folders';
import { listSnapshots, resolveSnapshotPath } from '../backup/snapshots';
import { snapshotNow } from '../backup/schedule';

export const apiRouter = Router();

const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly', 'yearly', 'semimonthly'];
const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP'];

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

function withSinkingFundContribution(row: Selectable<RecurringItemsTable>, todayIso: string) {
  const json = toRecurringItemJson(row);
  const contribution = json.sinkingFund
    ? computeSinkingFundContribution(toRecurringItemInput(row), todayIso)
    : { nextOccurrenceDate: null, suggestedMonthlySetAsideCents: null };
  return { ...json, ...contribution };
}

apiRouter.get('/accounts', async (_req, res) => {
  res.json((await accountsQueries.list()).map(toAccountJson));
});

apiRouter.post('/accounts', async (req, res) => {
  const { name, currency } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (!CURRENCIES.includes(currency)) {
    res.status(400).json({ error: `currency must be one of ${CURRENCIES.join(', ')}` });
    return;
  }
  res.status(201).json(toAccountJson(await accountsQueries.create({ name, currency })));
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

  const { name, currency, startingBalanceCents, startingBalanceDate } = req.body ?? {};
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    res.status(400).json({ error: 'name must be a non-empty string' });
    return;
  }
  if (currency !== undefined && !CURRENCIES.includes(currency)) {
    res.status(400).json({ error: `currency must be one of ${CURRENCIES.join(', ')}` });
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

  res.json(toAccountJson(await accountsQueries.update(id, { name, currency, startingBalanceCents, startingBalanceDate })));
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
  const todayIso = new Date().toISOString().slice(0, 10);
  res.json((await recurringItemsQueries.list(id as number)).map((row) => withSinkingFundContribution(row, todayIso)));
});

apiRouter.post('/accounts/:id/recurring-items', async (req, res) => {
  const id = parseId(req.params.id);
  const account = id === null ? undefined : await accountsQueries.get(id);
  if (!account) {
    res.status(404).json({ error: 'account not found' });
    return;
  }

  const { name, amountCents, frequency, interval, startDate, endDate, semiMonthlyDay1, semiMonthlyDay2, sinkingFund } =
    req.body ?? {};
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
  if (sinkingFund !== undefined && typeof sinkingFund !== 'boolean') {
    res.status(400).json({ error: 'sinkingFund must be a boolean' });
    return;
  }

  const created = await recurringItemsQueries.create({
    accountId: id as number,
    name,
    amountCents,
    frequency,
    interval,
    startDate,
    endDate,
    semiMonthlyDay1,
    semiMonthlyDay2,
    sinkingFund,
  });
  res.status(201).json(withSinkingFundContribution(created, new Date().toISOString().slice(0, 10)));
});

apiRouter.patch('/recurring-items/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const item = id === null ? undefined : await recurringItemsQueries.get(id);
  if (!item) {
    res.status(404).json({ error: 'recurring item not found' });
    return;
  }

  const { name, amountCents, frequency, interval, startDate, endDate, semiMonthlyDay1, semiMonthlyDay2, sinkingFund } =
    req.body ?? {};
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
  if (sinkingFund !== undefined && typeof sinkingFund !== 'boolean') {
    res.status(400).json({ error: 'sinkingFund must be a boolean' });
    return;
  }

  const updated = await recurringItemsQueries.update(id as number, {
    name,
    amountCents,
    frequency,
    interval,
    startDate,
    endDate,
    semiMonthlyDay1,
    semiMonthlyDay2,
    sinkingFund,
  });
  res.json(withSinkingFundContribution(updated, new Date().toISOString().slice(0, 10)));
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

apiRouter.get('/accounts/:id/checkpoints', async (req, res) => {
  const id = parseId(req.params.id);
  const account = id === null ? undefined : await accountsQueries.get(id);
  if (!account) {
    res.status(404).json({ error: 'account not found' });
    return;
  }
  const rows = await balanceCheckpointsQueries.list(id as number);

  // How far the forecast had drifted by the time each correction was recorded.
  // The starting balance takes part as the origin, so the first explicit
  // correction is measured against it rather than being left unmeasured.
  const accuracy = account.starting_balance_date
    ? computeCorrectionAccuracy(
        mergeCheckpoints(
          { date: account.starting_balance_date, balanceCents: account.starting_balance_cents },
          rows.map((row) => ({ date: row.date, balanceCents: row.balance_cents })),
        ),
        (await recurringItemsQueries.list(id as number)).map(toRecurringItemInput),
      )
    : [];
  const byDate = new Map(accuracy.map((entry) => [entry.date, entry]));

  res.json(
    rows.map((row) => {
      const entry = byDate.get(row.date);
      return {
        ...toBalanceCheckpointJson(row),
        projectedCents: entry?.projectedCents ?? null,
        driftCents: entry?.driftCents ?? null,
        daysSincePrevious: entry?.daysSincePrevious ?? null,
      };
    }),
  );
});

apiRouter.post('/accounts/:id/checkpoints', async (req, res) => {
  const id = parseId(req.params.id);
  const account = id === null ? undefined : await accountsQueries.get(id);
  if (!account) {
    res.status(404).json({ error: 'account not found' });
    return;
  }

  const { date, balanceCents } = req.body ?? {};
  if (!isValidDateString(date)) {
    res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    return;
  }
  if (typeof balanceCents !== 'number') {
    res.status(400).json({ error: 'balanceCents must be a number' });
    return;
  }
  if (!account.starting_balance_date || date < account.starting_balance_date) {
    res.status(400).json({ error: 'date must be on or after the account starting balance date' });
    return;
  }

  res.json(toBalanceCheckpointJson(await balanceCheckpointsQueries.upsert(id as number, date, balanceCents)));
});

apiRouter.delete('/checkpoints/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const checkpoint = id === null ? undefined : await balanceCheckpointsQueries.get(id);
  if (!checkpoint) {
    res.status(404).json({ error: 'checkpoint not found' });
    return;
  }
  await balanceCheckpointsQueries.delete(id as number);
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

  const items = (await recurringItemsQueries.list(id as number)).map(toRecurringItemInput);

  const explicitCheckpoints = (await balanceCheckpointsQueries.list(id as number)).map((row) => ({
    date: row.date,
    balanceCents: row.balance_cents,
  }));
  const checkpoints = mergeCheckpoints(
    { date: account.starting_balance_date, balanceCents: account.starting_balance_cents },
    explicitCheckpoints,
  );

  res.json(projectBalance({ checkpoints, items, from, to }));
});

apiRouter.get('/net-worth', async (req, res) => {
  const { from, to } = req.query;
  if (!isValidDateString(from) || !isValidDateString(to)) {
    res.status(400).json({ error: 'from and to must be YYYY-MM-DD' });
    return;
  }
  if (to < from) {
    res.status(400).json({ error: 'to must not be before from' });
    return;
  }

  const allAccounts = await accountsQueries.list();
  const included = allAccounts.filter((account) => account.starting_balance_date);
  const excludedAccountIds = allAccounts.filter((account) => !account.starting_balance_date).map((account) => account.id);

  if (included.length === 0) {
    res.json({ groups: [], excludedAccountIds });
    return;
  }

  const effectiveFrom = included.reduce(
    (max, account) => (account.starting_balance_date! > max ? account.starting_balance_date! : max),
    from,
  );

  if (effectiveFrom > to) {
    res.json({
      groups: groupByCurrency(included).map((accounts) => ({
        currency: accounts[0].currency,
        includedAccountIds: accounts.map((account) => account.id),
        days: [],
      })),
      excludedAccountIds,
    });
    return;
  }

  const withSeries = await Promise.all(
    included.map(async (account) => {
      const items = (await recurringItemsQueries.list(account.id)).map(toRecurringItemInput);
      const explicitCheckpoints = (await balanceCheckpointsQueries.list(account.id)).map((row) => ({
        date: row.date,
        balanceCents: row.balance_cents,
      }));
      const checkpoints = mergeCheckpoints(
        { date: account.starting_balance_date!, balanceCents: account.starting_balance_cents },
        explicitCheckpoints,
      );
      return { currency: account.currency, accountId: account.id, series: projectBalance({ checkpoints, items, from: effectiveFrom, to }) };
    }),
  );

  res.json({
    groups: groupByCurrency(withSeries).map((entries) => ({
      currency: entries[0].currency,
      includedAccountIds: entries.map((entry) => entry.accountId),
      days: sumProjections(entries.map((entry) => entry.series)),
    })),
    excludedAccountIds,
  });
});

/** Buckets items sharing a `currency` field together, in first-seen order. */
function groupByCurrency<T extends { currency: string }>(items: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(item.currency);
    if (group) {
      group.push(item);
    } else {
      groups.set(item.currency, [item]);
    }
  }
  return [...groups.values()];
}

apiRouter.post('/wipe', async (_req, res) => {
  // The backup is taken first and its failure aborts the wipe: the point of
  // this endpoint is that data cannot be destroyed without a copy existing on
  // disk. A browser download can't be confirmed from the page, so the app takes
  // the snapshot itself rather than trusting that the user exported one.
  let backupPath: string;
  try {
    backupPath = await backupBeforeDestructiveChange('before-wipe');
  } catch (error) {
    console.error('Backup before wipe failed; nothing was deleted', error);
    res.status(500).json({ error: 'backup_failed' });
    return;
  }

  await wipeAllData();
  res.json({ ok: true, backupPath });
});

/**
 * The backup folder, what's in it, and where else it could point.
 *
 * One endpoint rather than three because the panel needs all of it at once,
 * and because the snapshot list is only meaningful next to the folder it was
 * read from.
 */
apiRouter.get('/backup/folder', async (_req, res) => {
  const settings = await readBackupSettings();
  const [detected, snapshots] = await Promise.all([detectSyncedFolders(), settings.folder ? listSnapshots(settings.folder) : Promise.resolve([])]);

  res.json({
    ...settings,
    // A folder that has since been unmounted, renamed or signed out of. The
    // app keeps the setting and says so rather than silently switching off.
    folderAvailable: settings.folder ? await isWritableDirectory(settings.folder) : true,
    detected,
    snapshots,
  });
});

apiRouter.put('/backup/folder', async (req, res) => {
  const { folder, keep } = req.body ?? {};

  if (folder !== null && typeof folder !== 'string') {
    res.status(400).json({ error: 'folder must be a string or null' });
    return;
  }
  if (keep !== undefined && (typeof keep !== 'number' || !Number.isFinite(keep))) {
    res.status(400).json({ error: 'keep must be a number' });
    return;
  }

  const trimmed = typeof folder === 'string' ? folder.trim() : null;
  if (trimmed && !(await isWritableDirectory(trimmed))) {
    res.status(400).json({ error: 'folder_not_writable' });
    return;
  }

  const current = await readBackupSettings();
  const settings = await writeBackupSettings({ folder: trimmed || null, keep: keep ?? current.keep });

  // Prove the folder works while the user is still looking at the setting,
  // rather than leaving them to find out in three weeks that it never did.
  let snapshotFailed = false;
  if (settings.folder) {
    try {
      await snapshotNow();
    } catch (error) {
      console.error('First snapshot after setting the backup folder failed', error);
      snapshotFailed = true;
    }
  }

  res.json({ ...settings, snapshotFailed, snapshots: settings.folder ? await listSnapshots(settings.folder) : [] });
});

apiRouter.post('/backup/snapshot', async (_req, res) => {
  const { folder } = await readBackupSettings();
  if (!folder) {
    res.status(400).json({ error: 'no_backup_folder' });
    return;
  }

  try {
    const snapshot = await snapshotNow();
    res.json({ ok: true, snapshot, snapshots: await listSnapshots(folder) });
  } catch (error) {
    console.error('Manual snapshot failed', error);
    res.status(500).json({ error: 'snapshot_failed' });
  }
});

/**
 * Replaces the database with a snapshot from the backup folder.
 *
 * This is the deliberate hand-off between machines: the app never merges, so
 * restoring is always "this snapshot wins, everything here now is replaced".
 * A safety copy of the current database is taken first, on the same reasoning
 * as the wipe endpoint — the app takes it rather than trusting that anyone
 * exported one.
 */
apiRouter.post('/backup/restore', async (req, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== 'string') {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const { folder } = await readBackupSettings();
  if (!folder) {
    res.status(400).json({ error: 'no_backup_folder' });
    return;
  }

  const path = resolveSnapshotPath(folder, name);
  if (!path || !looksLikeBudgetDatabase(path)) {
    res.status(400).json({ error: 'invalid_backup_file' });
    return;
  }

  let backupPath: string;
  try {
    backupPath = await backupBeforeDestructiveChange('before-restore');
  } catch (error) {
    console.error('Backup before restore failed; nothing was replaced', error);
    res.status(500).json({ error: 'backup_failed' });
    return;
  }

  try {
    await replaceDbWith(path);
    res.json({ ok: true, backupPath });
  } catch (error) {
    console.error('Restore failed', error);
    res.status(500).json({ error: 'restore_failed' });
  }
});

const SQLITE_HEADER = 'SQLite format 3\0';

/**
 * Whether a file is plausibly one of this app's databases.
 *
 * Opened read-only and checked for the app's own tables, so restoring can't be
 * talked into swallowing an unrelated SQLite file — someone else's database
 * would migrate cleanly and leave the app pointing at empty accounts.
 */
function looksLikeBudgetDatabase(path: string): boolean {
  try {
    const check = new SqliteDatabase(path, { readonly: true });
    const tables = check
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('accounts', 'recurring_items')")
      .all() as { name: string }[];
    check.close();
    return tables.length === 2;
  } catch {
    return false;
  }
}

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
    if (!looksLikeBudgetDatabase(tempPath)) {
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
