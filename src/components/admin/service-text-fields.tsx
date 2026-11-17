import { useTranslations } from 'next-intl';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';

// Même borne que le serveur (texte client personnalisé).
const MAX_TEXT = 400;

type Item = { value: string; set: (v: string) => void; generated: string | null };

export type ServiceTextFieldsProps = {
  locked: boolean;
  onTouch: () => void;
  nameFr: Item;
  nameEn: Item;
  descFr: Item;
  descEn: Item;
};

// Noms et descriptions personnalisés : un champ vide revient au texte généré, affiché en repère.
export function ServiceTextFields({
  locked,
  onTouch,
  nameFr,
  nameEn,
  descFr,
  descEn,
}: ServiceTextFieldsProps) {
  const t = useTranslations('admin');

  const textArea = (id: string, label: string, item: Item) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-encre text-sm font-semibold">
        {label}
      </label>
      <Textarea
        id={id}
        value={item.value}
        maxLength={MAX_TEXT}
        disabled={locked}
        onChange={(e) => {
          item.set(e.target.value);
          onTouch();
        }}
      />
      <p className="text-gris-600 text-sm tabular-nums">
        {item.value.length} / {MAX_TEXT}
      </p>
      {item.value.trim() === '' ? (
        <p className="text-gris-600 bg-gris-50 rounded-lg p-3 text-sm">
          <span className="font-semibold">{t('services.generated')} : </span>
          {item.generated ?? t('common.none')}
        </p>
      ) : null}
    </div>
  );

  const nameField = (id: string, label: string, item: Item) => (
    <Field
      name={id}
      label={label}
      value={item.value}
      maxLength={200}
      disabled={locked}
      hint={
        item.value.trim() === ''
          ? `${t('services.generated')} : ${item.generated ?? ''}`
          : undefined
      }
      onChange={(e) => {
        item.set(e.target.value);
        onTouch();
      }}
    />
  );

  return (
    <section className="border-gris-200 bg-blanc flex flex-col gap-4 rounded-xl border p-4 sm:p-5">
      <h2 className="text-encre text-lg font-bold">{t('services.texts')}</h2>
      {nameField('custom_name_fr', t('services.nameFr'), nameFr)}
      {nameField('custom_name_en', t('services.nameEn'), nameEn)}
      {textArea('custom_description_fr', t('services.descriptionFr'), descFr)}
      {textArea('custom_description_en', t('services.descriptionEn'), descEn)}
    </section>
  );
}
