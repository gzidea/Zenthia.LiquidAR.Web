import { Skeleton } from '@/components/ui/Skeleton';
import { EmpresaFormLayout } from './EmpresaFormLayout';
import { fieldLabels } from '../schemas/empresaSchema';
export function EmpresaFormSkeleton() {
  return (
    <div
      role="status"
      aria-label="Cargando formulario de empresa"
      className="empresa-form"
    >
      <div aria-hidden="true">
        <EmpresaFormLayout
          field={(key) => (
            <div className="field">
              <label>{fieldLabels[key]}</label>
              <Skeleton height="var(--empresa-control-height)" />
            </div>
          )}
        />
        <div className="empresa-tabs">
          <Skeleton width="100%" height={40} />
        </div>
        <div className="empresa-tab-content">
          <Skeleton height={64} />
        </div>
      </div>
    </div>
  );
}
