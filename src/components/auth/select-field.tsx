'use client';

import { Check, ChevronDown, Search } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/cn';

// `short` : texte court affiché dans le bouton fermé (la liste garde le libellé complet).
export type SelectOption = { value: string; label: string; short?: string };

type Props = {
  label: string;
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  placeholder?: string;
  error?: string;
  // Champ de recherche dans la liste (utile pour les longues listes, comme les pays).
  searchPlaceholder?: string;
  noResultsLabel?: string;
  className?: string;
};

// Retire les accents et la casse pour que « cote » trouve « Côte d'Ivoire ».
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Liste déroulante accessible : bouton + liste (ARIA combobox/listbox), clavier complet.
// La valeur choisie part dans le formulaire via un champ caché du même nom.
export function SelectField({
  label,
  name,
  options,
  defaultValue = '',
  placeholder,
  error,
  searchPlaceholder,
  noResultsLabel,
  className,
}: Props) {
  const uid = React.useId();
  const triggerId = `${uid}-trigger`;
  const listId = `${uid}-list`;
  const errorId = error ? `${uid}-error` : undefined;
  const [value, setValue] = React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const root = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const search = React.useRef<HTMLInputElement>(null);
  const list = React.useRef<HTMLUListElement>(null);
  const searchable = Boolean(searchPlaceholder);

  const shown = query
    ? options.filter((option) => normalize(option.label).includes(normalize(query)))
    : options;
  const selected = options.find((option) => option.value === value);
  const optionId = (index: number) => `${uid}-opt-${index}`;
  const activeOption =
    open && shown.length > 0 ? optionId(Math.min(active, shown.length - 1)) : undefined;

  function openList() {
    const index = shown.findIndex((option) => option.value === value);
    setActive(Math.max(index, 0));
    setOpen(true);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    setQuery('');
    if (returnFocus) trigger.current?.focus();
  }

  function choose(option: SelectOption) {
    setValue(option.value);
    close(true);
  }

  // Focus sur la recherche (ou la liste) à l'ouverture.
  React.useEffect(() => {
    if (open) (search.current ?? list.current)?.focus();
  }, [open]);

  // Garde l'option active visible pendant la navigation au clavier.
  React.useEffect(() => {
    if (open && activeOption) {
      document.getElementById(activeOption)?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, activeOption]);

  function onListKeyDown(event: React.KeyboardEvent) {
    const last = shown.length - 1;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, last));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(last);
    } else if (event.key === 'Enter' || (event.key === ' ' && !searchable)) {
      event.preventDefault();
      const option = shown[Math.min(active, last)];
      if (option) choose(option);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') {
      close(false);
    }
  }

  return (
    <div
      ref={root}
      className={cn('relative flex flex-col gap-1.5', className)}
      onBlur={(event) => {
        if (open && !root.current?.contains(event.relatedTarget as Node | null)) close(false);
      }}
    >
      <label htmlFor={triggerId} className="text-encre text-sm font-semibold">
        {label}
      </label>
      <input type="hidden" name={name} value={value} />
      <button
        ref={trigger}
        id={triggerId}
        type="button"
        role="combobox"
        data-field={name}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(event) => {
          if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault();
            openList();
          }
        }}
        className={cn(
          'border-gris-200 bg-blanc hover:border-gris-400 focus-visible:border-bleu-600 focus-visible:ring-bleu-100 aria-invalid:border-erreur flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border px-3 text-left text-base transition-colors duration-150 ease-out outline-none focus-visible:ring-4',
          open && 'border-bleu-600 ring-bleu-100 ring-4',
        )}
      >
        <span className={cn('truncate', selected ? 'text-encre' : 'text-gris-600')}>
          {selected?.short ?? selected?.label ?? placeholder}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'text-gris-600 size-5 shrink-0 transition-transform duration-150 ease-out',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <div className="border-gris-200 bg-blanc absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-lg border shadow-[0_8px_24px_rgba(14,23,38,0.12)]">
          {searchable ? (
            <div className="border-gris-200 relative border-b">
              <Search
                aria-hidden="true"
                className="text-gris-600 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <input
                ref={search}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={activeOption}
                aria-label={searchPlaceholder}
                placeholder={searchPlaceholder}
                autoComplete="off"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onListKeyDown}
                className="text-encre placeholder:text-gris-600 min-h-11 w-full bg-transparent pr-3 pl-9 text-base outline-none"
              />
            </div>
          ) : null}
          <ul
            ref={list}
            id={listId}
            role="listbox"
            aria-label={label}
            tabIndex={searchable ? undefined : -1}
            aria-activedescendant={searchable ? undefined : activeOption}
            onKeyDown={searchable ? undefined : onListKeyDown}
            className="max-h-56 overflow-y-auto overscroll-contain py-1 outline-none"
          >
            {shown.length === 0 ? (
              <li className="text-gris-600 px-3 py-3 text-sm">{noResultsLabel}</li>
            ) : (
              shown.map((option, index) => (
                <li
                  key={option.value}
                  id={optionId(index)}
                  role="option"
                  data-value={option.value}
                  aria-selected={option.value === value}
                  onMouseMove={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                  className={cn(
                    'text-encre flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 text-base',
                    index === active && 'bg-bleu-50',
                    option.value === value && 'text-bleu-700 font-semibold',
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value ? (
                    <Check aria-hidden="true" className="text-bleu-600 size-4 shrink-0" />
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-erreur text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
