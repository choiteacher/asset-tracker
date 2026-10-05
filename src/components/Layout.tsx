// DashboardKit AdminLayout 구조(pc-sidebar / pc-header / pc-mob-header / pc-container)를 TypeScript로 옮긴 레이아웃.
// 원본의 구매 링크·검색·사용자 메뉴는 빼고, 잠금 버튼과 면책 문구를 넣었다.

import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { useDisplayPrefs, type ThemePref } from '../session/DisplayPrefs';
import { useEditMode } from '../session/EditMode';
import { useSession } from '../session/SessionContext';
import { Disclaimer } from './Disclaimer';
import { Icon } from './Icon';
import { findMenu, MENU } from './menu';

function Brand() {
  return (
    <Link to="/" className="b-brand app-brand">
      <span className="app-brand-mark" aria-hidden="true">
        ₩
      </span>
      <span className="app-brand-text">자산 트래커</span>
    </Link>
  );
}

function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  return (
    <nav className={`pc-sidebar${open ? ' mob-sidebar-active' : ''}`} aria-label="주요 메뉴">
      <div className="navbar-wrapper">
        <div className="m-header">
          <Brand />
        </div>
        <div className="navbar-content">
          <ul className="pc-navbar">
            {MENU.map((group) => (
              <li key={group.id} className="pc-group">
                <ul>
                  <li className="pc-item pc-caption">
                    <label>{group.title}</label>
                    <span>{group.subtitle}</span>
                  </li>
                  {group.items.map((item) => (
                    <li key={item.id} className="pc-item">
                      <NavLink
                        to={item.url}
                        end={item.url === '/'}
                        className="pc-link"
                        onClick={onNavigate}
                      >
                        <span className="pc-micon">
                          <Icon name={item.icon} />
                        </span>
                        <span className="pc-mtext">{item.title}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <DisplaySettings />
        </div>
      </div>
      {open && <div className="pc-menu-overlay" aria-hidden="true" onClick={onNavigate} />}
    </nav>
  );
}

function PageHeader({ title }: { title: string }) {
  const { pathname } = useLocation();
  const found = findMenu(pathname);
  return (
    <div className="page-header">
      <div className="page-block">
        <div className="page-header-title">
          <h5 className="m-b-10">{title}</h5>
        </div>
        <ul className="breadcrumb">
          <li className="breadcrumb-item">
            <Link to="/">홈</Link>
          </li>
          {found && <li className="breadcrumb-item">{found.group.title}</li>}
          {found && found.item.url !== '/' && (
            <li className="breadcrumb-item">
              <Link to={found.item.url}>{found.item.title}</Link>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

/** 헤더 도구: 금액 가리기, 보기/편집 모드, 잠금. 좁은 화면에서는 아이콘만 보인다. */
function HeaderTools({ className = '' }: { className?: string }) {
  const { lock } = useSession();
  const { masked, setMasked } = useDisplayPrefs();
  const { editMode, requestEdit, exitEdit } = useEditMode();
  return (
    <div className={`d-flex align-items-center ${className}`}>
      <button
        type="button"
        className="pc-head-link btn-reset"
        onClick={() => setMasked(!masked)}
        aria-pressed={masked}
        title={masked ? '금액 표시' : '금액 가리기'}
      >
        <Icon name={masked ? 'visibility_off' : 'visibility'} />
        <span className="ms-2 app-tool-label">{masked ? '금액 표시' : '금액 가리기'}</span>
      </button>
      <button
        type="button"
        className={`pc-head-link btn-reset${editMode ? ' app-edit-on' : ''}`}
        onClick={() => (editMode ? exitEdit() : requestEdit())}
        aria-pressed={editMode}
        title={editMode ? '보기 모드로 돌아가기' : '편집 모드로 전환'}
      >
        <Icon name="edit" />
        <span className="ms-2 app-tool-label">{editMode ? '편집 모드' : '보기 모드'}</span>
      </button>
      <button type="button" className="pc-head-link btn-reset" onClick={lock} title="지금 잠그기">
        <Icon name="lock" />
        <span className="ms-2 app-tool-label">잠금</span>
      </button>
    </div>
  );
}

/** 사이드바 아래 화면 설정(보는 사람별, 브라우저에만 저장). */
function DisplaySettings() {
  const { theme, setTheme, largeText, setLargeText } = useDisplayPrefs();
  return (
    <div className="app-display-settings">
      <label className="form-label small" htmlFor="theme-select">
        화면 테마
      </label>
      <select id="theme-select" className="form-select form-select-sm mb-2" value={theme} onChange={(e) => setTheme(e.target.value as ThemePref)}>
        <option value="system">시스템 설정 따르기</option>
        <option value="light">밝게</option>
        <option value="dark">어둡게(다크 모드)</option>
      </select>
      <div className="form-check form-switch">
        <input className="form-check-input" type="checkbox" role="switch" id="large-text" checked={largeText} onChange={(e) => setLargeText(e.target.checked)} />
        <label className="form-check-label small" htmlFor="large-text">
          큰 글씨
        </label>
      </div>
    </div>
  );
}

export function Layout({ title, children }: { title: string; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = `${title} | 자산 트래커`;
  }, [title]);

  // 화면 이동 시 모바일 메뉴를 닫는다.
  useEffect(() => setMenuOpen(false), [pathname]);

  // 모바일 메뉴가 열려 있으면 Esc로 닫는다.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <>
      <div className="pc-mob-header pc-header">
        <div className="pcm-logo">
          <Brand />
        </div>
        <div className="pcm-toolbar">
          <button
            type="button"
            className="pc-head-link btn-reset"
            aria-label="메뉴 열기"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <div className={`hamburger hamburger--arrowturn${menuOpen ? ' is-active' : ''}`}>
              <div className="hamburger-box">
                <div className="hamburger-inner" />
              </div>
            </div>
          </button>
          <HeaderTools />
        </div>
      </div>

      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />

      <header className="pc-header app-desktop-header">
        <div className="header-wrapper">
          <div className="me-auto d-flex align-items-center">
            <span className="app-header-note">
              <Icon name="verified_user" className="me-2" />
              이 브라우저에만 암호화 저장됨
            </span>
          </div>
          <div className="ms-auto d-flex align-items-center">
            <HeaderTools />
          </div>
        </div>
      </header>

      <div className="pc-container">
        <div className="pcoded-content">
          <PageHeader title={title} />
          <main>{children}</main>
          <footer className="app-footer">
            <Disclaimer />
          </footer>
        </div>
      </div>
    </>
  );
}
