import { useEffect, useRef, useState } from 'react';
import { useIsMutating, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import {
  useTenantContextStore,
  type TenantSeleccionado,
} from '@/stores/tenantContextStore';
import { useEmpresaContextStore } from '@/stores/empresaContextStore';
import { listActiveTenants } from './service';

export function TenantGlobalSelector() {
  const { tenant, seleccionar } = useTenantContextStore();
  const locked = useEmpresaContextStore((s) => s.seleccionBloqueada);
  const mutations = useIsMutating();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const query = useQuery({
    queryKey: ['tenants-activos'],
    queryFn: ({ signal }) => listActiveTenants(signal),
    enabled: open,
    staleTime: 0,
    retry: false,
  });
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function choose(next: TenantSeleccionado | null) {
    if (locked || mutations > 0) return;
    if (document.querySelector('dialog[open], [role="dialog"]')) {
      setFeedback('Cerrá el formulario abierto antes de cambiar de tenant.');
      return;
    }
    seleccionar(next);
    setFeedback('');
    close();
  }
  const term = search.trim().toLocaleLowerCase('es');
  const rows = (query.data ?? []).filter((t) =>
    `${t.name} ${t.id}`.toLocaleLowerCase('es').includes(term),
  );
  return (
    <div
      className="empresa-global tenant-global"
      ref={container}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={`empresa-global-trigger${tenant ? '' : ' is-empty'}`}
        disabled={locked || mutations > 0}
        aria-label={`Tenant: ${tenant?.name ?? 'Todos los tenants'}`}
        aria-expanded={open}
        aria-controls="tenant-global-panel"
        title="Seleccionar tenant (permisos de superusuario)"
        onClick={() => setOpen(!open)}
      >
        <svg
          className="empresa-global-icon"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M3 21V3h12v18M15 10h6v11M7 7h4M7 11h4M7 15h4M7 21v-3h4v3" />
        </svg>
        <span className="empresa-global-label">
          {tenant?.name ?? 'Todos los tenants'}
        </span>
        <svg
          className="empresa-global-arrow"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M3 5h10a1 1 0 0 1 .8 1.6l-5 6a1 1 0 0 1-1.6 0l-5-6A1 1 0 0 1 3 5Z" />
        </svg>
      </button>
      {open && (
        <section
          id="tenant-global-panel"
          className="empresa-global-panel"
          aria-label="Selector de tenant"
        >
          <label htmlFor="tenant-global-search">Buscar tenant</label>
          <input
            ref={input}
            id="tenant-global-search"
            type="search"
            maxLength={100}
            value={search}
            placeholder="Nombre o ID"
            onChange={(e) => setSearch(e.target.value)}
          />
          <p className="tenant-global-hint">
            Solo cambia el contexto de datos. Conservás los permisos de
            superusuario.
          </p>
          <Button variant="ghost" onClick={() => choose(null)}>
            Todos los tenants
          </Button>
          {feedback && <p role="alert">{feedback}</p>}
          {query.isPending && <p role="status">Cargando tenants…</p>}
          {query.isError && (
            <div role="alert">
              No se pudieron cargar los tenants activos.
              <Button variant="ghost" onClick={() => void query.refetch()}>
                Reintentar
              </Button>
            </div>
          )}
          {query.isSuccess && (
            <>
              {rows.length === 0 && (
                <p role="status">
                  {term
                    ? 'Sin resultados.'
                    : 'No hay tenants activos disponibles.'}
                </p>
              )}
              <ul
                className="empresa-global-results"
                aria-label="Tenants activos"
              >
                {rows.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      aria-pressed={tenant?.id === t.id}
                      onClick={() => choose(t)}
                    >
                      <strong>{t.name}</strong>
                      <small>Tenant {t.id}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
