import { describe, expect, it } from 'vitest';
import { getBackupReminder } from './backupReminder';
import { clampAutoLockMinutes, createEmptyAppData, migrateAppData, SchemaError, SCHEMA_VERSION } from './schema';

const NOW = new Date('2026-03-31T00:00:00.000Z');

describe('백업 알림', () => {
  it('한 번도 백업하지 않았으면 알림 대상', () => {
    expect(getBackupReminder(null, NOW)).toMatchObject({ due: true, daysSince: null, reason: 'never' });
  });

  it('29일 경과는 알림 없음, 30일 경과부터 알림', () => {
    expect(getBackupReminder('2026-03-02T00:00:00.000Z', NOW)).toMatchObject({ due: false, daysSince: 29 });
    expect(getBackupReminder('2026-03-01T00:00:00.000Z', NOW)).toMatchObject({ due: true, daysSince: 30, reason: 'old' });
  });

  it('백업 후 데이터를 바꾸면 기간과 상관없이 알림', () => {
    const r = getBackupReminder('2026-03-30T00:00:00.000Z', NOW, '2026-03-30T10:00:00.000Z');
    expect(r).toMatchObject({ due: true, reason: 'changed', changedSinceBackup: true });
    expect(getBackupReminder('2026-03-30T12:00:00.000Z', NOW, '2026-03-30T10:00:00.000Z').due).toBe(false);
  });
});

describe('스키마', () => {
  it('빈 데이터는 현재 스키마 버전과 기본 자동 잠금 10분을 가진다', () => {
    const data = createEmptyAppData(NOW);
    expect(data.schemaVersion).toBe(SCHEMA_VERSION);
    expect(data.settings.autoLockMinutes).toBe(10);
    expect(data.meta.lastBackupAt).toBeNull();
  });

  it('v1 데이터는 최신 버전(v3)으로 올라가며 자산·대출·기록 항목이 추가된다', () => {
    const v1 = {
      schemaVersion: 1,
      settings: { autoLockMinutes: 15 },
      meta: { createdAt: NOW.toISOString(), lastModifiedAt: NOW.toISOString(), lastBackupAt: null },
    };
    const migrated = migrateAppData(v1);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.loans).toEqual([]);
    expect(migrated.housing).toBeNull();
    expect(migrated.settings.autoLockMinutes).toBe(15);
    expect(migrated.settings.taxRates.general.ratePct).toBe(15.4);
    expect(migrated.assets).toEqual([]);
  });

  it('알 수 없는 유형의 자산 항목은 제외한다', () => {
    const data = { ...createEmptyAppData(NOW), assets: [{ id: 'a', type: 'bitcoin' }, 'x', null] };
    expect(migrateAppData(data).assets).toEqual([]);
  });

  it('마이그레이션은 정상 데이터를 그대로 유지한다', () => {
    const data = createEmptyAppData(NOW);
    expect(migrateAppData(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it('더 높은 스키마 버전이나 깨진 데이터는 거부한다', () => {
    expect(() => migrateAppData({ schemaVersion: SCHEMA_VERSION + 1 })).toThrow(SchemaError);
    expect(() => migrateAppData(null)).toThrow(SchemaError);
    expect(() => migrateAppData([])).toThrow(SchemaError);
  });

  it('자동 잠금 시간은 1~120분으로 제한한다', () => {
    expect(clampAutoLockMinutes(0)).toBe(1);
    expect(clampAutoLockMinutes(500)).toBe(120);
    expect(clampAutoLockMinutes(Number.NaN)).toBe(10);
  });
});
