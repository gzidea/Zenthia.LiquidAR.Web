import { Skeleton } from '@/components/ui/Skeleton';
import { fieldLabels } from '../schemas/bancoSchema';

export function BancoFormSkeleton() {
  return (
    <div className="banco-form banco-form-skeleton">
      <span role="status" className="skeleton-sr-only">
        Cargando datos…
      </span>
      <div role="group" aria-label="Datos del banco" aria-busy="true">
        <div className="banco-fields" aria-hidden="true">
          {Object.keys(fieldLabels).map((key) => (
            <div className={`banco-entry banco-entry-${key}`} key={key}>
              <div className="field">
                <Skeleton width="75%" height={12} />
                <Skeleton
                  variant="rounded"
                  height="var(--banco-control-height)"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
