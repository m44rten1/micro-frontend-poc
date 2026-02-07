import { useState, useEffect } from "react";
import type { TodoChangedPayload } from "@mfe/shared/types";
import { TODO_CHANGED } from "@mfe/shared/events";

export interface HeaderProps {
  initialOpenCount: number;
  initialTotalCount: number;
}

export function Header({ initialOpenCount, initialTotalCount }: HeaderProps) {
  const [openCount, setOpenCount] = useState(initialOpenCount);
  const [totalCount, setTotalCount] = useState(initialTotalCount);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<TodoChangedPayload>).detail;
      setOpenCount(detail.openCount);
      setTotalCount(detail.totalCount);
    };
    window.addEventListener(TODO_CHANGED, handler);
    return () => window.removeEventListener(TODO_CHANGED, handler);
  }, []);

  return (
    <header className="header">
      <div className="header__inner">
        <h1 className="header__title">Todo App ✅</h1>
        <div className="header__badge">
          <span className="header__count">{openCount}</span>
          <span className="header__label">open of {totalCount}</span>
        </div>
      </div>
    </header>
  );
}
