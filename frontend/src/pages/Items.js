import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../state/DataContext';
import { Link } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';
import './Items.css';

function Items() {
  const { items, total, loading, fetchItems } = useData();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Load data on mount and when q/page changes
  useEffect(() => {
    fetchItems({ q, offset: page * pageSize, limit: pageSize });
  }, [fetchItems, q, page, pageSize]);

  // Reset to first page whenever the search query or page size changes.
  // This avoids requesting out-of-range offsets after filters change.
  useEffect(() => {
    setPage(0);
  }, [q, pageSize]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const Row = ({ index, style }) => {
    const item = items[index];
    if (!item) return null;
    return (
      <div style={style} className="items-row">
        <Link to={'/items/' + item.id}>{item.name}</Link>
      </div>
    );
  };

  return (
    <div className="items-container">
      <form className="items-toolbar" onSubmit={e => { e.preventDefault(); setPage(0); }}>
        <label htmlFor="q">Search:&nbsp;</label>
        <input id="q" className="items-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Type to search..." />
        <label htmlFor="pageSize">Page size:&nbsp;</label>
        <select id="pageSize" className="items-select" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </form>

      {loading ? (
        <div aria-live="polite">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="skeleton-row">
              <div className="skeleton skeleton-text" />
            </div>
          ))}
        </div>
      ) : (
        <List height={400} width={'100%'} style={{ overflowX: 'hidden' }} itemCount={items.length} itemSize={40}>
          {Row}
        </List>
      )}

      <nav aria-label="Pagination" className="items-pagination">
        <button className="btn" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Prev</button>
        <span>Page {page + 1} of {pageCount}</span>
        <button className="btn" onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>Next</button>
      </nav>
    </div>
  );
}

export default Items;