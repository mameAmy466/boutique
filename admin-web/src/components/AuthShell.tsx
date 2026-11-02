import type { ReactNode } from 'react';
import { Logo } from './Logo';

/** The green two-column frame of the login page, for the other signed-out pages. */
export function AuthShell({ title, intro, cardTitle, children }: { title: string; intro: ReactNode; cardTitle: string; children: ReactNode }) {
  return (
    <div className="login-shell">
      <div className="login-decor" aria-hidden="true">
        <span className="login-shape login-shape-ring" />
        <span className="login-shape login-shape-pill" />
        <span className="login-shape login-shape-line" />
        <span className="login-shape login-shape-arc" />
        <span className="login-shape login-shape-dot" />
      </div>

      <div className="login-panel">
        <div className="login-welcome">
          <div className="login-brand">
            <Logo size={36} />
            <span>Boutique</span>
          </div>
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>

        <div className="login-form-card">
          <h2>{cardTitle}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}
