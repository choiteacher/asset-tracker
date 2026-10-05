// 비밀번호 기반 암호화 모듈 (WebCrypto).
//  - 키 유도: PBKDF2(SHA-256, 랜덤 salt 16바이트)
//  - 암호화: AES-GCM 256비트, 저장할 때마다 새 랜덤 IV 12바이트
//  - 저장되는 것은 VaultEnvelope(형식/버전, KDF 파라미터, salt, IV, 암호문)뿐이다.
//    비밀번호와 키는 어디에도 저장하지 않으며, 키는 추출 불가(extractable=false)로 만든다.
//  - 비밀번호 검증은 별도 해시 없이 "복호화 성공 여부"로만 판단한다.

import { base64ToBytes, bytesToBase64 } from './encoding';

export const VAULT_FORMAT = 'asset-tracker/vault';
export const VAULT_VERSION = 1;
export const PBKDF2_ITERATIONS = 600_000;
/** 백업 파일 등에서 반복 횟수를 낮춰 공격을 쉽게 만드는 조작을 막기 위한 하한. */
export const MIN_PBKDF2_ITERATIONS = 300_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface VaultEnvelope {
  format: typeof VAULT_FORMAT;
  version: number;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string };
  ciphertext: string;
}

/** 메모리에만 존재하는 잠금 해제 키. */
export interface VaultKey {
  key: CryptoKey;
  salt: Uint8Array<ArrayBuffer>;
  iterations: number;
}

/** 실패 원인을 구분해 노출하지 않도록 메시지를 하나로 통일한다. */
export class VaultDecryptError extends Error {
  constructor() {
    super('비밀번호가 올바르지 않거나 데이터가 손상되었습니다.');
    this.name = 'VaultDecryptError';
  }
}

export class VaultFormatError extends Error {
  constructor() {
    super('자산 트래커 암호화 파일 형식이 아닙니다.');
    this.name = 'VaultFormatError';
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** 같은 비밀번호라도 OS/입력기에 따라 한글 조합 방식이 달라질 수 있어 NFC로 정규화한다. */
function passwordBytes(password: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(password.normalize('NFC'));
}

function additionalData(version: number): Uint8Array<ArrayBuffer> {
  return encoder.encode(`${VAULT_FORMAT}:${version}`);
}

export async function deriveVaultKey(
  password: string,
  salt: Uint8Array<ArrayBuffer> = randomBytes(SALT_BYTES),
  iterations: number = PBKDF2_ITERATIONS,
): Promise<VaultKey> {
  if (iterations < MIN_PBKDF2_ITERATIONS) throw new VaultFormatError();
  const baseKey = await crypto.subtle.importKey('raw', passwordBytes(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  return { key, salt, iterations };
}

export async function encryptJson(vaultKey: VaultKey, value: unknown): Promise<VaultEnvelope> {
  const iv = randomBytes(IV_BYTES);
  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: additionalData(VAULT_VERSION) },
    vaultKey.key,
    plaintext,
  );
  return {
    format: VAULT_FORMAT,
    version: VAULT_VERSION,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: vaultKey.iterations,
      salt: bytesToBase64(vaultKey.salt),
    },
    cipher: { name: 'AES-GCM', iv: bytesToBase64(iv) },
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

/** 이미 유도된 키로 복호화한다. 키가 맞지 않으면 VaultDecryptError. */
export async function decryptWithKey(vaultKey: VaultKey, envelope: VaultEnvelope): Promise<unknown> {
  assertVaultEnvelope(envelope);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64ToBytes(envelope.cipher.iv),
        additionalData: additionalData(envelope.version),
      },
      vaultKey.key,
      base64ToBytes(envelope.ciphertext),
    );
  } catch {
    throw new VaultDecryptError();
  }
  try {
    return JSON.parse(decoder.decode(plaintext));
  } catch {
    throw new VaultDecryptError();
  }
}

/** 비밀번호로 키를 유도해 복호화한다. 성공하면 이후 저장에 쓸 키도 함께 돌려준다. */
export async function decryptWithPassword(
  password: string,
  envelope: VaultEnvelope,
): Promise<{ value: unknown; vaultKey: VaultKey }> {
  assertVaultEnvelope(envelope);
  let salt: Uint8Array<ArrayBuffer>;
  try {
    salt = base64ToBytes(envelope.kdf.salt);
  } catch {
    throw new VaultFormatError();
  }
  const vaultKey = await deriveVaultKey(password, salt, envelope.kdf.iterations);
  const value = await decryptWithKey(vaultKey, envelope);
  return { value, vaultKey };
}

export function isVaultEnvelope(value: unknown): value is VaultEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const kdf = v.kdf as Record<string, unknown> | undefined;
  const cipher = v.cipher as Record<string, unknown> | undefined;
  return (
    v.format === VAULT_FORMAT &&
    v.version === VAULT_VERSION &&
    typeof v.ciphertext === 'string' &&
    typeof kdf === 'object' &&
    kdf !== null &&
    kdf.name === 'PBKDF2' &&
    kdf.hash === 'SHA-256' &&
    typeof kdf.iterations === 'number' &&
    Number.isInteger(kdf.iterations) &&
    kdf.iterations >= MIN_PBKDF2_ITERATIONS &&
    typeof kdf.salt === 'string' &&
    typeof cipher === 'object' &&
    cipher !== null &&
    cipher.name === 'AES-GCM' &&
    typeof cipher.iv === 'string'
  );
}

export function assertVaultEnvelope(value: unknown): asserts value is VaultEnvelope {
  if (!isVaultEnvelope(value)) throw new VaultFormatError();
}
