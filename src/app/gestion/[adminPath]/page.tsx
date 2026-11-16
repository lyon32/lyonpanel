import { AdminLogin } from '@/components/admin/admin-login';

// Page de connexion cachée. Le segment a déjà été validé par le layout.
export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ adminPath: string }>;
}) {
  const { adminPath } = await params;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <AdminLogin adminPath={adminPath} />
    </main>
  );
}
