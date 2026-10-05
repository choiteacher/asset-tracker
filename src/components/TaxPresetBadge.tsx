/** 세율 프리셋을 사용자가 확인하지 않았으면 경고 배지를 보여준다. */
export function TaxPresetBadge({ confirmed }: { confirmed: boolean }) {
  if (confirmed) return null;
  return (
    <span className="badge bg-light-warning text-wrap text-start mt-1 d-inline-block" title="예시값입니다">
      확인 필요 — 가입 상품 안내문 기준으로 수정
    </span>
  );
}
