import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function ItemDetail() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    const url = 'http://localhost:3001/api/items/' + id;
    fetch(url, { signal: controller.signal })
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(setItem)
      .catch(err => {
        if (err && err.name === 'AbortError') return;
        // On real error, navigate back to list
        navigate('/');
      });
    return () => controller.abort();
  }, [id, navigate]);

  if (!item) return (
    <div style={{ padding: 16 }}>
      <button
        onClick={() => navigate(-1)}
        aria-label="Go back"
        title="Back"
        style={{
          appearance: 'none',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          background: '#fff',
          padding: '6px 10px',
          cursor: 'pointer',
          marginBottom: 12
        }}
      >
        ←
      </button>
      <div className="skeleton skeleton-title" style={{ marginBottom: 20, marginTop: 20, height: '28px' }} />
      <div className="skeleton skeleton-line" style={{height: '18px'}} />
      <div className="skeleton skeleton-line" style={{height: '18px'}} />
    </div>
  );

  return (
    <div style={{padding: 16}}>
      <button
        onClick={() => navigate(-1)}
        aria-label="Go back"
        title="Back"
        style={{
          appearance: 'none',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          background: '#fff',
          padding: '6px 10px',
          cursor: 'pointer',
          marginBottom: 12
        }}
      >
        ←
      </button>
      <h2>{item.name}</h2>
      <p><strong>Category:</strong> {item.category}</p>
      <p><strong>Price:</strong> ${item.price}</p>
    </div>
  );
}

export default ItemDetail;