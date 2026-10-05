export function Disclaimer({ className = 'text-muted' }: { className?: string }) {
  return (
    <p className={`app-disclaimer ${className}`} role="note">
      투자 자문이 아닌 참고용 추정치이며 실제 금액과 다를 수 있습니다.
    </p>
  );
}
