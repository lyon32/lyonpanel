import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CancelBonusForm } from '@/components/admin/cancel-bonus-form';
import { UserNoteForm } from '@/components/admin/user-note-form';
import { UserSettingsForm } from '@/components/admin/user-settings-form';
import { FormAlert } from '@/components/auth/form-alert';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatXaf } from '@/lib/admin-format';
import { getAdminTranslator } from '@/server/admin/page-i18n';
import { requireAdminPage } from '@/server/admin/page-guard';
import { getUserDetail } from '@/server/admin/users';
import { ApiError } from '@/server/http/api-error';

type Props = { params: Promise<{ adminPath: string; id: string }> };

async function loadDetail(id: string) {
  try {
    return await getUserDetail(id);
  } catch (error) {
    // Client inconnu ou identifiant mal formé : 404, comme le reste de l'admin.
    if (error instanceof ApiError) notFound();
    throw error;
  }
}

export default async function AdminUserPage({ params }: Props) {
  await requireAdminPage();
  const { adminPath, id } = await params;
  const { t, locale } = await getAdminTranslator();
  const { profile, wallet, orders, notes, referrals, debt_xaf } = await loadDetail(id);
  const money = (n: number) => formatXaf(n, locale);

  const rows: [string, string][] = [
    [t('user.email'), profile.email ?? '-'],
    [t('user.phone'), profile.phone ?? '-'],
    [t('user.country'), profile.country],
    [t('user.language'), profile.language],
    [t('user.code'), profile.referral_code],
    [t('user.created'), formatDateTime(profile.created_at, locale)],
    [t('user.balance'), money(wallet.balance_xaf)],
    [t('user.recharged'), money(wallet.total_recharged_xaf)],
  ];

  return (
    <>
      <Link href={`/${adminPath}/users`} className="text-bleu-600 font-semibold">
        {t('user.back')}
      </Link>
      <h1 className="text-encre text-2xl font-bold">{profile.email ?? profile.phone}</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-encre text-lg font-bold">{t('user.profile')}</h2>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-gris-600 text-sm">{label}</dt>
              <dd className="text-encre font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        {debt_xaf > 0 ? (
          <FormAlert kind="error">
            {`${t('user.debt', { amount: money(debt_xaf) })} ${t('user.debtHint')}`}
          </FormAlert>
        ) : null}
        {profile.status === 'blocked' ? (
          <FormAlert kind="error">
            {t('user.blockedReason', { reason: profile.blocked_reason ?? '-' })}
          </FormAlert>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-encre text-lg font-bold">{t('user.settings')}</h2>
        {profile.status === 'deleted' ? (
          <p className="text-gris-600">{t('user.deletedNote')}</p>
        ) : (
          <UserSettingsForm
            userId={profile.id}
            status={profile.status}
            discountPct={
              profile.custom_discount_pct === null ? null : Number(profile.custom_discount_pct)
            }
            dailyLimitXaf={Number(profile.daily_spend_limit_xaf)}
          />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-encre text-lg font-bold">{t('user.orders')}</h2>
        {orders.length === 0 ? (
          <p className="text-gris-600">{t('user.noOrders')}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-gris-600">
                <th className="py-2">{t('user.orderId')}</th>
                <th className="py-2">{t('user.quantity')}</th>
                <th className="py-2">{t('user.charged')}</th>
                <th className="py-2">{t('user.orderProfit')}</th>
                <th className="py-2">{t('user.orderStatus')}</th>
                <th className="py-2">{t('common.date')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-gris-200 border-t">
                  <td className="py-2">{o.short_id}</td>
                  <td className="py-2">{o.quantity}</td>
                  <td className="py-2">{money(o.charged_xaf)}</td>
                  <td className="py-2">{o.profit_xaf === null ? '-' : money(o.profit_xaf)}</td>
                  <td className="py-2">{o.status}</td>
                  <td className="py-2">{formatDateTime(o.created_at, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-encre text-lg font-bold">{t('user.notes')}</h2>
        {notes.length === 0 ? (
          <p className="text-gris-600">{t('user.noNotes')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.map((n) => (
              <li key={n.id} className="border-gris-200 rounded-lg border p-3">
                <p className="text-gris-600 text-xs">{formatDateTime(n.created_at, locale)}</p>
                {/* Texte brut : React échappe le contenu, retours à la ligne conservés. */}
                <p className="whitespace-pre-wrap">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
        <UserNoteForm userId={profile.id} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-encre text-lg font-bold">{t('user.referrals')}</h2>
        {referrals.length === 0 ? (
          <p className="text-gris-600">{t('user.noReferrals')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {referrals.map((r) => (
              <li key={r.id} className="border-gris-200 flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/${adminPath}/users/${r.referee_id}`}
                    className="text-bleu-600 font-semibold"
                  >
                    {t('user.referee')}
                  </Link>
                  <span>{`${t('user.bonus')} : ${money(r.bonus_xaf)}`}</span>
                  <span className="text-gris-600 text-sm">
                    {formatDateTime(r.created_at, locale)}
                  </span>
                  {r.same_ip ? <Badge status="pending">{t('user.sameIp')}</Badge> : null}
                  {r.bonus_cancelled ? <Badge status="failed">{t('user.cancelled')}</Badge> : null}
                </div>
                {r.bonus_cancelled ? null : <CancelBonusForm rewardId={r.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
