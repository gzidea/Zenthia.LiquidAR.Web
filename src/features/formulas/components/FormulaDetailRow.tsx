import { Button } from '@/components/ui/Button';

interface Props {
  label: string;
  description: string;
  selected: boolean;
  busy: boolean;
  readOnly: boolean;
  canRemove: boolean;
  removeLabel: string;
  onSelected: (selected: boolean) => void;
  onRemove: () => void;
}

// Same structure and visual treatment as the bank/activity rows in EmpresaForm.
export function FormulaDetailRow({
  label,
  description,
  selected,
  busy,
  readOnly,
  canRemove,
  removeLabel,
  onSelected,
  onRemove,
}: Props) {
  return (
    <fieldset
      className="formula-detail-card"
      disabled={busy}
      aria-label={label}
    >
      <div className="formula-detail-data">
        <span className="formula-detail-name">{description}</span>
        <label className="formula-detail-check">
          <input
            type="checkbox"
            checked={selected}
            disabled={busy || readOnly}
            onChange={(event) => onSelected(event.target.checked)}
          />
          Aplicar
        </label>
      </div>
      {!readOnly && (
        <div className="formula-detail-actions">
          <Button
            type="button"
            variant="ghost"
            disabled={busy || !canRemove}
            onClick={onRemove}
          >
            {removeLabel}
          </Button>
        </div>
      )}
    </fieldset>
  );
}
