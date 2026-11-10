import { describe, expect, it } from 'vitest';
import { empresaSchema, initialFields, toWrite } from './empresaSchema';
import type { EmpresaCompleta } from '../types/empresa';

describe('Empresa draft contract', () => {
  it('preserves nullable legacy fields and decimal strings without inventing required rules', () => {
    const draft = initialFields();
    draft.empresa.nombre = '  Empresa  ';
    draft.empresa.email = 'not-an-email';
    draft.actividades.push({
      id: null,
      idActividad: 8,
      codigoAfip: 1,
      actividad: 'Actividad',
      valorSeguro: '-123456789012345.6789',
      activo: false,
    });
    const data = toWrite(empresaSchema.parse(draft));
    expect(data.empresa.codigo).toBeNull();
    expect(data.empresa.nombre).toBe('  Empresa  ');
    expect(data.actividades[0]!.valorSeguro).toBe('-123456789012345.6789');
    expect(data.actividades[0]).not.toHaveProperty('codigoAfip');
    expect(data.actividades[0]).not.toHaveProperty('idEmpresa');
    expect(data.empresa).not.toHaveProperty('tenantId');
  });
  it('rejects out of range integer and decimal rounding', () => {
    const draft = initialFields();
    draft.empresa.codigo = '2147483648';
    expect(empresaSchema.safeParse(draft).success).toBe(false);
    draft.empresa.codigo = '';
    draft.actividades.push({
      id: null,
      idActividad: 1,
      codigoAfip: 1,
      actividad: '',
      valorSeguro: '1.23456',
      activo: false,
    });
    expect(empresaSchema.safeParse(draft).success).toBe(false);
  });
  it('retains postal code and existing empty strings; sends only changed rows and explicit deletions', () => {
    const original: EmpresaCompleta = {
      empresa: {
        ...toWrite(initialFields()).empresa,
        id: 1,
        codigoPostal: 2000,
        email: '',
      },
      contactos: [1, 2].map((id) => ({
        id,
        idEmpresa: 1,
        nombre: 'Contacto',
        email: null,
        telefono: null,
        cargo: null,
      })),
      actividades: [],
      bancos: [],
    };
    const draft = initialFields(original);
    expect(toWrite(draft, original).contactos).toEqual([]);
    draft.contactos.splice(0, 1);
    draft.contactosEliminar.push(1);
    draft.contactos[0]!.cargo = 'Nuevo cargo';
    const data = toWrite(draft, original);
    expect(data.empresa.codigoPostal).toBe(2000);
    expect(data.empresa.email).toBe('');
    expect(data.contactosEliminar).toEqual([1]);
    expect(data.contactos).toEqual([
      {
        id: 2,
        nombre: 'Contacto',
        email: null,
        telefono: null,
        cargo: 'Nuevo cargo',
      },
    ]);
  });
});
