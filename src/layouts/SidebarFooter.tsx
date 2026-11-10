import { LogoutButton } from '@/features/auth/components/LogoutButton';

export function SidebarFooter({
  name,
  initials,
}: {
  name: string;
  initials: string;
}) {
  return (
    <div className="sidebar-footer">
      <LogoutButton sidebar />
      <button
        type="button"
        disabled
        className="sidebar-profile"
        title={`${name} (próximamente)`}
        aria-label={`Perfil de ${name} (próximamente)`}
      >
        <span className="sidebar-avatar">{initials}</span>
        <span className="sidebar-label sidebar-profile-name">{name}</span>
        <span className="sidebar-label sidebar-profile-more" aria-hidden="true">
          ⋮
        </span>
      </button>
    </div>
  );
}
