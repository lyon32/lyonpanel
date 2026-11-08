import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function Block({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section data-testid={id} className="flex flex-col gap-4">
      <h3 className="text-encre text-lg font-bold">{title}</h3>
      {children}
    </section>
  );
}

// Composants de base du design system, un bloc par famille.
export async function DemoBasics() {
  const t = await getTranslations('demo');
  const tc = await getTranslations('common');

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12">
      <Reveal>
        <h2 className="text-encre text-2xl font-bold">{t('basicsTitle')}</h2>
      </Reveal>

      <Block id="demo-buttons" title={t('buttonsTitle')}>
        <div className="flex flex-wrap gap-3">
          <Button>{t('btnPrimary')}</Button>
          <Button variant="secondary">{t('btnSecondary')}</Button>
          <Button variant="ghost">{t('btnGhost')}</Button>
          <Button variant="destructive">{t('btnDestructive')}</Button>
          <Button loading loadingLabel={t('btnLoadingLabel')}>
            {t('btnLoading')}
          </Button>
        </div>
      </Block>

      <Block id="demo-fields" title={t('fieldsTitle')}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label={t('fieldLabel')}
            hint={t('fieldHint')}
            placeholder={t('fieldPlaceholder')}
          />
          <Field label={t('fieldErrorLabel')} defaultValue="10" error={t('fieldError')} />
        </div>
      </Block>

      <Block id="demo-cards" title={t('cardsTitle')}>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('cardOneTitle')}</CardTitle>
              <CardDescription>{t('cardOneText')}</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('cardTwoTitle')}</CardTitle>
              <CardDescription>{t('cardTwoText')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button>{t('btnPrimary')}</Button>
            </CardContent>
          </Card>
        </div>
      </Block>

      <Block id="demo-badges" title={t('badgesTitle')}>
        <div className="flex flex-wrap gap-2">
          <Badge data-testid="demo-badge" status="success">
            {t('statusSuccess')}
          </Badge>
          <Badge data-testid="demo-badge" status="pending">
            {t('statusPending')}
          </Badge>
          <Badge data-testid="demo-badge" status="failed">
            {t('statusFailed')}
          </Badge>
          <Badge data-testid="demo-badge" status="info">
            {t('statusInfo')}
          </Badge>
          <Badge variant="popular">{t('popular')}</Badge>
        </div>
      </Block>

      <Block id="demo-table" title={t('tableTitle')}>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('colService')}</TableHead>
                <TableHead numeric>{t('colQuantity')}</TableHead>
                <TableHead numeric>{t('colPrice')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>{t('row1')}</TableCell>
                <TableCell numeric>1 000</TableCell>
                <TableCell numeric data-no-motion>
                  5 000 XAF
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t('row2')}</TableCell>
                <TableCell numeric>500</TableCell>
                <TableCell numeric data-no-motion>
                  1 500 XAF
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t('row3')}</TableCell>
                <TableCell numeric>10 000</TableCell>
                <TableCell numeric data-no-motion>
                  3 000 XAF
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </Block>

      <Block id="demo-dialog" title={t('dialogTitle')}>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary" className="self-start">
              {t('dialogOpen')}
            </Button>
          </DialogTrigger>
          <DialogContent closeLabel={tc('close')}>
            <DialogTitle>{t('dialogHeading')}</DialogTitle>
            <DialogDescription>{t('dialogText')}</DialogDescription>
            <DialogClose asChild>
              <Button className="self-start">{t('dialogOk')}</Button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      </Block>
    </section>
  );
}
