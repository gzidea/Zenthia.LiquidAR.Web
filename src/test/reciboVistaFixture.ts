import type { z } from 'zod';
import { vistaSchema } from '@/features/recibos/reciboPreview';
export function reciboVistaFixture(): z.input<typeof vistaSchema> {
  return {
    persistido: true,
    datosCompletos: true,
    error: null,
    camposInconsistentes: [],
    antiguedad: '6 años',
    datos: {
      identidad: {
        empresa: 'Empresa de prueba',
        cuit: '30-00000000-0',
        domicilio: 'Domicilio de prueba',
        nombre: 'Empleado de prueba',
        cuil: '27-00000000-0',
        legajo: 8,
        categoria: 'Administrativo A',
        ingreso: '2020-01-01T00:00:00',
        importeCategoria: '1000.0000',
        convenio: 'Convenio de prueba',
      },
      cabecera: {
        id: 4,
        periodo: '102026',
        bancoPagoAportes: 'Banco de prueba',
        fechaPagoAportes: '2026-10-21T00:00:00',
        totalRemunerativos: '1000.0000',
        totalNoRemunerativos: '0.0000',
        totalDescuentos: '100.0000',
        totalContribuciones: '200.0000',
        sueldoBruto: '1000.0000',
        netoACobrar: '900.0000',
        totalCostoLaboral: '1200.0000',
      },
      detalles: [
        {
          descripcion: 'Básico de convenio',
          columna: 0,
          valores: {
            id: 1,
            idConcepto: 1,
            cantidad: '30',
            base: '33.3333',
            importe: '1000',
            remunerativo: '1000',
            noRemunerativo: '0',
            descuento: '0',
            contribuciones: '0',
          },
        },
        {
          descripcion: 'Aporte de prueba',
          columna: 1,
          valores: {
            id: 2,
            idConcepto: 2,
            cantidad: '10',
            base: '1000',
            importe: '100',
            remunerativo: '0',
            noRemunerativo: '0',
            descuento: '100',
            contribuciones: '0',
          },
        },
        {
          descripcion: 'Contribución de prueba',
          columna: 4,
          valores: {
            id: 3,
            idConcepto: 3,
            cantidad: '20',
            base: '1000',
            importe: '200',
            remunerativo: '0',
            noRemunerativo: '0',
            descuento: '0',
            contribuciones: '200',
          },
        },
      ],
      grupos: [
        {
          idGrupoCosto: 1,
          titulo: 'Seguridad social',
          empleador: 200,
          trabajador: 100,
          total: 300,
        },
      ],
    },
  };
}
