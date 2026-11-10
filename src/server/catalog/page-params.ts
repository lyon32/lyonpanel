import { notFound } from 'next/navigation';
import {
  NETWORKS,
  SERVICE_TYPES,
  type CatalogLocale,
  type Network,
  type ServiceType,
} from './labels';

export const asCatalogLocale = (locale: string): CatalogLocale => (locale === 'en' ? 'en' : 'fr');

// Une adresse inconnue donne une 404 : on ne devine jamais un réseau ou un type.
export function parseNetwork(value: string): Network {
  return NETWORKS.find((n) => n === value) ?? notFound();
}

export function parseType(value: string): ServiceType {
  return SERVICE_TYPES.find((t) => t === value) ?? notFound();
}

const MAX_ID = 2_147_483_647; // plus grand entier de la base

export function parseServiceId(value: string): number {
  const id = /^\d+$/.test(value) ? Number(value) : 0;
  return id >= 1 && id <= MAX_ID ? id : notFound();
}
