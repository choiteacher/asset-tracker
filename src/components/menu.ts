// 사이드바 메뉴. 열람(보기) 화면과 입력(관리) 화면을 그룹으로 나눈다.

export interface MenuItem {
  id: string;
  title: string;
  url: string;
  icon: string;
}

export interface MenuGroup {
  id: string;
  title: string;
  subtitle: string;
  items: MenuItem[];
}

export const MENU: MenuGroup[] = [
  {
    id: 'view',
    title: '보기',
    subtitle: '열람 화면',
    items: [
      { id: 'dashboard', title: '대시보드', url: '/', icon: 'dashboard' },
      { id: 'housing', title: '분양 D-day', url: '/housing', icon: 'home' },
      { id: 'history', title: '자산 기록', url: '/history', icon: 'timeline' },
    ],
  },
  {
    id: 'manage',
    title: '관리',
    subtitle: '등록·수정 화면',
    items: [
      { id: 'assets', title: '자산 관리', url: '/assets', icon: 'account_balance_wallet' },
      { id: 'loans', title: '대출 관리', url: '/loans', icon: 'credit_card' },
      { id: 'housing-edit', title: '분양 일정', url: '/housing/edit', icon: 'event' },
      { id: 'settings', title: '설정', url: '/settings', icon: 'settings' },
    ],
  },
];

/** 현재 경로에 해당하는 메뉴(브레드크럼용). 하위 경로(/assets/new 등)는 상위 메뉴로 묶는다. */
export function findMenu(pathname: string): { group: MenuGroup; item: MenuItem } | null {
  for (const group of MENU) {
    const exact = group.items.find((item) => item.url === pathname);
    if (exact) return { group, item: exact };
  }
  for (const group of MENU) {
    for (const item of group.items) {
      if (item.url === '/' ? pathname === '/' : pathname === item.url || pathname.startsWith(`${item.url}/`)) {
        return { group, item };
      }
    }
  }
  return null;
}
