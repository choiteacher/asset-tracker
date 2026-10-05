export const MIN_PASSWORD_LENGTH = 10;

export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface PasswordAssessment {
  meetsMinimum: boolean;
  level: StrengthLevel;
  label: string;
  hints: string[];
}

const LABELS: Record<StrengthLevel, string> = {
  0: '매우 약함',
  1: '약함',
  2: '보통',
  3: '강함',
  4: '매우 강함',
};

const SEQUENCES = ['01234567890123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiopasdfghjklzxcvbnm'];

/** 같은 문자 반복(aaaa)이나 연속·자판 순서(1234567890, abcd, qwerty)만으로 된 비밀번호인지. */
function isTrivialPattern(pw: string): boolean {
  if (/^(.)\1+$/.test(pw)) return true;
  const lower = pw.toLowerCase();
  const reversed = [...lower].reverse().join('');
  return SEQUENCES.some((seq) => seq.includes(lower) || seq.includes(reversed));
}

/** 간단한 강도 추정. 길이와 문자 종류 수를 기준으로 하며, 정밀한 측정기는 아니다. */
export function assessPassword(password: string): PasswordAssessment {
  const length = [...password].length;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  const hints: string[] = [];

  let score = 0;
  if (length >= MIN_PASSWORD_LENGTH) score++;
  if (length >= 14) score++;
  if (classes >= 3) score++;
  if (classes >= 4 || length >= 20) score++;

  if (length > 0 && isTrivialPattern(password)) score = 0;

  if (length < MIN_PASSWORD_LENGTH) hints.push(`최소 ${MIN_PASSWORD_LENGTH}자 이상 입력하세요.`);
  if (length < 14) hints.push('14자 이상이면 더 안전합니다.');
  if (classes < 3) hints.push('영문 대·소문자, 숫자, 기호를 섞어 쓰세요.');

  const level = Math.min(score, 4) as StrengthLevel;
  return { meetsMinimum: length >= MIN_PASSWORD_LENGTH, level, label: LABELS[level], hints };
}
