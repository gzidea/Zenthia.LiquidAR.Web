export function StepFolio({ current }: { current: 1 | 2 }) {
  return (
    <ol className="folio" aria-label="Primer ingreso">
      {['Bienvenida', 'Nueva contraseña'].map((label, index) => (
        <li
          key={label}
          className={index + 1 < current ? 'done' : ''}
          aria-current={index + 1 === current ? 'step' : undefined}
        >
          <span className="folio-mark" aria-hidden="true">
            {index + 1 < current ? '✓' : index + 1}
          </span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}
