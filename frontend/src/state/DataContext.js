import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const DataContext = createContext();

export function DataProvider({ children }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef();

  const fetchItems = useCallback(async ({ q = '', offset = 0, limit = 50 } = {}) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      params.set('offset', String(offset));
      params.set('limit', String(limit));
      const res = await fetch(`http://localhost:3001/api/items?${params.toString()}`, {
        signal: controller.signal
      });
      const json = await res.json();
      const totalHeader = res.headers.get('x-total-count');
      setTotal(Number(totalHeader || json.length));
      setItems(json);
    } catch (e) {
      if (e.name !== 'AbortError') {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
        abortRef.current = undefined;
      }
    }
  }, []);

  return (
    <DataContext.Provider value={{ items, total, loading, fetchItems }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);