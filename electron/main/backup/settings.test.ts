import { writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { withTestDb } from '../../../test/dbFixture';
import { coerce, DEFAULT_SETTINGS, readBackupSettings, writeBackupSettings } from './settings';
import { dbPath } from '../db';

describe('coerce', () => {
  it('falls back to the defaults for a non-object', () => {
    expect(coerce(null)).toEqual(DEFAULT_SETTINGS);
    expect(coerce('nonsense')).toEqual(DEFAULT_SETTINGS);
    expect(coerce(42)).toEqual(DEFAULT_SETTINGS);
  });

  it('trims a blank folder string down to null', () => {
    expect(coerce({ folder: '   ', keep: 10 }).folder).toBeNull();
  });

  it('keeps a real folder path as-is', () => {
    expect(coerce({ folder: '/backups', keep: 10 }).folder).toBe('/backups');
  });

  it('clamps keep to [1, 200], flooring a fractional value', () => {
    expect(coerce({ folder: null, keep: 0 }).keep).toBe(1);
    expect(coerce({ folder: null, keep: 500 }).keep).toBe(200);
    expect(coerce({ folder: null, keep: 5.9 }).keep).toBe(5);
  });

  it('defaults keep when it is missing or not a finite number', () => {
    expect(coerce({ folder: null }).keep).toBe(DEFAULT_SETTINGS.keep);
    expect(coerce({ folder: null, keep: NaN }).keep).toBe(DEFAULT_SETTINGS.keep);
    expect(coerce({ folder: null, keep: 'ten' }).keep).toBe(DEFAULT_SETTINGS.keep);
  });
});

describe('readBackupSettings', () => {
  it('returns the defaults when no settings file exists yet', async () => {
    await withTestDb(async () => {
      expect(await readBackupSettings()).toEqual(DEFAULT_SETTINGS);
    });
  });

  it('returns the defaults for a corrupt settings file, rather than failing', async () => {
    await withTestDb(async () => {
      await writeFile(join(dirname(dbPath()), 'backup-settings.json'), '{not valid json', 'utf8');
      expect(await readBackupSettings()).toEqual(DEFAULT_SETTINGS);
    });
  });
});

describe('writeBackupSettings', () => {
  it('round-trips through readBackupSettings', async () => {
    await withTestDb(async () => {
      await writeBackupSettings({ folder: '/backups', keep: 15 });
      expect(await readBackupSettings()).toEqual({ folder: '/backups', keep: 15 });
    });
  });

  it('coerces the value before writing it', async () => {
    await withTestDb(async () => {
      const written = await writeBackupSettings({ folder: '  ', keep: 9999 });
      expect(written).toEqual({ folder: null, keep: 200 });
      expect(await readBackupSettings()).toEqual({ folder: null, keep: 200 });
    });
  });
});
