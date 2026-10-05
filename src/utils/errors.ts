import { VaultDecryptError, VaultFormatError } from '../crypto/vault';
import { SchemaError } from '../data/schema';
import { VaultConflictError } from '../storage/revisionedAdapter';

/** Firebase 오류 코드 → 사용자 문구. 서버 원문 메시지는 보여주지 않는다. */
const FIREBASE_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': '이메일 또는 로그인 비밀번호가 올바르지 않습니다.',
  'auth/invalid-email': '이메일 형식이 올바르지 않습니다.',
  'auth/user-disabled': '사용이 중지된 계정입니다.',
  'auth/too-many-requests': '로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.',
  'auth/network-request-failed': '인터넷 연결을 확인하세요.',
  'permission-denied': '이 계정은 데이터에 접근할 권한이 없습니다.',
  unavailable: '서버에 연결할 수 없습니다. 인터넷 연결을 확인하세요.',
  'deadline-exceeded': '서버 응답이 늦습니다. 잠시 후 다시 시도하세요.',
  'resource-exhausted': '서버 사용량 한도를 넘었습니다. 잠시 후 다시 시도하세요.',
  aborted: '다른 저장과 겹쳤습니다. 다시 시도하세요.',
};

/**
 * 화면에 보여줄 오류 문구. 앱이 직접 만든 고정 문구만 그대로 쓰고,
 * 그 밖의 예외는 내용(데이터 일부가 섞일 수 있음)을 노출하지 않고 일반 문구로 바꾼다.
 */
export function toUserMessage(error: unknown): string {
  if (
    error instanceof VaultDecryptError ||
    error instanceof VaultFormatError ||
    error instanceof SchemaError ||
    error instanceof VaultConflictError
  ) {
    return error.message;
  }
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  if (typeof code === 'string' && code in FIREBASE_MESSAGES) return FIREBASE_MESSAGES[code]!;
  if (typeof code === 'string' && code.startsWith('auth/')) return '로그인에 실패했습니다. 잠시 후 다시 시도하세요.';
  return '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}
