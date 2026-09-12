import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { api, ApiError } from '../api/client';
import type { CashRegister, CashSession, PaymentMethod, ProductBatch, Sale, Shop } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { InvoiceReceipt } from '../components/InvoiceReceipt';
import { formatDate, formatMoney } from '../lib/format';
import { IconRegister } from '../components/DashboardIcons';

const BarcodeScannerModal = lazy(() =>
  import('../components/BarcodeScannerModal').then((m) => ({ default: m.BarcodeScannerModal })),
);

const STATUS_BADGE: Record<Sale['status'], string> = {
  completed: 'ok',
  cancelled: 'bad',
  returned: 'warn',
  partially_returned: 'warn',
};
const STATUS_LABEL: Record<Sale['status'], string> = {
  completed: 'Validée',
  cancelled: 'Annulée',
  returned: 'Retournée',
  partially_returned: 'Retour partiel',
};
const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  card: 'Carte',
  wave: 'Wave',
  orange_money: 'Orange Money',
  free_money: 'Free Money',
  transfer: 'Virement',
  other: 'Autre',
};

interface Line {
  product_batch_id: string;
  quantity: string;
  unit_price: string;
}

export function SalesPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [openSession, setOpenSession] = useState<CashSession | null | undefined>(undefined);
  const [registers, setRegisters] = useState<CashRegister[]>([]);

  const [shopId, setShopId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [customerName, setCustomerName] = useState('');
  const [lines, setLines] = useState<Line[]>([{ product_batch_id: '', quantity: '1', unit_price: '' }]);
  const [openingAmount, setOpeningAmount] = useState('0');
  const [registerId, setRegisterId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [scanInput, setScanInput] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  function loadSales() {
    setLoading(true);
    api
      .get<{ data: Sale[] }>('/sales')
      .then((res) => setSales(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  useEffect(loadSales, []);

  useEffect(() => {
    if (isSuperAdmin) {
      api.get<Shop[]>('/shops').then(setShops);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!showNew) return;
    setShopId(user?.shop_id ? String(user.shop_id) : '');
    api.get<Shop[]>('/shops').then(setShops);
    api
      .get<CashSession[]>('/cash-sessions')
      .then((sessions) => setOpenSession(sessions.find((s) => s.status === 'open' && s.user_id === user?.id) ?? null));
  }, [showNew, user]);

  useEffect(() => {
    if (!shopId) return;
    api.get<ProductBatch[]>(`/stocks?shop_id=${shopId}`).then(setBatches);
    api.get<CashRegister[]>(`/cash-registers?shop_id=${shopId}`).then(setRegisters);
  }, [shopId]);

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.unit_price || 0), 0),
    [lines],
  );

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { product_batch_id: '', quantity: '1', unit_price: '' }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function applyScannedCode(rawCode: string) {
    const code = rawCode.trim();
    if (!code) return;

    const batch = batches.find((b) => b.batch_code.toLowerCase() === code.toLowerCase());
    if (!batch) {
      setScanError(`Aucun lot trouvé pour le code « ${code} » dans cette boutique.`);
      return;
    }
    if (batch.quantity_available === 0) {
      setScanError(`${batch.product?.name ?? batch.batch_code} : rupture de stock sur ce lot.`);
      return;
    }

    setScanError(null);
    setLines((prev) => {
      const existingIndex = prev.findIndex((l) => l.product_batch_id === String(batch.id));
      if (existingIndex !== -1) {
        return prev.map((l, i) =>
          i === existingIndex ? { ...l, quantity: String(Number(l.quantity || 0) + 1) } : l,
        );
      }
      const emptyIndex = prev.findIndex((l) => !l.product_batch_id);
      const filledLine: Line = { product_batch_id: String(batch.id), quantity: '1', unit_price: batch.min_price };
      if (emptyIndex !== -1) {
        return prev.map((l, i) => (i === emptyIndex ? filledLine : l));
      }
      return [...prev, filledLine];
    });

    setScanInput('');
    scanInputRef.current?.focus();
  }

  function handleScanKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyScannedCode(scanInput);
    }
  }

  async function handleOpenSession() {
    setFormError(null);
    if (!registerId) {
      setFormError('Choisis une caisse.');
      return;
    }
    try {
      const session = await api.post<CashSession>('/cash-sessions/open', {
        cash_register_id: Number(registerId),
        opening_amount: Number(openingAmount || 0),
      });
      setOpenSession(session);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Impossible d’ouvrir la caisse.');
    }
  }

  async function handleCreateRegister() {
    setFormError(null);
    try {
      const register = await api.post<CashRegister>('/cash-registers', {
        shop_id: Number(shopId),
        name: `Caisse ${registers.length + 1}`,
      });
      setRegisters((prev) => [...prev, register]);
      setRegisterId(String(register.id));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Impossible de créer la caisse.');
    }
  }

  async function handleSubmitSale(e: FormEvent) {
    e.preventDefault();
    if (!openSession) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await api.post<Sale>('/sales', {
        shop_id: Number(shopId),
        cash_session_id: openSession.id,
        payment_method: paymentMethod,
        customer_name: customerName || undefined,
        items: lines
          .filter((l) => l.product_batch_id)
          .map((l) => ({
            product_batch_id: Number(l.product_batch_id),
            quantity: Number(l.quantity),
            unit_price: Number(l.unit_price),
          })),
      });
      const detailed = await api.get<Sale>(`/sales/${created.id}`);
      setCompletedSale(detailed);
      loadSales();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erreur inattendue.');
    } finally {
      setSubmitting(false);
    }
  }

  function startNextSale() {
    setCompletedSale(null);
    setLines([{ product_batch_id: '', quantity: '1', unit_price: '' }]);
    setCustomerName('');
  }

  function closeSaleModal() {
    setShowNew(false);
    setCompletedSale(null);
    setLines([{ product_batch_id: '', quantity: '1', unit_price: '' }]);
    setCustomerName('');
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon">
            <IconRegister />
          </div>
          <div>
            <h1>Ventes</h1>
            <p>{sales.length} vente{sales.length > 1 ? 's' : ''} récente{sales.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          + Nouvelle vente
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="table-wrap table-scroll cards-sm">
        <table>
          <thead>
            <tr>
              <th>N° vente</th>
              {isSuperAdmin && <th>Boutique</th>}
              <th>Vendeur</th>
              <th>Paiement</th>
              <th>Total</th>
              <th>Statut</th>
              <th>Facture</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="empty-row">
                <td colSpan={isSuperAdmin ? 8 : 7}>Chargement…</td>
              </tr>
            )}
            {!loading && sales.length === 0 && (
              <tr className="empty-row">
                <td colSpan={isSuperAdmin ? 8 : 7}>Aucune vente enregistrée.</td>
              </tr>
            )}
            {sales.map((s) => (
              <tr key={s.id}>
                <td className="mono" data-label="N° vente">{s.sale_number}</td>
                {isSuperAdmin && (
                  <td data-label="Boutique">{shops.find((sh) => sh.id === s.shop_id)?.name ?? `#${s.shop_id}`}</td>
                )}
                <td data-label="Vendeur">{s.user?.name ?? `#${s.user_id}`}</td>
                <td data-label="Paiement">{PAYMENT_LABEL[s.payment_method]}</td>
                <td className="num" data-label="Total">{formatMoney(s.total)}</td>
                <td data-label="Statut">
                  <span className={`badge ${STATUS_BADGE[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                </td>
                <td className="mono" data-label="Facture">{s.invoice?.invoice_number ?? '—'}</td>
                <td data-label="Date">{formatDate(s.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && (
        <Modal title={completedSale ? 'Vente enregistrée' : 'Nouvelle vente'} onClose={closeSaleModal}>
          {completedSale ? (
            <>
              <div className="alert success" style={{ marginBottom: 16 }}>
                Vente {completedSale.sale_number} validée — facture {completedSale.invoice?.invoice_number}.
              </div>

              <InvoiceReceipt
                sale={completedSale}
                shop={shops.find((s) => s.id === completedSale.shop_id) ?? user?.shop ?? null}
              />

              <div className="form-actions" style={{ marginTop: 20, justifyContent: 'center' }}>
                <button type="button" className="btn btn-ghost" onClick={closeSaleModal}>
                  Ne pas imprimer
                </button>
                <button type="button" className="btn" onClick={() => window.print()}>
                  🖨️ Imprimer la facture
                </button>
                <button type="button" className="btn btn-primary" onClick={startNextSale}>
                  Nouvelle vente
                </button>
              </div>
            </>
          ) : (
            <>
          {formError && <div className="alert error">{formError}</div>}

          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="sale-shop">Boutique</label>
            <select id="sale-shop" value={shopId} onChange={(e) => setShopId(e.target.value)} disabled={!isSuperAdmin}>
              <option value="">— choisir —</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {!shopId && <p className="hint">Choisis une boutique pour continuer.</p>}

          {shopId && openSession === undefined && <p className="hint">Vérification de la caisse…</p>}

          {shopId && openSession === null && (
            <div className="card" style={{ marginBottom: 16 }}>
              <p style={{ marginTop: 0 }} className="hint">
                Aucune session de caisse ouverte pour ton compte. Ouvre une caisse pour enregistrer une vente.
              </p>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="register">Caisse</label>
                  <select id="register" value={registerId} onChange={(e) => setRegisterId(e.target.value)}>
                    <option value="">— choisir —</option>
                    {registers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="opening">Fond de caisse</label>
                  <input id="opening" type="number" min={0} value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-sm" onClick={handleCreateRegister}>
                  + Nouvelle caisse
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenSession}>
                  Ouvrir la caisse
                </button>
              </div>
            </div>
          )}

          {shopId && openSession && (
            <form onSubmit={handleSubmitSale}>
              <div className="form-grid" style={{ marginBottom: 14 }}>
                <div className="field">
                  <label htmlFor="sale-payment">Mode de paiement</label>
                  <select id="sale-payment" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                    {Object.entries(PAYMENT_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="sale-customer">Client (optionnel)</label>
                  <input id="sale-customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>
              </div>

              <div className="section-title" style={{ marginTop: 0 }}>Articles</div>

              <div className="scan-bar">
                <input
                  ref={scanInputRef}
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={handleScanKeyDown}
                  placeholder="Scanner (douchette) ou saisir le code du lot, puis Entrée…"
                  autoFocus
                />
                <button type="button" className="btn btn-sm" onClick={() => setShowCamera(true)}>
                  📷 Scanner
                </button>
              </div>
              {scanError && <div className="alert error">{scanError}</div>}

              {lines.map((line, i) => {
                const batch = batches.find((b) => b.id === Number(line.product_batch_id));
                return (
                  <div key={i} className="line-item-row">
                    <div className="field">
                      <label>Lot</label>
                      <select
                        value={line.product_batch_id}
                        onChange={(e) => updateLine(i, { product_batch_id: e.target.value })}
                        required
                      >
                        <option value="">— choisir —</option>
                        {batches.map((b) => (
                          <option key={b.id} value={b.id} disabled={b.quantity_available === 0}>
                            {b.product?.name ?? b.batch_code} — dispo {b.quantity_available} — min {formatMoney(b.min_price)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Qté</label>
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateLine(i, { quantity: e.target.value })}
                        required
                      />
                    </div>
                    <div className="field">
                      <label>Prix unitaire</label>
                      <input
                        type="number"
                        min={batch ? Number(batch.min_price) : 0}
                        value={line.unit_price}
                        onChange={(e) => updateLine(i, { unit_price: e.target.value })}
                        required
                      />
                    </div>
                    <div className="field">
                      <label>Ligne</label>
                      <div className="num" style={{ padding: '8px 0' }}>
                        {formatMoney(Number(line.quantity || 0) * Number(line.unit_price || 0))}
                      </div>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeLine(i)} aria-label="Retirer">
                      ×
                    </button>
                  </div>
                );
              })}
              <button type="button" className="btn btn-sm" onClick={addLine} style={{ marginBottom: 16 }}>
                + Ajouter un article
              </button>

              <div className="alert success">
                Total de la vente : <strong className="num">{formatMoney(total)}</strong>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={closeSaleModal}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Enregistrement…' : 'Valider la vente'}
                </button>
              </div>
            </form>
          )}
            </>
          )}
        </Modal>
      )}

      {showCamera && (
        <Suspense fallback={null}>
          <BarcodeScannerModal
            onDetected={(code) => {
              setShowCamera(false);
              applyScannedCode(code);
            }}
            onClose={() => setShowCamera(false)}
          />
        </Suspense>
      )}
    </>
  );
}
