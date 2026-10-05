import { describe, expect, it } from 'vitest';
import {
  decryptWithKey,
  decryptWithPassword,
  deriveVaultKey,
  encryptJson,
  isVaultEnvelope,
  MIN_PBKDF2_ITERATIONS,
  PBKDF2_ITERATIONS,
  VaultDecryptError,
  VaultFormatError,
} from './vault';
import { base64ToBytes, bytesToBase64 } from './encoding';

// 가상의 테스트 값만 사용한다.
const PASSWORD = 'test-Password-123!';
const SAMPLE = { note: '테스트용 가상 데이터', amount: 1234567.8, nested: { list: [1, 2, 3] } };

describe('encoding', () => {
  it('Base64 왕복 변환이 원본 바이트를 보존한다', () => {
    const bytes = new Uint8Array(70_000).map((_, i) => i % 256);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });
});

describe('vault 암호화/복호화', () => {
  it('비밀번호로 암호화한 값을 같은 비밀번호로 복호화하면 원본과 같다', async () => {
    const key = await deriveVaultKey(PASSWORD);
    const envelope = await encryptJson(key, SAMPLE);
    const { value } = await decryptWithPassword(PASSWORD, envelope);
    expect(value).toEqual(SAMPLE);
  });

  it('틀린 비밀번호는 VaultDecryptError로 실패한다(복호화 성공 여부로 검증)', async () => {
    const envelope = await encryptJson(await deriveVaultKey(PASSWORD), SAMPLE);
    await expect(decryptWithPassword('wrong-Password-123!', envelope)).rejects.toBeInstanceOf(VaultDecryptError);
  });

  it('PBKDF2 반복 횟수는 300,000회 이상이고 봉투에 기록된다', async () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(300_000);
    const envelope = await encryptJson(await deriveVaultKey(PASSWORD), SAMPLE);
    expect(envelope.kdf).toMatchObject({ name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS });
    expect(base64ToBytes(envelope.kdf.salt)).toHaveLength(16);
    expect(base64ToBytes(envelope.cipher.iv)).toHaveLength(12);
  });

  it('같은 키로 저장할 때마다 IV와 암호문이 새로 만들어진다', async () => {
    const key = await deriveVaultKey(PASSWORD);
    const a = await encryptJson(key, SAMPLE);
    const b = await encryptJson(key, SAMPLE);
    expect(a.cipher.iv).not.toBe(b.cipher.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.kdf.salt).toBe(b.kdf.salt);
  });

  it('새 키를 만들 때마다 salt가 랜덤이다', async () => {
    const a = await deriveVaultKey(PASSWORD);
    const b = await deriveVaultKey(PASSWORD);
    expect(bytesToBase64(a.salt)).not.toBe(bytesToBase64(b.salt));
  });

  it('봉투에는 평문·비밀번호가 들어 있지 않다(암호문, salt, IV, 버전 정보뿐)', async () => {
    const envelope = await encryptJson(await deriveVaultKey(PASSWORD), SAMPLE);
    const text = JSON.stringify(envelope);
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain('1234567.8');
    expect(text).not.toContain('테스트용');
    expect(Object.keys(envelope).sort()).toEqual(['cipher', 'ciphertext', 'format', 'kdf', 'version']);
  });

  it('키는 추출할 수 없다(메모리 밖으로 꺼낼 수 없음)', async () => {
    const { key } = await deriveVaultKey(PASSWORD);
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });

  it('암호문이 1비트라도 변조되면 복호화에 실패한다', async () => {
    const key = await deriveVaultKey(PASSWORD);
    const envelope = await encryptJson(key, SAMPLE);
    const bytes = base64ToBytes(envelope.ciphertext);
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    await expect(
      decryptWithKey(key, { ...envelope, ciphertext: bytesToBase64(bytes) }),
    ).rejects.toBeInstanceOf(VaultDecryptError);
  });

  it('IV를 바꿔치기해도 복호화에 실패한다', async () => {
    const key = await deriveVaultKey(PASSWORD);
    const a = await encryptJson(key, SAMPLE);
    const b = await encryptJson(key, SAMPLE);
    await expect(decryptWithKey(key, { ...a, cipher: b.cipher })).rejects.toBeInstanceOf(VaultDecryptError);
  });

  it('반복 횟수를 하한보다 낮춘 봉투는 형식 오류로 거부한다', async () => {
    const envelope = await encryptJson(await deriveVaultKey(PASSWORD), SAMPLE);
    const weakened = { ...envelope, kdf: { ...envelope.kdf, iterations: MIN_PBKDF2_ITERATIONS - 1 } };
    expect(isVaultEnvelope(weakened)).toBe(false);
    await expect(decryptWithPassword(PASSWORD, weakened)).rejects.toBeInstanceOf(VaultFormatError);
  });

  it('한글 비밀번호는 입력 방식(NFC/NFD)이 달라도 같은 비밀번호로 취급한다', async () => {
    const nfc = '가상비밀번호테스트'.normalize('NFC');
    const nfd = nfc.normalize('NFD');
    expect(nfd).not.toBe(nfc);
    const envelope = await encryptJson(await deriveVaultKey(nfc), SAMPLE);
    const { value } = await decryptWithPassword(nfd, envelope);
    expect(value).toEqual(SAMPLE);
  });

  it('실패 메시지에는 원인이나 데이터가 드러나지 않는다', () => {
    expect(new VaultDecryptError().message).toBe('비밀번호가 올바르지 않거나 데이터가 손상되었습니다.');
  });
});
