import { COLOR_THEMES, useTheme } from '../context/ThemeContext';
import { IconMoon, IconSun } from './DashboardIcons';

export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const { theme, color, toggleTheme, setColor } = useTheme();

  return (
    <div className={`theme-picker${compact ? ' is-compact' : ''}`}>
      <div className="theme-mode-row">
        <button
          type="button"
          className={`theme-mode-btn${theme === 'light' ? ' is-on' : ''}`}
          aria-pressed={theme === 'light'}
          aria-label="Thème clair"
          onClick={() => theme !== 'light' && toggleTheme()}
        >
          <IconSun /> {!compact && 'Clair'}
        </button>
        <button
          type="button"
          className={`theme-mode-btn${theme === 'dark' ? ' is-on' : ''}`}
          aria-pressed={theme === 'dark'}
          aria-label="Thème sombre"
          onClick={() => theme !== 'dark' && toggleTheme()}
        >
          <IconMoon /> {!compact && 'Sombre'}
        </button>
      </div>

      <p className={compact ? 'dropdown-title' : 'theme-picker-label'}>Couleur du thème</p>
      <div className="theme-swatches" role="listbox" aria-label="Couleur du thème">
        {COLOR_THEMES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={color === item.id}
            className={`theme-swatch${color === item.id ? ' is-on' : ''}`}
            style={{ background: item.swatch }}
            title={item.label}
            onClick={() => setColor(item.id)}
          >
            <span className="sr-only">{item.label}</span>
          </button>
        ))}
      </div>
      {!compact && (
        <p className="theme-picker-current">
          {COLOR_THEMES.find((item) => item.id === color)?.label} · {theme === 'dark' ? 'sombre' : 'clair'}
        </p>
      )}
    </div>
  );
}
