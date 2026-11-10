import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useEmpresaContextStore } from '@/stores/empresaContextStore';
import { empresaService } from '../services/empresaService';
import { formulasEmpresaApi } from '@/features/formulas-empresa/service';

export function EmpresaGlobalSelector({
  enabled,
  formulasOnly = false,
}: {
  enabled: boolean;
  formulasOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [buscar, setBuscar] = useState('');
  const [page, setPage] = useState(1);
  const revision = useAuthStore((s) => s.revision);
  const { empresaSeleccionadaId, seleccionar, limpiar } =
    useEmpresaContextStore();
  const bloqueada = useEmpresaContextStore((s) => s.seleccionBloqueada);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const query = useQuery({
    queryKey: ['empresas', 'selector', revision, formulasOnly, buscar, page],
    queryFn: ({ signal }) =>
      formulasOnly
        ? formulasEmpresaApi.empresas(page, buscar, signal)
        : empresaService.selector(page, buscar, signal),
    enabled: enabled && open,
  });
  const selected = useQuery({
    queryKey: [
      'empresas',
      'selector-detail',
      revision,
      formulasOnly,
      empresaSeleccionadaId,
    ],
    queryFn: async ({ signal }) =>
      formulasOnly
        ? formulasEmpresaApi.empresa(empresaSeleccionadaId!, signal)
        : (await empresaService.detail(empresaSeleccionadaId!, signal)).empresa,
    enabled: enabled && empresaSeleccionadaId !== null,
  });
  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscar(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
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
  return (
    <div
      className="empresa-global"
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
        className={`empresa-global-trigger${empresaSeleccionadaId === null ? ' is-empty' : ''}`}
        disabled={!enabled || bloqueada}
        aria-expanded={open}
        aria-controls="empresa-global-panel"
        title={
          enabled
            ? 'Seleccionar empresa'
            : 'No tenés acceso a la selección de empresas'
        }
        onClick={() => setOpen(!open)}
      >
        <svg
          className="empresa-global-icon"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="9" cy="7" r="4" />
          <path d="M2 19v-2c0-3 3-5 7-5s7 2 7 5v2c-4 2-10 2-14 0ZM16 3a4 4 0 0 1 0 8 6 6 0 0 0 0-8ZM17 13c3 .3 5 2 5 4v2l-4 1v-3c0-1.5-.4-2.8-1-4Z" />
        </svg>
        <span className="empresa-global-label">
          {empresaSeleccionadaId === null
            ? 'Seleccionar empresa'
            : selected.data?.nombre || `Empresa ${empresaSeleccionadaId}`}
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
      {open && enabled && (
        <section
          id="empresa-global-panel"
          className="empresa-global-panel"
          aria-label="Selector de empresa"
        >
          <label htmlFor="empresa-global-search">Buscar empresa</label>
          <input
            ref={input}
            id="empresa-global-search"
            type="search"
            maxLength={100}
            placeholder="Nombre, código o CUIT"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button
            variant="ghost"
            onClick={() => {
              limpiar();
              close();
            }}
          >
            Sin empresa seleccionada
          </Button>
          {query.isPending && <p role="status">Cargando empresas…</p>}
          {query.isError && (
            <div role="alert">
              No se pudieron cargar las empresas.
              <Button variant="ghost" onClick={() => void query.refetch()}>
                Reintentar
              </Button>
            </div>
          )}
          {query.isSuccess && (
            <>
              {query.data.items.length === 0 && (
                <p role="status">
                  {buscar ? 'Sin resultados.' : 'No hay empresas disponibles.'}
                </p>
              )}
              <ul
                className="empresa-global-results"
                aria-label="Empresas disponibles"
              >
                {query.data.items.map((empresa) => (
                  <li key={empresa.id}>
                    <button
                      type="button"
                      aria-pressed={empresaSeleccionadaId === empresa.id}
                      onClick={() => {
                        seleccionar(empresa.id);
                        close();
                      }}
                    >
                      <strong>
                        {empresa.nombre || `Empresa ${empresa.id}`}
                      </strong>
                      <small>
                        Código {empresa.codigo ?? '—'} ·{' '}
                        {empresa.claveUnica || `ID ${empresa.id}`}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="empresa-global-pages">
                <Button
                  variant="ghost"
                  disabled={page === 1 || query.isFetching}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </Button>
                <span>Página {page}</span>
                <Button
                  variant="ghost"
                  disabled={page * 25 >= query.data.total || query.isFetching}
                  onClick={() => setPage(page + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
