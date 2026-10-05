import { VaultDecryptError, VaultFormatError } from '../crypto/vault';
import { SchemaError } from '../data/schema';

/**
 * 화면에 보여줄 오류 문구. 앱이 직접 만든 고정 문구만 그대로 쓰고,
 * 그 밖의 예외는 내용(데이터 일부가 섞일 수 있음)을 노출하지 않고 일반 문구로 바꾼다.
 */
export function toUserMessage(error: unknown): string {
  if (error instanceof VaultDecryptError || error instanceof VaultFormatError || error instanceof SchemaError) {
    return error.message;
  }
  return '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}
