import { useEffect } from 'react';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { DataGridSkeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useEmpresaContextStore } from '@/stores/empresaContextStore';
import { errorMessage } from '@/services/http/ApiError';
import { formulasEmpresaApi } from './service';
import { EmpresaFormulasContent } from './EmpresaFormulasContent';

export function ConfiguracionFormulasPage() {
  const permissions = usePermissions();
  const revision = useAuthStore((s) => s.revision);
  const empresaId = useEmpresaContextStore((s) => s.empresaSeleccionadaId);
  const canRead = permissions.can('empresas-formulas:read');
  const empresa = useQuery({
    queryKey: ['formulas-empresa', revision, empresaId, 'empresa'],
    queryFn: ({ signal }) => formulasEmpresaApi.empresa(empresaId!, signal),
    enabled: canRead && empresaId !== null,
    retry: false,
  });
  useEffect(() => {
    document.title = 'Configuración de Fórmulas | Zenthia.LiquidAR.Web';
    document.querySelector<HTMLElement>('#main-content h1')?.focus();
  }, []);
  return (
    <section className="formula-config-page">
      <h1 tabIndex={-1}>Configuración de Fórmulas</h1>
      {permissions.isPending ? (
        <DataGridSkeleton columns={6} actions />
      ) : permissions.isError ? (
        <Notice>
          {errorMessage(permissions.error)}{' '}
          <Button onClick={() => void permissions.refetch()}>
            Reintentar permisos
          </Button>
        </Notice>
      ) : !canRead ? (
        <Notice>
          No tenés acceso a la configuración de fórmulas empresariales.
        </Notice>
      ) : empresaId === null ? (
        <p role="status">
          Seleccioná una empresa desde el menú superior para configurar sus
          fórmulas y recibo.
        </p>
      ) : empresa.isPending ? (
        <DataGridSkeleton columns={6} actions />
      ) : empresa.isError ? (
        <Notice>
          {errorMessage(empresa.error)}{' '}
          <Button onClick={() => void empresa.refetch()}>
            Reintentar empresa
          </Button>
        </Notice>
      ) : (
        empresa.data && (
          <>
            <p>Fórmulas y recibo · {empresa.data.nombre ?? empresa.data.id}</p>
            <EmpresaFormulasContent
              key={`${revision}:${empresaId}`}
              empresa={empresa.data}
              canWrite={permissions.can('empresas-formulas:write')}
            />
          </>
        )
      )}
    </section>
  );
}
