import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Skeleton,
  FormSkeleton,
  SkeletonActions,
  DataGridSkeleton,
} from './index';

describe('Skeleton', () => {
  it.each(['text', 'rectangular', 'circular', 'rounded'] as const)(
    'representa %s sin controles ni anuncios decorativos',
    (variant) => {
      const { container } = render(
        <Skeleton
          variant={variant}
          count={3}
          width={80}
          height={20}
          gap={12}
          className="example"
          style={{ marginTop: 4 }}
          animation={false}
        />,
      );
      expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
      expect(container.firstChild).toHaveClass('example');
      expect(container.firstChild).toHaveStyle({
        gap: '12px',
        marginTop: '4px',
      });
      expect(container.querySelectorAll('.skeleton-block')).toHaveLength(3);
      for (const block of container.querySelectorAll('.skeleton-block')) {
        expect(block).toHaveStyle({ width: '80px', height: '20px' });
        expect(block).not.toHaveClass('skeleton-pulse');
      }
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(container.querySelector('button,input,[tabindex]')).toBeNull();
    },
  );
  it('admite cero elementos y normaliza cantidades inválidas', () => {
    const { container, rerender } = render(<Skeleton count={0} />);
    expect(container.querySelectorAll('.skeleton-block')).toHaveLength(0);
    rerender(<Skeleton count={NaN} />);
    expect(container.querySelectorAll('.skeleton-block')).toHaveLength(1);
  });
});
describe('FormSkeleton', () => {
  it('configura campos, columnas, espaciado y acciones con un solo anuncio', () => {
    const { container, rerender } = render(
      <FormSkeleton
        fields={4}
        columns={2}
        gap={24}
        actions={{ count: 3 }}
        label="Cargando datos"
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Cargando datos');
    expect(screen.getByRole('group')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.form-skeleton-field')).toHaveLength(4);
    expect(container.querySelector('.form-skeleton-fields')).toHaveStyle({
      gap: '24px',
      '--skeleton-columns': '2',
    });
    expect(
      container.querySelectorAll('.skeleton-actions .skeleton-block'),
    ).toHaveLength(3);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(<FormSkeleton fields={1} actions={false} />);
    expect(container.querySelector('.skeleton-actions')).toBeNull();
  });
  it('compone secciones, selects, textarea y checkbox sin controles interactivos', () => {
    const { container } = render(
      <FormSkeleton
        actions={false}
        fields={[
          { kind: 'section' },
          { kind: 'input' },
          { kind: 'select' },
          { kind: 'textarea', fullWidth: true, height: 120 },
          { kind: 'checkbox' },
        ]}
      />,
    );
    expect(container.querySelectorAll('.form-skeleton-full')).toHaveLength(2);
    expect(
      container.querySelector('.form-skeleton-textarea .skeleton-rounded'),
    ).toHaveStyle({ height: '120px' });
    expect(container.querySelector('input,select,textarea,button')).toBeNull();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });
});
it('las acciones son decorativas y configurables', () => {
  const { container } = render(
    <SkeletonActions count={1} width="8rem" height={32} align="start" />,
  );
  expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  expect(container.firstChild).toHaveStyle({ justifyContent: 'flex-start' });
  expect(container.querySelector('.skeleton-block')).toHaveStyle({
    width: '128px',
    height: '32px',
  });
});
describe('DataGridSkeleton', () => {
  it('representa encabezado, filas, proporciones, selección y acciones sin exponer una tabla ficticia', () => {
    const { container, rerender } = render(
      <DataGridSkeleton
        rows={3}
        columns={2}
        columnWidths={['30%', '70%']}
        selection
        actions
        rowHeight={56}
      />,
    );
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.queryByRole('table')).toBeNull();
    expect(container.querySelectorAll('thead th')).toHaveLength(4);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(container.querySelectorAll('tbody td')).toHaveLength(12);
    expect(container.querySelector('tbody tr')).toHaveStyle({ height: '56px' });
    expect(container.querySelectorAll('col')[1]).toHaveStyle({ width: '30%' });
    expect(container.querySelector('input,button')).toBeNull();
    rerender(<DataGridSkeleton rows={1} columns={3} header={false} />);
    expect(container.querySelector('thead')).toBeNull();
    expect(container.querySelectorAll('tbody td')).toHaveLength(3);
  });
});
