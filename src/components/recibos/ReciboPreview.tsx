import type { ReciboPreviewDetalle, ReciboPreviewData } from './types';
import './recibo-preview.css';
const numeric = (value: number, digits = 2) =>
  new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
const money = (value: number, digits = 2) => `$ ${numeric(value, digits)}`;
const date = (value: string) => value.split('-').reverse().join('/');
function Detalles({
  rows,
  empleador,
}: {
  rows: ReciboPreviewDetalle[];
  empleador: boolean;
}) {
  return (
    <div
      className="receipt-table-scroll"
      tabIndex={0}
      role="region"
      aria-label={
        empleador ? 'Detalle del empleador' : 'Detalle del trabajador'
      }
    >
      <p className="receipt-scroll-help">
        Deslizá la tabla para ver todos los importes.
      </p>
      <table className="receipt-receipt-table">
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Unidad</th>
            <th>Base</th>
            <th>Monto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.descripcion}</td>
              <td>
                {r.cantidad !== null && r.cantidad > 0
                  ? numeric(r.cantidad, 3)
                  : ''}
              </td>
              <td>{r.base !== null && r.base > 0 ? numeric(r.base) : ''}</td>
              <td>
                {r.importe !== null &&
                (empleador ? r.importe !== 0 : r.importe > 0)
                  ? money(r.importe, empleador ? 2 : 3)
                  : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Costos({ result }: { result: ReciboPreviewData }) {
  const neto = result.totales!.neto;
  const composition = [
    { titulo: 'Neto', importe: neto },
    ...(result.grafico ??
      result.grupos.map((g) => ({ titulo: g.titulo, importe: g.total }))),
  ];
  const slices = composition.filter((s) => s.importe > 0);
  const sum = slices.reduce((v, s) => v + s.importe, 0);
  const representable =
    Number.isFinite(sum) &&
    sum > 0 &&
    composition.every((s) => Number.isFinite(s.importe) && s.importe >= 0);
  const colors = [
    '#60b5cc',
    '#e66c7d',
    '#6bb76d',
    '#f0ad00',
    '#e88651',
    '#c64847',
  ];
  let accumulated = 0;
  const stops = (representable ? slices : []).map((s, i) => {
    const start = accumulated;
    accumulated += (s.importe / sum) * 100;
    return `${colors[i % colors.length]} ${start}% ${accumulated}%`;
  });
  return (
    <div className="receipt-costs">
      <div>
        <div className="receipt-cost-groups">
          {result.grupos.map((g) => (
            <div key={g.idGrupoCosto}>
              <strong>
                {g.titulo} · {money(g.total)}
              </strong>
              <div>Empleador {money(g.empleador)}</div>
              <div>Trabajador {money(g.trabajador)}</div>
            </div>
          ))}
        </div>
        <div className="receipt-signature">Firma del empleador</div>
        <small>{result.nota}</small>
      </div>
      <div className="receipt-chart">
        <div>Costo total empleador</div>
        {!representable ? (
          <p>No hay una composición representable para estos importes.</p>
        ) : (
          <>
            <div
              className="receipt-pie"
              role="img"
              aria-label={slices
                .map(
                  (s) =>
                    `${s.titulo}: ${money(s.importe)}, ${numeric((s.importe / sum) * 100, 0)}%`,
                )
                .join(', ')}
              style={{ background: `conic-gradient(${stops.join(',')})` }}
            />
            <ul>
              {slices.map((s, i) => (
                <li key={i}>
                  <span
                    style={{ background: colors[i % colors.length] }}
                    aria-hidden="true"
                  />
                  {s.titulo} · {money(s.importe)} ·{' '}
                  {numeric((s.importe / sum) * 100, 0)}%
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
export function ReciboPreview({ result }: { result: ReciboPreviewData }) {
  const t = result.totales;
  return (
    <article
      className="receipt-receipt"
      aria-label={
        result.origen === 'simulacion'
          ? 'Recibo de sueldo de muestra'
          : 'Previsualización de recibo de sueldo'
      }
    >
      <div className="receipt-company">{result.empresa}</div>
      <div>{result.domicilio ?? 'Domicilio no disponible'}</div>
      <div>C.U.I.T. EMPRESA: {result.cuit ?? 'No disponible'}</div>
      <div className="receipt-receipt-label">
        {result.origen === 'simulacion'
          ? 'SIMULACIÓN · SIN VALIDEZ LABORAL'
          : 'PREVISUALIZACIÓN · RECIBO GUARDADO'}
      </div>
      <dl className="receipt-identity">
        <div>
          <dt>Mes / año</dt>
          <dd>
            {/^[0-9]{6}$/.test(result.periodo)
              ? `${result.periodo.slice(0, 2)} / ${result.periodo.slice(2)}`
              : 'No disponible'}
          </dd>
        </div>
        <div className="receipt-person">
          <dt>Apellido y nombre</dt>
          <dd>{result.nombre}</dd>
        </div>
        <div>
          <dt>{result.legajoFicticio ? 'N° legajo ficticio' : 'N° legajo'}</dt>
          <dd>{result.legajo ?? 'No disponible'}</dd>
        </div>
        <div>
          <dt>Sueldo bruto de categoría</dt>
          <dd>
            {result.importeCategoria === null
              ? 'Sin escala'
              : money(result.importeCategoria)}
          </dd>
        </div>
        <div>
          <dt>Antigüedad</dt>
          <dd>{result.antiguedad}</dd>
        </div>
        <div>
          <dt>Fecha ingreso</dt>
          <dd>
            {result.fechaIngreso ? date(result.fechaIngreso) : 'No disponible'}
          </dd>
        </div>
        <div className="receipt-person">
          <dt>Convenio / categoría laboral</dt>
          <dd>
            {result.convenio} · {result.categoria}
          </dd>
        </div>
        <div>
          <dt>C.U.I.L.</dt>
          <dd>{result.cuil ?? 'No disponible'}</dd>
        </div>
        <div>
          <dt>Lugar de pago</dt>
          <dd>{result.lugarPago ?? '—'}</dd>
        </div>
        <div>
          <dt>F. pago aportes</dt>
          <dd>
            {result.fechaPagoAportes ? date(result.fechaPagoAportes) : '—'}
          </dd>
        </div>
      </dl>
      {result.errorIntegridad && (
        <div className="receipt-diagnostics" role="alert">
          <strong>Revisión pendiente</strong>
          <p>{result.errorIntegridad}</p>
          {result.camposInconsistentes.length > 0 && (
            <p>Revisar: {result.camposInconsistentes.join(', ')}.</p>
          )}
        </div>
      )}
      {result.calculado && t ? (
        <>
          <div className="receipt-band">
            COSTO TOTAL EMPLEADOR <strong>{money(t.costoTotal)}</strong>
          </div>
          <Detalles
            rows={result.detalles.filter(
              (r) =>
                r.remunerativo === 0 &&
                r.noRemunerativo === 0 &&
                r.descuento === 0,
            )}
            empleador
          />
          <div className="receipt-band">
            SUBTOTAL CONTRIBUCIONES EMPLEADOR{' '}
            <strong>{money(t.contribuciones)}</strong>
          </div>
          <div className="receipt-band receipt-band-dark">
            SUELDO BRUTO <strong>{money(t.bruto)}</strong>
          </div>
          <Detalles
            rows={result.detalles.filter((r) => r.contribuciones === 0)}
            empleador={false}
          />
          <div className="receipt-receipt-bottom">
            <div className="receipt-composition">
              <div>
                REMUNERATIVO<strong>{money(t.remunerativo)}</strong>
              </div>
              <div>
                NO REMUNERATIVO<strong>{money(t.noRemunerativo)}</strong>
              </div>
              <div>
                DESCUENTOS<strong>{money(t.descuentos)}</strong>
              </div>
            </div>
            <div className="receipt-band receipt-band-dark">
              SUELDO NETO <strong>{money(t.neto)}</strong>
            </div>
            <Costos result={result} />
          </div>
        </>
      ) : (
        <>
          <div className="receipt-diagnostics" role="alert">
            <strong>No se pudo completar el cálculo</strong>
            <ul>
              {result.diagnosticos.map((d, i) => (
                <li key={i}>
                  {d.concepto && <b>{d.concepto}: </b>}
                  {d.mensaje}
                </li>
              ))}
            </ul>
          </div>
          <h2>Conceptos del convenio</h2>
          <ul>
            {result.detalles.map((d) => (
              <li key={d.formulaId}>{d.descripcion}</li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}
