import { Skeleton } from '@/components/ui/Skeleton';
import { ObraSocialFormLayout } from './ObraSocialFormLayout';

export function ObraSocialFormSkeleton() {
  return (
    <div className="obra-social-form obra-social-form-skeleton">
      <span role="status" className="skeleton-sr-only">
        Cargando datos…
      </span>
      <div role="group" aria-label="Datos de la obra social" aria-busy="true">
        <div aria-hidden="true">
          <ObraSocialFormLayout
            field={(name) => (
              <div
                className={`obra-social-entry obra-social-entry-${name}`}
                key={name}
              >
                <div className="field">
                  <Skeleton width="75%" height={12} />
                  <Skeleton
                    variant="rounded"
                    height="var(--obra-social-control-height)"
                  />
                </div>
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}
