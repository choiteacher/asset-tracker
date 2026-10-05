// 한국어 조사 자동 선택. 마지막 글자가 한글이면 받침 유무로, 아니면(영문·숫자 등) "을(를)" 형태로 둔다.

type JosaPair = '을/를' | '은/는' | '이/가';

/** word 뒤에 붙일 조사만 돌려준다. */
export function particle(word: string, pair: JosaPair): string {
  const [withBatchim, withoutBatchim] = pair.split('/') as [string, string];
  const code = word.trim().slice(-1).charCodeAt(0) - 0xac00;
  if (Number.isNaN(code) || code < 0 || code > 11171) return `${withBatchim}(${withoutBatchim})`;
  return code % 28 === 0 ? withoutBatchim : withBatchim;
}

export function josa(word: string, pair: JosaPair): string {
  return word + particle(word, pair);
}
