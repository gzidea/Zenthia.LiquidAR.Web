import { Brand as ZenthiaBrand } from '@zenthia/app-shell/Brand';
export function Brand() {
  return (
    <ZenthiaBrand
      label="Zenthia.LiquidAR.Web"
      name={
        <>
          Liquid<span className="brand-accent">AR</span>
        </>
      }
    />
  );
}
