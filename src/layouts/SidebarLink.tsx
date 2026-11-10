import { NavLink, type NavLinkProps } from 'react-router-dom';

const paths: Record<string, string> = {
  '/app/convenios-habilitados': 'M4 3h16v18H4zM8 7h8M8 11h8M8 15l2 2 4-4',
  '/app': 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  '/app/empresas': 'M4 21V3h12v18M16 10h4v11M8 7h4M8 11h4M8 15h4M8 21v-3h4v3',
  '/app/sindicatos':
    'M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 21v-4a6 6 0 0 1 12 0v4M16 4a3 3 0 0 1 0 6M18 13a5 5 0 0 1 4 5v3',
  '/app/obras-sociales': 'M8 3h8v5h5v8h-5v5H8v-5H3V8h5z',
  '/app/convenios': 'M4 3h16v18H4zM8 7h8M8 11h8M8 15h5',
  '/app/novedades': 'M12 3v12M6 9l6 6 6-6M3 17v4h18v-4',
  '/app/liquidaciones':
    'M5 2h14v20H5zM8 6h8M8 11h1M15 11h1M8 15h1M15 15h1M8 19h1M15 19h1',
  '/app/recibos': 'M5 3h14v19l-3-2-4 2-4-2-3 2zM8 7h8M8 11h8M8 15h5',
  '/app/legajos': 'M3 6h7l2 3h9v12H3zM9 15a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z',
  '/app/libro-sueldos':
    'M12 5v16M12 5C8 2 4 3 2 4v16c3-1 7-1 10 1 3-2 7-2 10-1V4c-2-1-6-2-10 1Z',
  '/app/formulas': 'M18 3h-6l-4 18H4M5 9h12M15 14l6 7M21 14l-6 7',
  '/app/reglas-ajuste': 'M3 6h18M3 12h18M3 18h18M7 3v6M16 9v6M10 15v6',
  '/app/bancos': 'M2 8l10-6 10 6H2ZM4 11v8M9 11v8M15 11v8M20 11v8M2 22h20',
};

// A leaf stays independent of its future parent/group; routes and permissions live in AppShell.
export function SidebarLink({
  children,
  to,
  showIcon = true,
  ...props
}: NavLinkProps & { showIcon?: boolean }) {
  return (
    <NavLink
      {...props}
      to={to}
      end={to === '/app' || to === '/app/empresas'}
      title={typeof children === 'string' ? children.trim() : undefined}
      className="sidebar-link"
    >
      {showIcon && (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d={paths[String(to)]} />
        </svg>
      )}
      <span className="sidebar-label">{children as React.ReactNode}</span>
    </NavLink>
  );
}
