// 보기 모드 / 편집 모드. 메모리에만 두며, 잠그면(잠금 해제 화면이 내려가면) 보기 모드로 돌아간다.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from '../components/Icon';
import { MainCard } from '../components/MainCard';

interface EditModeValue {
  editMode: boolean;
  /** 편집 모드로 들어갈 때는 한 번 더 확인한다. 확인하면 true. */
  requestEdit(): boolean;
  exitEdit(): void;
}

const Context = createContext<EditModeValue | null>(null);

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [editMode, setEditMode] = useState(false);
  const requestEdit = useCallback(() => {
    if (!window.confirm('편집 모드로 전환할까요? 자산·대출·분양 일정과 설정을 바꿀 수 있게 됩니다.')) return false;
    setEditMode(true);
    return true;
  }, []);
  const exitEdit = useCallback(() => setEditMode(false), []);
  const value = useMemo(() => ({ editMode, requestEdit, exitEdit }), [editMode, requestEdit, exitEdit]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useEditMode(): EditModeValue {
  const value = useContext(Context);
  if (!value) throw new Error('EditModeProvider 안에서만 사용할 수 있습니다.');
  return value;
}

/** 편집 화면 보호: 보기 모드면 내용을 보여주지 않고 전환 버튼만 보여준다. */
export function EditGate({ children }: { children: ReactNode }) {
  const { editMode, requestEdit } = useEditMode();
  if (editMode) return <>{children}</>;
  return (
    <MainCard title="보기 모드입니다">
      <p className="text-muted">이 화면은 데이터를 등록·수정하는 곳입니다. 실수로 바꾸지 않도록 편집 모드에서만 열립니다.</p>
      <div className="d-flex gap-2 flex-wrap">
        <button type="button" className="btn btn-primary d-inline-flex align-items-center" onClick={requestEdit}>
          <Icon name="edit" className="app-btn-icon me-1" />
          편집 모드로 전환
        </button>
        <Link to="/" className="btn btn-outline-secondary">
          대시보드로
        </Link>
      </div>
    </MainCard>
  );
}
