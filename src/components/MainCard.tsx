import type { ReactNode } from 'react';

/** 템플릿 MainCard의 단순화 버전(제목 + 본문, 오른쪽 액션 영역). */
export function MainCard({
  title,
  action,
  className = '',
  bodyClassName = '',
  id,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section className={`card ${className}`} id={id}>
      {title && (
        <div className="card-header d-flex align-items-center justify-content-between gap-2 flex-wrap">
          <h5>{title}</h5>
          {action}
        </div>
      )}
      <div className={`card-body ${bodyClassName}`}>{children}</div>
    </section>
  );
}
