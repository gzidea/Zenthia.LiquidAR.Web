import type { ReactNode } from 'react';
import type { ObraSocialFields } from '../schemas/obraSocialSchema';

export type ObraSocialFieldName = keyof ObraSocialFields | 'localidad';
// Form and skeleton share the legacy's layout, not its controls or coordinates.
export function ObraSocialFormLayout({
  field,
  showLocalidad = false,
}: {
  field: (name: ObraSocialFieldName) => ReactNode;
  showLocalidad?: boolean;
}) {
  return (
    <div className="obra-social-fields">
      <div className="obra-social-general">
        {field('codigo')}
        {field('nombre')}
        {field('direccion')}
        {showLocalidad && field('localidad')}
        {field('codigoPostal')}
        {field('idProvincia')}
        <div className="obra-social-contact-row">
          {field('email')}
          {field('telefono')}
        </div>
      </div>
      <div className="obra-social-contributions">
        <div className="obra-social-contributions-grid">
          {field('porcientoAporte')}
          {field('importeAporte')}
          {field('porcientoRetencion')}
          {field('importeRetencion')}
          {field('baseDeCalculo')}
        </div>
      </div>
    </div>
  );
}
