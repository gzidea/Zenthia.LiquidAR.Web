import { lazy, Suspense, useEffect } from 'react';
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { FirstLoginPage } from '@/features/auth/pages/FirstLoginPage';
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AppShell } from '@/layouts/AppShell';
import { HomePage } from './HomePage';
import { SessionLifecycle } from './SessionLifecycle';
import { authService } from '@/features/auth/services/authService';
import { QueryProvider } from './QueryProvider';
const ReciboDemoPage = lazy(() =>
  import('@/features/recibo-demo/ReciboDemoPage').then((m) => ({
    default: m.ReciboDemoPage,
  })),
);
const SindicatosPage = lazy(() =>
  import('@/features/sindicatos/pages/SindicatosPage').then((module) => ({
    default: module.SindicatosPage,
  })),
);

const ReglasPage = lazy(() =>
  import('@/features/reglas-ajuste/ReglasPage').then((module) => ({
    default: module.ReglasPage,
  })),
);
const ObrasSocialesPage = lazy(() =>
  import('@/features/obras-sociales/pages/ObrasSocialesPage').then(
    (module) => ({ default: module.ObrasSocialesPage }),
  ),
);

const BancosPage = lazy(() =>
  import('@/features/bancos/pages/BancosPage').then((module) => ({
    default: module.BancosPage,
  })),
);

const SegurosParticularesPage = lazy(() =>
  import('@/features/seguros/SegurosParticularesPage').then((m) => ({
    default: m.SegurosParticularesPage,
  })),
);
const ConveniosHabilitadosPage = lazy(() =>
  import('@/features/convenios-habilitados/ConveniosHabilitadosPage').then(
    (m) => ({ default: m.ConveniosHabilitadosPage }),
  ),
);
const ConfiguracionFormulasPage = lazy(() =>
  import('@/features/formulas-empresa/ConfiguracionFormulasPage').then((m) => ({
    default: m.ConfiguracionFormulasPage,
  })),
);
const EmpresasPage = lazy(() =>
  import('@/features/empresas/pages/EmpresasPage').then((module) => ({
    default: module.EmpresasPage,
  })),
);
const ValoresGeneralesPage = lazy(() =>
  import('@/features/seguros/ValoresGeneralesPage').then((m) => ({
    default: m.ValoresGeneralesPage,
  })),
);

const ConveniosPage = lazy(() =>
  import('@/features/convenios/pages/ConveniosPage').then((module) => ({
    default: module.ConveniosPage,
  })),
);

const FormulasPage = lazy(() =>
  import('@/features/formulas/pages/FormulasPage').then((module) => ({
    default: module.FormulasPage,
  })),
);

const LegajosPage = lazy(() =>
  import('@/features/legajos/pages/LegajosPage').then((module) => ({
    default: module.LegajosPage,
  })),
);

const NovedadesPage = lazy(() =>
  import('@/features/novedades/NovedadesPage').then((m) => ({
    default: m.NovedadesPage,
  })),
);

const LiquidacionesPage = lazy(() =>
  import('@/features/liquidaciones/LiquidacionesPage').then((m) => ({
    default: m.LiquidacionesPage,
  })),
);

const RecibosPage = lazy(() =>
  import('@/features/recibos/RecibosPage').then((m) => ({
    default: m.RecibosPage,
  })),
);

const LibroSueldosPage = lazy(() =>
  import('@/features/libro-sueldos/LibroSueldosPage').then((m) => ({
    default: m.LibroSueldosPage,
  })),
);

function Gate({
  mode,
}: {
  mode: 'public' | 'session' | 'app' | 'first-login';
}) {
  const session = useAuthStore((state) => state.session);
  if (session.status === 'restore-error')
    return (
      <div className="initializing" role="alert">
        <p>No pudimos recuperar tu sesión. Probá de nuevo.</p>
        <button type="button" onClick={() => void authService.initialize()}>
          Reintentar
        </button>
        <button
          type="button"
          onClick={() => useAuthStore.getState().clear('initial')}
        >
          Ir al login
        </button>
      </div>
    );
  if (session.status === 'initializing')
    return (
      <div className="initializing" role="status">
        Preparando tu espacio…
      </div>
    );
  if (session.status === 'anonymous')
    return mode === 'public' ? <Outlet /> : <Navigate to="/login" replace />;
  const destination =
    session.status === 'password-required'
      ? session.user.firstLogin
        ? '/first-login'
        : '/change-password'
      : '/app';
  if (mode === 'public') return <Navigate to={destination} replace />;
  if (mode === 'app' && session.status === 'password-required')
    return <Navigate to={destination} replace />;
  if (
    mode === 'first-login' &&
    (session.status !== 'password-required' || !session.user.firstLogin)
  )
    return <Navigate to={destination} replace />;
  return <Outlet />;
}

function RouteFocus() {
  const { pathname } = useLocation();
  const status = useAuthStore((state) => state.session.status);
  useEffect(() => {
    const heading = document.querySelector<HTMLElement>('h1');
    heading?.focus();
    document.title = `${heading?.textContent ?? 'Acceso'} | Zenthia.LiquidAR.Web`;
  }, [pathname, status]);
  return null;
}

export function AppRoutes() {
  const { pathname } = useLocation();
  return (
    <QueryProvider>
      {pathname.replace(/\/$/, '') !== '/demo/recibo' && <SessionLifecycle />}
      <RouteFocus />
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>
      <Routes>
        <Route
          path="/demo/recibo"
          element={
            <Suspense fallback={<p role="status">Cargando simulador…</p>}>
              <ReciboDemoPage />
            </Suspense>
          }
        />
        <Route element={<AuthLayout />}>
          <Route element={<Gate mode="public" />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
          <Route element={<Gate mode="first-login" />}>
            <Route path="/first-login" element={<FirstLoginPage />} />
          </Route>
          <Route element={<Gate mode="session" />}>
            <Route path="/change-password" element={<ChangePasswordPage />} />
          </Route>
        </Route>
        <Route element={<Gate mode="app" />}>
          <Route path="/app" element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route
              path="libro-sueldos"
              element={
                <Suspense
                  fallback={<p role="status">Cargando Libro de sueldo…</p>}
                >
                  <LibroSueldosPage />
                </Suspense>
              }
            />
            <Route
              path="recibos"
              element={
                <Suspense fallback={<p role="status">Cargando recibos…</p>}>
                  <RecibosPage />
                </Suspense>
              }
            />
            <Route
              path="liquidaciones"
              element={
                <Suspense
                  fallback={<p role="status">Cargando liquidaciones…</p>}
                >
                  <LiquidacionesPage />
                </Suspense>
              }
            />
            <Route
              path="novedades"
              element={
                <Suspense fallback={<p role="status">Cargando novedades…</p>}>
                  <NovedadesPage />
                </Suspense>
              }
            />
            <Route
              path="legajos"
              element={
                <Suspense fallback={<p role="status">Cargando Legajos…</p>}>
                  <LegajosPage />
                </Suspense>
              }
            />
            <Route
              path="reglas-ajuste"
              element={
                <Suspense fallback={<p role="status">Cargando reglas…</p>}>
                  <ReglasPage />
                </Suspense>
              }
            />
            <Route
              path="formulas"
              element={
                <Suspense fallback={<p role="status">Cargando Fórmulas…</p>}>
                  <FormulasPage />
                </Suspense>
              }
            />
            <Route
              path="convenios"
              element={
                <Suspense fallback={<p role="status">Cargando Convenios…</p>}>
                  <ConveniosPage />
                </Suspense>
              }
            />
            <Route
              path="empresas/configuracion-formulas"
              element={
                <Suspense
                  fallback={
                    <p role="status">Cargando configuración de fórmulas…</p>
                  }
                >
                  <ConfiguracionFormulasPage />
                </Suspense>
              }
            />
            <Route
              path="empresas/valores-generales"
              element={
                <Suspense
                  fallback={<p role="status">Cargando valores generales…</p>}
                >
                  <ValoresGeneralesPage />
                </Suspense>
              }
            />
            <Route
              path="empresas/seguros-particulares"
              element={
                <Suspense
                  fallback={<p role="status">Cargando seguros particulares…</p>}
                >
                  <SegurosParticularesPage />
                </Suspense>
              }
            />
            <Route
              path="convenios-habilitados"
              element={
                <Suspense
                  fallback={
                    <p role="status">Cargando convenios habilitados…</p>
                  }
                >
                  <ConveniosHabilitadosPage />
                </Suspense>
              }
            />
            <Route
              path="empresas"
              element={
                <Suspense fallback={<p role="status">Cargando Empresas…</p>}>
                  <EmpresasPage />
                </Suspense>
              }
            />
            <Route
              path="sindicatos"
              element={
                <Suspense fallback={<p role="status">Cargando Sindicatos…</p>}>
                  <SindicatosPage />
                </Suspense>
              }
            />
            <Route
              path="obras-sociales"
              element={
                <Suspense
                  fallback={<p role="status">Cargando Obras Sociales…</p>}
                >
                  <ObrasSocialesPage />
                </Suspense>
              }
            />
            <Route
              path="bancos"
              element={
                <Suspense fallback={<p role="status">Cargando Bancos…</p>}>
                  <BancosPage />
                </Suspense>
              }
            />
            <Route
              path="*"
              element={
                <>
                  <h1 tabIndex={-1}>Página no encontrada</h1>
                  <Link className="text-link" to="/app">
                    Volver al inicio
                  </Link>
                </>
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </QueryProvider>
  );
}
