import { ShellFrame } from '@zenthia/app-shell/ShellFrame';
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SidebarLink } from './SidebarLink';
import { SidebarFooter } from './SidebarFooter';
import { useMediaQuery } from './useMediaQuery';
import { Brand } from '@/components/Brand';
import { EmpresaGlobalSelector } from '@/features/empresas/components/EmpresaGlobalSelector';
import { TenantGlobalSelector } from '@/features/tenants/TenantGlobalSelector';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { useLiquidacionesCapacidades } from '@/features/liquidaciones/hooks';

export function AppShell() {
  const location = useLocation();
  const [empresasOpen, setEmpresasOpen] = useState(
    location.pathname.startsWith('/app/empresas'),
  );
  const permissions = usePermissions();
  const canReadEmpresas = permissions.can('empresas:read');
  const canReadFormulasEmpresa = permissions.can('empresas-formulas:read');
  const empresasSubmenus = [
    { to: '/app/empresas', label: 'Empresas', visible: canReadEmpresas },
    {
      to: '/app/empresas/valores-generales',
      label: 'Valores Generales SCVO / FFEP',
      visible: permissions.can('seguros-generales:read'),
    },
    {
      to: '/app/empresas/seguros-particulares',
      label: 'Seguros Particulares SCVO / ART',
      visible: permissions.can('seguros-particulares:read'),
    },
    {
      to: '/app/empresas/configuracion-formulas',
      label: 'Configuración de Fórmulas',
      visible: canReadFormulasEmpresa,
    },
  ].filter((submenu) => submenu.visible);
  const liquidaciones = useLiquidacionesCapacidades();
  const session = useAuthStore((state) => state.session);
  const { sidebarOpen, sidebarCollapsed, toggleSidebar, toggleCollapsed } =
    useUiStore();
  const mobile = useMediaQuery('(max-width: 760px)');
  const expanded = mobile ? sidebarOpen : !sidebarCollapsed;
  const toggle = mobile ? toggleSidebar : toggleCollapsed;
  const name =
    permissions.data?.displayName ||
    ('user' in session ? session.user.userName : 'Usuario');
  const words = name.trim().split(/\s+/);
  const initials = (
    words.length > 1
      ? (words[0]?.charAt(0) ?? '') + (words.at(-1)?.charAt(0) ?? '')
      : name.slice(0, 2)
  ).toLocaleUpperCase('es');
  return (
    <ShellFrame
      sidebarOpen={sidebarOpen}
      sidebarCollapsed={sidebarCollapsed}
      header={
        <>
          {' '}
          <button
            type="button"
            className="navbar-menu-placeholder sidebar-toggle"
            aria-label={
              expanded ? 'Contraer menú lateral' : 'Expandir menú lateral'
            }
            aria-controls="app-sidebar"
            aria-expanded={expanded}
            onClick={toggle}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16M13 9l3 3-3 3" />
            </svg>
          </button>
          <Brand />
          {permissions.data?.isSuperAdmin && <TenantGlobalSelector />}
          <EmpresaGlobalSelector
            enabled={canReadEmpresas || canReadFormulasEmpresa}
            formulasOnly={!canReadEmpresas}
          />
          <div className="navbar-account">
            <button
              type="button"
              className="navbar-icon-placeholder"
              disabled
              aria-label="Notificaciones recibidas"
              title="Notificaciones recibidas (próximamente)"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4M12 2V1" />
              </svg>
            </button>
            <button
              type="button"
              className="navbar-icon-placeholder"
              disabled
              aria-label="Cambiar claro/oscuro"
              title="Cambiar claro/oscuro (próximamente)"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="5" />
                <path
                  d="M12 7a5 5 0 0 0 0 10Z"
                  fill="currentColor"
                  stroke="none"
                />
                <path d="M12 1v2m0 18v2M1 12h2m18 0h2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
              </svg>
            </button>
          </div>
          <Button
            className="menu-toggle"
            variant="ghost"
            aria-controls="app-sidebar"
            aria-expanded={sidebarOpen}
            onClick={toggleSidebar}
          >
            Menú
          </Button>
        </>
      }
      navigation={
        <>
          <SidebarLink
            to="/app"
            onClick={() => {
              if (mobile) useUiStore.setState({ sidebarOpen: false });
            }}
          >
            Inicio
          </SidebarLink>
          {empresasSubmenus.length > 0 && (
            <div className="sidebar-group">
              <button
                type="button"
                className="sidebar-link"
                title="Empresas"
                aria-expanded={empresasOpen && expanded}
                aria-controls="empresas-submenu"
                onClick={() => {
                  if (!mobile && sidebarCollapsed) {
                    toggleCollapsed();
                    setEmpresasOpen(true);
                  } else setEmpresasOpen(!empresasOpen);
                }}
              >
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
                  <path d="M4 21V3h12v18M16 10h4v11M8 7h4M8 11h4M8 15h4M8 21v-3h4v3" />
                </svg>
                <span className="sidebar-label">Empresas</span>
                <svg
                  className="sidebar-label sidebar-group-chevron"
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M3 5h10a1 1 0 0 1 .8 1.6l-5 6a1 1 0 0 1-1.6 0l-5-6A1 1 0 0 1 3 5Z" />
                </svg>
              </button>
              <div
                id="empresas-submenu"
                className="sidebar-submenu"
                hidden={!empresasOpen}
              >
                {empresasSubmenus.map((submenu) => (
                  <SidebarLink
                    key={submenu.to}
                    to={submenu.to}
                    showIcon={false}
                    onClick={() => {
                      if (mobile) useUiStore.setState({ sidebarOpen: false });
                    }}
                  >
                    {submenu.label}
                  </SidebarLink>
                ))}
              </div>
            </div>
          )}
          {permissions.can('habilitar-convenio:read') && (
            <SidebarLink
              to="/app/convenios-habilitados"
              onClick={() => {
                if (mobile) useUiStore.setState({ sidebarOpen: false });
              }}
            >
              Convenios habilitados
            </SidebarLink>
          )}
          {permissions.can('sindicatos:read') && (
            <SidebarLink
              to="/app/sindicatos"
              onClick={() => {
                if (mobile) useUiStore.setState({ sidebarOpen: false });
              }}
            >
              Sindicatos
            </SidebarLink>
          )}
          {permissions.can('obrassociales:read') && (
            <SidebarLink
              to="/app/obras-sociales"
              onClick={() => {
                if (mobile) useUiStore.setState({ sidebarOpen: false });
              }}
            >
              Obras Sociales
            </SidebarLink>
          )}
          {permissions.can('convenios:read') && (
            <SidebarLink
              to="/app/convenios"
              onClick={() => {
                if (mobile) useUiStore.setState({ sidebarOpen: false });
              }}
            >
              Convenios
            </SidebarLink>
          )}
          {permissions.can('novedades:read') && (
            <SidebarLink
              to="/app/novedades"
              onClick={() => {
                if (mobile) useUiStore.setState({ sidebarOpen: false });
              }}
            >
              Novedades
            </SidebarLink>
          )}
          {liquidaciones.data?.generar && (
            <SidebarLink
              to="/app/liquidaciones"
              onClick={() => {
                if (mobile) useUiStore.setState({ sidebarOpen: false });
              }}
            >
              Liquidaciones
            </SidebarLink>
          )}
          {liquidaciones.data?.leer && (
            <SidebarLink
              to="/app/recibos"
              onClick={() => {
                if (mobile) useUiStore.setState({ sidebarOpen: false });
              }}
            >
              Recibos
            </SidebarLink>
          )}
          {permissions.can('legajo:read') && (
            <SidebarLink
              to="/app/legajos"
              onClick={() => {
                if (mobile) useUiStore.setState({ sidebarOpen: false });
              }}
            >
              Legajos
            </SidebarLink>
          )}
          {permissions.can('ls.read') && (
            <SidebarLink
              to="/app/libro-sueldos"
              onClick={() => {
                if (mobile) useUiStore.setState({ sidebarOpen: false });
              }}
            >
              Libro de sueldo
            </SidebarLink>
          )}
          {permissions.can('formulas:read') && (
            <SidebarLink
              to="/app/formulas"
              onClick={() => {
                if (mobile) useUiStore.setState({ sidebarOpen: false });
              }}
            >
              Fórmulas
            </SidebarLink>
          )}
          {permissions.can('reglas-ajustes:read') && (
            <SidebarLink
              to="/app/reglas-ajuste"
              onClick={() => {
                if (mobile) useUiStore.setState({ sidebarOpen: false });
              }}
            >
              Reglas de ajuste
            </SidebarLink>
          )}
          {permissions.can('bancos:read') && (
            <SidebarLink
              to="/app/bancos"
              onClick={() => {
                if (mobile) useUiStore.setState({ sidebarOpen: false });
              }}
            >
              Bancos
            </SidebarLink>
          )}
        </>
      }
      footer={
        <>
          {permissions.isError && (
            <Button variant="ghost" onClick={() => void permissions.refetch()}>
              Reintentar permisos
            </Button>
          )}
          {liquidaciones.isError && (
            <Button
              variant="ghost"
              onClick={() => void liquidaciones.refetch()}
            >
              Reintentar acceso a Liquidaciones
            </Button>
          )}
          <SidebarFooter name={name} initials={initials} />
        </>
      }
    >
      <Outlet />
    </ShellFrame>
  );
}
