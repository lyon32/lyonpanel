import { createElement } from 'react';
import { renderToString as rts } from 'react-dom/server';
export { renderHook } from '@testing-library/react';

// Rend un hook côté serveur et renvoie sa valeur (chaîne).
export function renderToString(useHook: () => string): string {
  let value = '';
  function Probe() {
    value = useHook();
    return null;
  }
  rts(createElement(Probe));
  return value;
}
