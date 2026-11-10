import { Select } from '@/components/ui/Select';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { campos, nuevaCondicion, resumen, type Condicion } from './types';
import { CondicionSelector, permisoCampo } from './Selectors';
export function CondicionEditor({
  value: c,
  index,
  disabled,
  onChange,
  onRemove,
}: {
  value: Condicion;
  index: number;
  disabled: boolean;
  onChange: (v: Condicion) => void;
  onRemove: () => void;
}) {
  const [select, setSelect] = useState(false);
  const [labels, setLabels] = useState('');
  const permissions = usePermissions();
  const numeric = ![
    'beneficios.vigentes',
    'legajo.fechaIngreso',
    'recibo.periodo',
  ].includes(c.campo);
  const id = `regla-condicion-${index}`;
  return (
    <div className="regla-detail">
      <div className="regla-condition-data">
        <label>
          Campo
          <Select
            aria-label={`Campo condición ${index + 1}`}
            value={c.campo}
            disabled={disabled}
            onChange={(e) => {
              onChange(nuevaCondicion(e.target.value));
              setLabels('');
            }}
          >
            {Object.entries(campos).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </label>
        {numeric && (
          <>
            <label>
              Operador
              <Select
                value={c.operador}
                disabled={disabled}
                onChange={(e) => {
                  onChange({
                    campo: c.campo,
                    operador: e.target.value,
                    valores: [],
                  });
                  setLabels('');
                }}
              >
                <option value="igual">Igual a</option>
                <option value="en">Pertenece a</option>
                <option value="entre">Entre IDs/códigos</option>
              </Select>
            </label>
            {c.operador === 'entre' ? (
              <>
                <label>
                  Desde
                  <input
                    type="number"
                    min="1"
                    value={c.valores?.[0] ?? ''}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange({
                        ...c,
                        valores: [Number(e.target.value), c.valores?.[1] ?? 0],
                      })
                    }
                  />
                </label>
                <label>
                  Hasta
                  <input
                    type="number"
                    min="1"
                    value={c.valores?.[1] ?? ''}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange({
                        ...c,
                        valores: [c.valores?.[0] ?? 0, Number(e.target.value)],
                      })
                    }
                  />
                </label>
              </>
            ) : (
              <div className="regla-condition-values">
                <span>
                  {labels ||
                    (c.valores?.length
                      ? `IDs/códigos: ${c.valores.join(', ')}`
                      : 'Sin selección')}
                </span>
                {!disabled && (
                  <Button
                    variant="ghost"
                    disabled={!permissions.can(permisoCampo(c.campo))}
                    onClick={() => setSelect(true)}
                  >
                    Seleccionar valores
                  </Button>
                )}
                {!permissions.can(permisoCampo(c.campo)) && (
                  <small>Sin permiso de lectura del catálogo.</small>
                )}
              </div>
            )}
          </>
        )}
        {c.campo === 'beneficios.vigentes' && (
          <label>
            Código de beneficio
            <input
              value={c.valor ?? ''}
              disabled={disabled}
              maxLength={80}
              onChange={(e) =>
                onChange({ ...c, valor: e.target.value.toUpperCase() })
              }
              placeholder="RIFL"
            />
          </label>
        )}
        {c.campo === 'legajo.fechaIngreso' && (
          <>
            <label>
              Ingreso desde
              <input
                type="date"
                value={c.fechaDesde ?? ''}
                disabled={disabled}
                onChange={(e) => onChange({ ...c, fechaDesde: e.target.value })}
              />
            </label>
            <label>
              Ingreso hasta
              <input
                type="date"
                value={c.fechaHasta ?? ''}
                disabled={disabled}
                onChange={(e) => onChange({ ...c, fechaHasta: e.target.value })}
              />
            </label>
          </>
        )}
        {c.campo === 'recibo.periodo' && (
          <>
            <label>
              Desplazamiento (meses)
              <input
                type="number"
                min="-1200"
                max="1200"
                value={c.desplazamientoMeses ?? 0}
                disabled={disabled}
                onChange={(e) =>
                  onChange({
                    ...c,
                    desplazamientoMeses: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Duración (meses)
              <input
                type="number"
                min="1"
                max="1200"
                value={c.duracionMeses ?? 12}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ ...c, duracionMeses: Number(e.target.value) })
                }
              />
            </label>
            <label className="regla-check">
              <input
                type="checkbox"
                checked={c.incluirMesInicial ?? true}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ ...c, incluirMesInicial: e.target.checked })
                }
              />
              Incluir mes de ingreso
            </label>
          </>
        )}
        <small id={id} className="regla-condition-summary">
          {resumen(c)}
        </small>
      </div>
      {!disabled && (
        <div className="regla-actions">
          <Button
            variant="ghost"
            aria-label={`Quitar condición ${index + 1}`}
            onClick={onRemove}
          >
            Quitar
          </Button>
        </div>
      )}
      {select && (
        <CondicionSelector
          campo={c.campo}
          multiple={c.operador === 'en'}
          onClose={() => setSelect(false)}
          onAdd={(rows) => {
            onChange({ ...c, valores: rows.map((x) => x.id) });
            setLabels(rows.map((x) => x.nombre).join('; '));
          }}
        />
      )}
    </div>
  );
}
