import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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

// Couleur de la pastille d'après le sens du statut (terminé, échec, en cours).
function orderBadge(status: string): 'success' | 'failed' | 'pending' {
  if (['completed', 'delivered'].includes(status)) return 'success';
  if (['failed', 'canceled', 'cancelled', 'refunded', 'partial'].includes(status)) return 'failed';
  return 'pending';
}

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

  const h2 = 'text-encre text-lg font-bold';
  const panel = 'border-gris-200 bg-blanc flex flex-col gap-3 rounded-xl border p-4 sm:p-5';
  const empty = 'text-gris-600 text-sm';
  const th = 'px-3 py-3 font-semibold';
  return (
    <>
      <Link
        href={`/${adminPath}/users`}
        className="text-bleu-600 focus-visible:ring-bleu-100 inline-flex min-h-11 w-fit items-center gap-1 rounded-lg font-semibold outline-none focus-visible:ring-4"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('user.back')}
      </Link>
      <h1 className="text-encre text-2xl font-bold break-all">{profile.email ?? profile.phone}</h1>

      <section aria-labelledby="user-profile" className={panel}>
        <h2 id="user-profile" className={h2}>
          {t('user.profile')}
        </h2>
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
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {rows.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-gris-600 text-sm">{label}</dt>
              <dd className="text-encre font-semibold break-words tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="user-settings" className={panel}>
        <h2 id="user-settings" className={h2}>
          {t('user.settings')}
        </h2>
        {profile.status === 'deleted' ? (
          <p className={empty}>{t('user.deletedNote')}</p>
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

      <section aria-labelledby="user-orders" className="flex flex-col gap-3">
        <h2 id="user-orders" className={h2}>
          {t('user.orders')}
        </h2>
        {orders.length === 0 ? (
          <p className={`${panel} ${empty}`}>{t('user.noOrders')}</p>
        ) : (
          <div className="border-gris-200 bg-blanc overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="bg-gris-50 text-gris-600">
                <tr>
                  <th scope="col" className={th}>
                    {t('user.orderId')}
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    {t('user.quantity')}
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    {t('user.charged')}
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    {t('user.orderProfit')}
                  </th>
                  <th scope="col" className={th}>
                    {t('user.orderStatus')}
                  </th>
                  <th scope="col" className={th}>
                    {t('common.date')}
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {orders.map((o) => (
                  <tr key={o.id} className="border-gris-200 border-t">
                    <td className="px-3 py-3 font-semibold">{o.short_id}</td>
                    <td className="px-3 py-3 text-right">{o.quantity}</td>
                    <td className="px-3 py-3 text-right">{money(o.charged_xaf)}</td>
                    <td className="px-3 py-3 text-right">
                      {o.profit_xaf === null ? '-' : money(o.profit_xaf)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge status={orderBadge(o.status)}>{o.status}</Badge>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {formatDateTime(o.created_at, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="user-notes" className={panel}>
        <h2 id="user-notes" className={h2}>
          {t('user.notes')}
        </h2>
        {notes.length === 0 ? (
          <p className={empty}>{t('user.noNotes')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.map((n) => (
              <li key={n.id} className="bg-jaune-50 rounded-lg p-3">
                <p className="text-gris-600 text-xs">{formatDateTime(n.created_at, locale)}</p>
                {/* Texte brut : React échappe le contenu, retours à la ligne conservés. */}
                <p className="text-encre text-sm break-words whitespace-pre-wrap">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
        <UserNoteForm userId={profile.id} />
      </section>

      <section aria-labelledby="user-referrals" className="flex flex-col gap-3">
        <h2 id="user-referrals" className={h2}>
          {t('user.referrals')}
        </h2>
        {referrals.length === 0 ? (
          <p className={`${panel} ${empty}`}>{t('user.noReferrals')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {referrals.map((r) => (
              <li key={r.id} className={panel}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Link
                    href={`/${adminPath}/users/${r.referee_id}`}
                    className="text-bleu-600 focus-visible:ring-bleu-100 inline-flex min-h-11 items-center rounded-lg font-semibold outline-none focus-visible:ring-4"
                  >
                    {t('user.referee')}
                  </Link>
                  <span className="font-semibold tabular-nums">{`${t('user.bonus')} : ${money(r.bonus_xaf)}`}</span>
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
