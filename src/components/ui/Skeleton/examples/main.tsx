import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/fraunces/600.css';
import '@/styles/theme.css';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { DataGrid } from '@/components/ui/DataGrid';
import { Skeleton, FormSkeleton, SkeletonActions, DataGridSkeleton } from '..';
import './examples.css';

function Demo() {
  const [size, setSize] = useState<'small' | 'medium' | 'large' | null>(null);
  const [loaded, setLoaded] = useState(false);
  return (
    <main className="skeleton-examples">
      <h1>Skeletons de LiquidAR</h1>
      <section aria-label="Variantes">
        <h2>Bloques básicos</h2>
        <div className="skeleton-example-blocks" aria-busy="true">
          <Skeleton count={3} width="80%" />
          <Skeleton variant="rectangular" height={70} />
          <Skeleton variant="circular" />
          <Skeleton variant="rounded" />
        </div>
        <p role="status">Cargando contenido de ejemplo…</p>
      </section>
      <section aria-label="Formulario de página">
        <h2>Formulario</h2>
        <FormSkeleton
          columns={3}
          fields={[
            { kind: 'input' },
            { kind: 'select' },
            { kind: 'input' },
            { kind: 'section' },
            { kind: 'textarea', fullWidth: true },
            { kind: 'checkbox' },
          ]}
        />
      </section>
      <section>
        <h2>Dentro de un modal</h2>
        <div className="skeleton-example-buttons">
          {(['small', 'medium', 'large'] as const).map((value) => (
            <Button key={value} onClick={() => setSize(value)}>
              Modal {value}
            </Button>
          ))}
        </div>
      </section>
      <Modal
        open={size !== null}
        size={size ?? 'medium'}
        onClose={() => setSize(null)}
        title={
          <>
            <span className="skeleton-sr-only">Formulario de ejemplo</span>
            <Skeleton width="60%" height={16} />
          </>
        }
        footer={{ type: 'custom', content: <SkeletonActions /> }}
      >
        <FormSkeleton columns={3} fields={6} actions={false} />
      </Modal>
      <section aria-label="Grilla independiente">
        <h2>Grilla decorativa</h2>
        <DataGridSkeleton
          columns={3}
          columnWidths={['20%', '50%', '30%']}
          selection
          actions
        />
      </section>
      <section>
        <h2>DataGrid integrado</h2>
        <Button onClick={() => setLoaded(!loaded)}>
          {loaded ? 'Simular carga' : 'Mostrar datos'}
        </Button>
        <DataGrid
          label="Ejemplo"
          loading={!loaded}
          rows={loaded ? [{ id: 1, name: 'Registro de ejemplo' }] : []}
          columns={[
            {
              field: 'id',
              header: 'Código',
              getValue: (row) => row.id,
              width: 120,
            },
            {
              field: 'name',
              header: 'Descripción',
              getValue: (row) => row.name,
            },
          ]}
          getRowId={(row) => row.id}
          selectionMode="multiple"
          rowActions={[{ id: 'view', label: 'Ver', onClick: () => {} }]}
        />
      </section>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
);
