import type { ReactNode } from 'react';
import type { EmpresaFieldName } from '../schemas/empresaSchema';
export function EmpresaFormLayout({
  field,
}: {
  field: (key: EmpresaFieldName) => ReactNode;
}) {
  return (
    <div className="empresa-root">
      {(
        [
          'codigo',
          'nombre',
          'direccion',
          'localidad',
          'idProvincia',
          'telefono',
          'email',
          'idTipoClaveUnica',
          'claveUnica',
          'idTipoEmpresaAfip',
        ] as const
      ).map((key) => (
        <div className={`empresa-entry empresa-entry-${key}`} key={key}>
          {field(key)}
        </div>
      ))}
    </div>
  );
}
