import { AdminLogin } from '@/components/admin/admin-login';

// Page de connexion cachée. Le segment a déjà été validé par le layout.
export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ adminPath: string }>;
}) {
  const { adminPath } = await params;
  return (
    <main className="bg-gris-50 flex min-h-dvh flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <AdminLogin adminPath={adminPath} />
      </div>
    </main>
  );
}
