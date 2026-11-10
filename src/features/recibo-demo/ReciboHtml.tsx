import { ReciboPreview } from '@/components/recibos/ReciboPreview';
import type { DemoResultado } from './types';
export function ReciboHtml({ result }: { result: DemoResultado }) {
  return (
    <ReciboPreview
      result={{
        ...result,
        detalles: result.detalles.map((d, i) => ({ ...d, id: String(i) })),
        origen: 'simulacion',
        empresa: 'EMPRESA DE EJEMPLO S.A.',
        domicilio: 'Av. de Ejemplo 123 · Córdoba',
        cuit: '30-00000000-0',
        cuil: '27-00000000-0',
        legajo: 1,
        legajoFicticio: true,
        lugarPago: 'De muestra',
        fechaPagoAportes: null,
        errorIntegridad: null,
        camposInconsistentes: [],
        nota: 'Nota: los valores pueden cambiar según el CCT.',
      }}
    />
  );
}
