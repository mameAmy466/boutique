import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { IconChevronDown } from './DashboardIcons';

const WEEKDAYS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
const MONTHS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toISO(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseISO(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatPretty(value: string) {
  const date = parseISO(value);
  if (!date) return 'Choisir';
  return `${pad(date.getDate())} ${MONTHS[date.getMonth()].toLowerCase()}, ${date.getFullYear()}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function buildCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return date;
  });
}

function CalendarPanel({
  draft,
  range,
  active,
  popRef,
  style,
  onPick,
  onActivate,
  onClose,
  onConfirm,
}: {
  draft: { from: string; to: string };
  range: boolean;
  active: 'from' | 'to';
  popRef: RefObject<HTMLDivElement | null>;
  style: CSSProperties;
  onPick: (iso: string) => void;
  onActivate?: (target: 'from' | 'to') => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const seed = parseISO(active === 'to' ? draft.to || draft.from : draft.from || draft.to) ?? new Date();
  const [cursor, setCursor] = useState({ year: seed.getFullYear(), month: seed.getMonth() });
  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 16 }, (_, i) => now - 10 + i);
  }, []);
  const cells = buildCells(cursor.year, cursor.month);
  const fromTime = parseISO(draft.from)?.getTime() ?? null;
  const toTime = parseISO(draft.to)?.getTime() ?? null;

  return (
    <div className="date-pop" ref={popRef} style={style} role="dialog" aria-label="Choisir une date">
      {range && (
        <div className="date-pop-head">
          <strong>Choisir une date</strong>
          <div className="date-pop-range">
            <span>Du</span>
            <button type="button" className={`date-pill${active === 'from' ? ' is-on' : ''}`} onClick={() => onActivate?.('from')}>
              {formatPretty(draft.from)}
            </button>
            <span>Au</span>
            <button type="button" className={`date-pill${active === 'to' ? ' is-on' : ''}`} onClick={() => onActivate?.('to')}>
              {formatPretty(draft.to)}
            </button>
          </div>
        </div>
      )}
      <div className="date-cal">
        <div className="date-cal-nav">
          <label className="date-pill">
            <select
              value={cursor.month}
              onChange={(e) => setCursor((c) => ({ ...c, month: Number(e.target.value) }))}
              aria-label="Mois"
            >
              {MONTHS.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </select>
            <IconChevronDown />
          </label>
          <label className="date-pill">
            <select
              value={cursor.year}
              onChange={(e) => setCursor((c) => ({ ...c, year: Number(e.target.value) }))}
              aria-label="Année"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <IconChevronDown />
          </label>
        </div>
        <div className="date-cal-week">
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="date-cal-grid">
          {cells.map((date) => {
            const iso = toISO(date);
            const time = startOfDay(date);
            const outside = date.getMonth() !== cursor.month;
            const selected = iso === draft.from || iso === draft.to;
            const inRange =
              range && fromTime !== null && toTime !== null && time > fromTime && time < toTime;
            return (
              <button
                key={iso + String(outside)}
                type="button"
                className={`date-cal-day${outside ? ' is-out' : ''}${selected ? ' is-on' : ''}${inRange ? ' is-range' : ''}`}
                onClick={() => onPick(iso)}
              >
                {pad(date.getDate())}
              </button>
            );
          })}
        </div>
        <div className="date-cal-actions">
          <button type="button" className="date-cal-close" onClick={onClose}>
            Fermer
          </button>
          <button type="button" className="date-cal-confirm" onClick={onConfirm}>
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

function placePopover(anchor: DOMRect) {
  const width = Math.min(360, window.innerWidth - 24);
  const estimatedHeight = 430;
  let top = anchor.bottom + 8;
  if (top + estimatedHeight > window.innerHeight - 12) {
    top = Math.max(12, anchor.top - estimatedHeight - 8);
  }
  let left = anchor.left;
  if (left + width > window.innerWidth - 12) {
    left = window.innerWidth - width - 12;
  }
  return { top, left: Math.max(12, left), width };
}

function usePicker() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  function updatePos() {
    if (!ref.current) return;
    const next = placePopover(ref.current.getBoundingClientRect());
    setPos({
      position: 'fixed',
      top: next.top,
      left: next.left,
      width: next.width,
      zIndex: 80,
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      const target = event.target as Node;
      if (ref.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return { open, setOpen, ref, popRef, pos };
}

export function DateField({
  id,
  value,
  onChange,
  required,
  disabled,
  placeholder = 'Choisir une date',
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const { open, setOpen, ref, popRef, pos } = usePicker();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  return (
    <div className="date-field" ref={ref}>
      <button
        id={id}
        type="button"
        className="date-trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{value ? formatPretty(value) : placeholder}</span>
        <IconChevronDown />
      </button>
      {required && <input type="hidden" value={value} required readOnly />}
      {open &&
        createPortal(
          <CalendarPanel
            range={false}
            active="from"
            draft={{ from: draft, to: draft }}
            popRef={popRef}
            style={pos}
            onPick={setDraft}
            onClose={() => setOpen(false)}
            onConfirm={() => {
              onChange(draft);
              setOpen(false);
            }}
          />,
          document.body,
        )}
    </div>
  );
}

export function DateRangeField({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
}) {
  const { open, setOpen, ref, popRef, pos } = usePicker();
  const [draft, setDraft] = useState({ from, to });
  const [active, setActive] = useState<'from' | 'to'>('from');

  useEffect(() => {
    if (open) {
      setDraft({ from, to });
      setActive('from');
    }
  }, [open, from, to]);

  function pick(iso: string) {
    setDraft((prev) => {
      if (active === 'from') {
        const next = { from: iso, to: prev.to && prev.to < iso ? '' : prev.to };
        setActive('to');
        return next;
      }
      if (prev.from && iso < prev.from) return { from: iso, to: prev.from };
      return { ...prev, to: iso };
    });
  }

  return (
    <div className="date-field date-range" ref={ref}>
      <button type="button" className="date-trigger" onClick={() => { setActive('from'); setOpen(true); }}>
        <em>Du</em>
        <span>{from ? formatPretty(from) : 'Début'}</span>
        <IconChevronDown />
      </button>
      <button type="button" className="date-trigger" onClick={() => { setActive('to'); setOpen(true); }}>
        <em>Au</em>
        <span>{to ? formatPretty(to) : 'Fin'}</span>
        <IconChevronDown />
      </button>
      {open &&
        createPortal(
          <CalendarPanel
            range
            active={active}
            draft={draft}
            popRef={popRef}
            style={pos}
            onPick={pick}
            onActivate={setActive}
            onClose={() => setOpen(false)}
            onConfirm={() => {
              onChange(draft);
              setOpen(false);
            }}
          />,
          document.body,
        )}
    </div>
  );
}
