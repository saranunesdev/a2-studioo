import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ICON, Logo } from './ui';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

/** Barra lateral no computador, barra inferior no celular. */
export function Shell({ items, children, badge, onExit }: { items: NavItem[]; children: ReactNode; badge?: string; onExit?: () => void }) {
  const nav = useNavigate();
  const link = (it: NavItem) => (
    <NavLink key={it.to} to={it.to} end={it.end} className="navbtn" aria-label={it.label}>
      {ICON[it.icon]}
      <span className="lbl">{it.label}</span>
    </NavLink>
  );
  return (
    <div className="shell">
      <a href="#main" className="skip">Pular para o conteúdo</a>
      <aside className="sidenav" aria-label="Menu">
        <div style={{ padding: '0 8px 28px' }}><Logo size={130} /></div>
        {badge && <span className="tag quiet" style={{ alignSelf: 'flex-start', margin: '0 14px 12px' }}>{badge}</span>}
        <nav aria-label="Principal" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{items.map(link)}</nav>
        <div style={{ marginTop: 'auto' }}>
          <button className="navbtn" onClick={() => (onExit ? onExit() : nav('/'))} aria-label="Sair">
            {ICON.sair}<span className="lbl">Sair</span>
          </button>
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>{children}</div>
      <nav className="bottomnav" aria-label="Principal">
        <div className="in">{items.map(link)}</div>
      </nav>
    </div>
  );
}

export function TopBar({ title, back, right, mark = true }: { title: string; back?: () => void; right?: ReactNode; mark?: boolean }) {
  return (
    <header className="topbar">
      <div className="in">
        {back ? (
          <button className="iconbtn" onClick={back} aria-label="Voltar">←</button>
        ) : mark ? (
          <span className="mobile-mark" aria-hidden="true"><Logo size={56} word={false} label={false} /></span>
        ) : null}
        <h1>{title}</h1>
        {right}
      </div>
    </header>
  );
}
