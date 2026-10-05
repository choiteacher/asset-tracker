import type { ReactNode } from 'react';
import { Disclaimer } from './Disclaimer';

/** 템플릿 로그인 화면(auth-wrapper) 구조의 잠금/설정 화면 레이아웃. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="auth-wrapper">
      <div className="auth-content app-auth-content">
        <main className="card borderless">
          <div className="card-body">
            <div className="app-auth-brand">
              <span className="app-brand-mark" aria-hidden="true">
                ₩
              </span>
              <span>자산 트래커</span>
            </div>
            <h4 className="mb-2 f-w-600">{title}</h4>
            {subtitle && <p className="text-muted mb-4">{subtitle}</p>}
            {children}
          </div>
        </main>
        <Disclaimer className="text-white text-opacity-75 mt-3" />
      </div>
    </div>
  );
}
