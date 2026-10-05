/** 템플릿에 포함된 Material Icons Two Tone 폰트 아이콘. 이름은 https://fonts.google.com/icons 기준(폰트는 번들됨). */
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <i className={`material-icons-two-tone ${className}`} aria-hidden="true">
      {name}
    </i>
  );
}
