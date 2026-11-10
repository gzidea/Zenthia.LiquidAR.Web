import { Skeleton } from '@/components/ui/Skeleton';

/** The same compact layout as SindicatoForm, with decorative shared blocks. */
export function SindicatoFormSkeleton() {
  const field = (name: string) => (
    <div className={`sindicato-entry sindicato-entry-${name}`} key={name}>
      <div className="field">
        <Skeleton width="75%" height={12} />
        <Skeleton variant="rounded" height="var(--sindicato-control-height)" />
      </div>
    </div>
  );
  return (
    <div className="sindicato-form sindicato-form-skeleton">
      <span role="status" className="skeleton-sr-only">
        Cargando datos…
      </span>
      <div role="group" aria-label="Datos del sindicato" aria-busy="true">
        <div aria-hidden="true" className="sindicato-fields">
          <div className="sindicato-general">
            {field('codigo')}
            {field('nombre')}
            {field('direccion')}
            <div className="sindicato-location-row">
              {field('localidad')}
              {field('codigoPostal')}
            </div>
            {field('idProvincia')}
            <div className="sindicato-contact-row">
              {field('email')}
              {field('telefono')}
            </div>
          </div>
          <div className="sindicato-contributions">
            <div className="sindicato-contributions-grid">
              {[
                'porcientoAporte',
                'importeAporte',
                'porcientoRetencion',
                'importeRetencion',
                'baseDeCalculo',
              ].map(field)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
