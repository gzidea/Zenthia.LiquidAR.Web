import { Select } from '@/components/ui/Select';
import { useId } from 'react';
import { useCatalogo } from '../hooks/useLegajos';
import { label } from '../types/legajo';
import { Button } from '@/components/ui/Button';
export function LegajoSelect({
  title,
  tipo,
  parent,
  value,
  onChange,
  disabled,
  error,
}: {
  title: string;
  tipo: string;
  parent?: number | null;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error?: string;
}) {
  const id = useId();
  const query = useCatalogo(tipo, parent);
  const options = query.data ?? [];
  return (
    <div className="field">
      <label htmlFor={id}>{title}</label>
      <Select
        id={id}
        value={value}
        disabled={disabled || query.isPending || query.isError}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        <option value="">Sin selección</option>
        {value && !options.some((x) => String(x.id) === value) && (
          <option value={value}>
            ID {value} (fuera del catálogo disponible)
          </option>
        )}
        {options.map((x) => (
          <option key={x.id} value={x.id}>
            {label(x)}
          </option>
        ))}
      </Select>
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
      {query.isError && (
        <div className="field-error">
          <span>No se pudo cargar el catálogo.</span>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={() => void query.refetch()}
          >
            Reintentar {title}
          </Button>
        </div>
      )}
    </div>
  );
}
