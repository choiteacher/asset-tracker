// 앱 전체 데이터. 이 객체 하나가 통째로 JSON 직렬화되어 암호화 저장된다.
// 구조를 바꿀 때는 SCHEMA_VERSION을 올리고 migrateAppData에 단계별 변환을 추가한다.
//  - v1: 설정(자동 잠금), 메타(생성/수정/백업 시각)
//  - v2: 자산 목록(assets), 세율 프리셋(settings.taxRates)
//  - v3: 대출(loans), 분양 일정(housing), 스냅샷(snapshots), 변경 내역(changeLog), 마지막 데이터 변경 시각

import { ASSET_TYPES, type Asset } from './assets';
import type { ChangeEntry, Snapshot } from './history';
import type { HousingPlan } from './housing';
import type { Loan } from './loans';
import { createDefaultTaxRates, normalizeTaxRates, type TaxRateTable } from './taxRates';

export const SCHEMA_VERSION = 3;

export const AUTO_LOCK_DEFAULT_MINUTES = 10;
export const AUTO_LOCK_MIN_MINUTES = 1;
export const AUTO_LOCK_MAX_MINUTES = 120;

export interface AppSettings {
  /** 무조작 시 자동 잠금까지의 시간(분). */
  autoLockMinutes: number;
  /** 과세유형별 세율 프리셋. */
  taxRates: TaxRateTable;
}

export interface AppMeta {
  createdAt: string;
  lastModifiedAt: string;
  /** 마지막으로 암호화 백업을 내보낸 시각(ISO). 한 번도 없으면 null. */
  lastBackupAt: string | null;
  /** 사용자가 마지막으로 데이터를 등록/수정/삭제한 시각(스냅샷 자동 기록은 제외). */
  lastDataChangeAt: string | null;
}

export interface AppData {
  schemaVersion: number;
  settings: AppSettings;
  meta: AppMeta;
  assets: Asset[];
  loans: Loan[];
  housing: HousingPlan | null;
  snapshots: Snapshot[];
  changeLog: ChangeEntry[];
}

export class SchemaError extends Error {
  constructor(message = '저장된 데이터 구조를 읽을 수 없습니다.') {
    super(message);
    this.name = 'SchemaError';
  }
}

export function createEmptyAppData(now: Date): AppData {
  const iso = now.toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { autoLockMinutes: AUTO_LOCK_DEFAULT_MINUTES, taxRates: createDefaultTaxRates() },
    meta: { createdAt: iso, lastModifiedAt: iso, lastBackupAt: null, lastDataChangeAt: null },
    assets: [],
    loans: [],
    housing: null,
    snapshots: [],
    changeLog: [],
  };
}

export function clampAutoLockMinutes(value: number): number {
  if (!Number.isFinite(value)) return AUTO_LOCK_DEFAULT_MINUTES;
  return Math.min(AUTO_LOCK_MAX_MINUTES, Math.max(AUTO_LOCK_MIN_MINUTES, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** v1 → v2: 자산 목록과 세율 프리셋 추가. */
function migrateV1toV2(raw: Record<string, unknown>): Record<string, unknown> {
  const settings = isRecord(raw.settings) ? raw.settings : {};
  return { ...raw, schemaVersion: 2, settings: { ...settings, taxRates: createDefaultTaxRates() }, assets: [] };
}

/** v2 → v3: 대출·분양·기록 추가. */
function migrateV2toV3(raw: Record<string, unknown>): Record<string, unknown> {
  return { ...raw, schemaVersion: 3, loans: [], housing: null, snapshots: [], changeLog: [] };
}

/** 암호화된 데이터 안의 항목은 앱이 저장한 것이므로 구조만 확인한다(알 수 없는 항목만 제외). */
function readList<T>(value: unknown, check: (item: Record<string, unknown>) => boolean): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => isRecord(item) && check(item)) as T[];
}

/**
 * 복호화된 원본을 현재 스키마로 변환한다. 버전마다 차례대로 올린 뒤 기본값을 채운다.
 */
export function migrateAppData(input: unknown): AppData {
  if (!isRecord(input) || typeof input.schemaVersion !== 'number') throw new SchemaError();
  if (input.schemaVersion > SCHEMA_VERSION) {
    throw new SchemaError('더 새로운 버전의 앱에서 만든 데이터입니다. 앱을 새로고침해 최신 버전으로 열어주세요.');
  }

  let raw = input;
  if (raw.schemaVersion === 1) raw = migrateV1toV2(raw);
  if (raw.schemaVersion === 2) raw = migrateV2toV3(raw);

  const settings = isRecord(raw.settings) ? raw.settings : {};
  const meta = isRecord(raw.meta) ? raw.meta : {};
  const fallbackIso = new Date(0).toISOString();
  const housing = isRecord(raw.housing) && Array.isArray(raw.housing.payments) ? (raw.housing as unknown as HousingPlan) : null;
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      autoLockMinutes: clampAutoLockMinutes(Number(settings.autoLockMinutes ?? AUTO_LOCK_DEFAULT_MINUTES)),
      taxRates: normalizeTaxRates(settings.taxRates),
    },
    meta: {
      createdAt: typeof meta.createdAt === 'string' ? meta.createdAt : fallbackIso,
      lastModifiedAt: typeof meta.lastModifiedAt === 'string' ? meta.lastModifiedAt : fallbackIso,
      lastBackupAt: typeof meta.lastBackupAt === 'string' ? meta.lastBackupAt : null,
      lastDataChangeAt: typeof meta.lastDataChangeAt === 'string' ? meta.lastDataChangeAt : null,
    },
    assets: readList<Asset>(raw.assets, (i) => typeof i.id === 'string' && ASSET_TYPES.includes(i.type as Asset['type'])),
    loans: readList<Loan>(raw.loans, (i) => typeof i.id === 'string' && typeof i.balance === 'number'),
    housing,
    snapshots: readList<Snapshot>(raw.snapshots, (i) => typeof i.date === 'string' && typeof i.net === 'number'),
    changeLog: readList<ChangeEntry>(raw.changeLog, (i) => typeof i.at === 'string'),
  };
}
