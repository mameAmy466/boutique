import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Product, ProductBatch } from '../api/types';
import { IconBox, IconSearch, IconTag } from './DashboardIcons';

export function SearchBox() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function handleOpen() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
    if (!loaded) {
      Promise.all([api.get<Product[]>('/products'), api.get<ProductBatch[]>('/stocks')])
        .then(([p, b]) => {
          setProducts(p);
          setBatches(b);
          setLoaded(true);
        })
        .catch(() => {});
    }
  }

  const needle = query.trim().toLowerCase();

  const productResults = useMemo(() => {
    if (needle.length < 2) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(needle) || p.reference.toLowerCase().includes(needle))
      .slice(0, 5);
  }, [products, needle]);

  const batchResults = useMemo(() => {
    if (needle.length < 2) return [];
    return batches.filter((b) => b.batch_code.toLowerCase().includes(needle)).slice(0, 5);
  }, [batches, needle]);

  const hasResults = productResults.length > 0 || batchResults.length > 0;

  return (
    <div className="dropdown-wrap" ref={ref}>
      <button type="button" className="icon-btn" onClick={handleOpen} aria-label="Recherche" title="Recherche">
        <IconSearch />
      </button>
      {open && (
        <div className="dropdown-menu search-dropdown">
          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher un produit ou un lot…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
          />
          {needle.length >= 2 && !hasResults && (
            <p className="hint" style={{ padding: '10px 14px' }}>Aucun résultat.</p>
          )}
          {productResults.length > 0 && (
            <>
              <div className="dropdown-title">Produits</div>
              {productResults.map((p) => (
                <Link key={p.id} to="/products" className="search-row" onClick={() => setOpen(false)}>
                  <IconTag />
                  <span className="notif-desc">{p.name}</span>
                  <span className="notif-qty mono">{p.reference}</span>
                </Link>
              ))}
            </>
          )}
          {batchResults.length > 0 && (
            <>
              <div className="dropdown-title">Lots de stock</div>
              {batchResults.map((b) => (
                <Link key={b.id} to="/stocks" className="search-row" onClick={() => setOpen(false)}>
                  <IconBox />
                  <span className="notif-desc mono">{b.batch_code}</span>
                  <span className="notif-qty">{b.product?.name ?? ''}</span>
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
