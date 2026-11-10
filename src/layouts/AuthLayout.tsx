import { Outlet } from 'react-router-dom';
import { Brand } from '@/components/Brand';
import { AuthPageLayout } from '@zenthia/app-shell/AuthPageLayout';
export function AuthLayout() {
  return (
    <AuthPageLayout brand={<Brand />} appName="Zenthia.LiquidAR.Web">
      <Outlet />
    </AuthPageLayout>
  );
}
