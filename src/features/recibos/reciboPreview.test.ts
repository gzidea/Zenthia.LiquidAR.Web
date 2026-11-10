import { describe, expect, it } from 'vitest';
import { parseVista } from './reciboPreview';
import { reciboVistaFixture } from '@/test/reciboVistaFixture';
describe('adaptador de previsualización', () => {
  it('usa la presentación agrupada del servidor y conserva el desglose original', () => {
    const fixture = reciboVistaFixture();
    const body = {
      ...fixture,
      datos: {
        ...fixture.datos,
        detallesPresentacion: [
          {
            ...fixture.datos.detalles[0],
            descripcion: 'No remunerativo unificado',
            columna: 2,
            valores: {
              ...fixture.datos.detalles[0]!.valores,
              id: 0,
              idConcepto: null,
              importe: '120000',
              cantidad: null,
              base: null,
            },
            detallesOrigen: [1, 2],
            idAgrupacion: 7,
          },
        ],
      },
    };
    const vista = parseVista(body);
    expect(vista.result.detalles).toHaveLength(1);
    expect(vista.result.detalles[0]?.descripcion).toBe(
      'No remunerativo unificado',
    );
    expect(vista.result.detalles[0]?.importe).toBe(120000);
    expect(fixture.datos.detalles).toHaveLength(3);
    expect(vista.result.totales).toEqual(parseVista(fixture).result.totales);
  });
  it('preserva descripciones, montos y origen sin usar IDs como conceptos', () => {
    const data = parseVista(reciboVistaFixture());
    expect(data.id).toBe(4);
    expect(data.result.origen).toBe('guardado');
    expect(data.result.detalles[0]?.descripcion).toBe('Básico de convenio');
    expect(data.result.totales?.neto).toBe(900);
    expect(data.result.grafico).toEqual([
      { titulo: 'Seguridad social', importe: 200 },
    ]);
    expect(data.result.fechaPagoAportes).toBe('2026-10-21');
  });
  it('distingue simulación sin habilitar la emisión y no inventa importes ausentes', () => {
    const fixture = reciboVistaFixture();
    fixture.persistido = false;
    fixture.datos.cabecera.netoACobrar = null;
    const data = parseVista(fixture);
    expect(data.id).toBeNull();
    expect(data.result.origen).toBe('simulacion');
    expect(data.result.totales).toBeNull();
  });
  it('muestra los campos inconsistentes y conserva datos disponibles', () => {
    const fixture = reciboVistaFixture();
    fixture.datosCompletos = false;
    fixture.error =
      'Los totales no coinciden con los detalles almacenados. Recalcule antes de imprimir.';
    fixture.camposInconsistentes = ['NetoACobrar'];
    const data = parseVista(fixture);
    expect(data.datosCompletos).toBe(false);
    expect(data.result.camposInconsistentes).toEqual(['Neto']);
    expect(data.result.detalles).toHaveLength(3);
  });
  it('rechaza contratos inválidos y no expone errores desconocidos', () => {
    expect(() => parseVista({})).toThrow('No pudimos interpretar');
    const fixture = reciboVistaFixture();
    fixture.error = 'Stack trace interno';
    expect(parseVista(fixture).result.errorIntegridad).not.toContain(
      'Stack trace',
    );
  });
});
