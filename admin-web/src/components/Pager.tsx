export function Pager({
  page,
  lastPage,
  total,
  onChange,
}: {
  page: number;
  lastPage: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (lastPage <= 1) return null;

  return (
    <div className="pager">
      <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ← Précédent
      </button>
      <span className="hint">
        Page {page} / {lastPage} · {total} éléments
      </span>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={page >= lastPage}
        onClick={() => onChange(page + 1)}
      >
        Suivant →
      </button>
    </div>
  );
}
