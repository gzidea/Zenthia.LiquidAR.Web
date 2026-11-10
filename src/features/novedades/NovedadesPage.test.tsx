import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NovedadesPage } from './NovedadesPage';
vi.mock('@/features/auth/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => true, isPending: false }),
}));
vi.mock('./hooks', () => ({
  useNovedades: () => ({
    tipos: { data: [] },
    convenios: { data: [] },
    empresas: { data: [{ id: 1, nombre: 'Empresa prueba' }] },
    filas: {
      data: {
        items: [
          {
            idLegajo: 8,
            numero: 8,
            nombre: 'Empleado prueba',
            idRecibo: 4,
            idNovedad: 1,
            requeridas: [],
            detalles: [],
            errores: [],
            pendientes: 0,
            revision: 1,
          },
        ],
        total: 1,
      },
    },
    quitar: {},
    guardar: {},
    importar: {},
    plantilla: {},
  }),
}));
vi.mock('@/components/ui/Select', () => ({
  Select: (props: any) => <select {...props} />,
}));
describe('Novedades separadas de liquidaciones', () => {
  it('no ofrece generar, recalcular ni PDF y bloquea la carga ya liquidada', () => {
    render(<NovedadesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Empresa prueba/ }));
    expect(
      screen.getByRole('heading', { name: 'Novedades' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /Generar|Recalcular|PDF|Previsualizar/,
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Días 8')).toBeDisabled();
  });
});
