import { useCallback, useEffect, useState } from 'react';

function currentPath(): string {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

export function usePath() {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onPop = () => setPath(currentPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string) => {
    const next = to.replace(/\/+$/, '') || '/';
    if (next === currentPath()) return;
    window.history.pushState({}, '', next);
    setPath(next);
  }, []);

  return { path, navigate };
}
