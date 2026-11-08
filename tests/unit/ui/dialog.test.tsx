// @vitest-environment jsdom
// Exports : Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose.
// DialogContent reçoit `closeLabel` (libellé accessible du bouton de fermeture, fourni par props).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

function sample() {
  return render(
    <Dialog>
      <DialogTrigger>Ouvrir</DialogTrigger>
      <DialogContent closeLabel="Fermer">
        <DialogTitle>Confirmer</DialogTitle>
        <DialogDescription>Voulez-vous continuer ?</DialogDescription>
        <input aria-label="Champ" />
        <DialogClose>Annuler</DialogClose>
      </DialogContent>
    </Dialog>,
  );
}

const ouvrir = () => userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }));

describe('Dialog', () => {
  it('est fermé au départ', () => {
    sample();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('s’ouvre au clic sur le déclencheur', async () => {
    sample();
    await ouvrir();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('a un titre accessible', async () => {
    sample();
    await ouvrir();
    expect(screen.getByRole('dialog', { name: 'Confirmer' })).toBeInTheDocument();
  });

  it('Échap ferme le dialogue', async () => {
    sample();
    await ouvrir();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('rend le focus au déclencheur à la fermeture', async () => {
    sample();
    await ouvrir();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Ouvrir' })).toHaveFocus();
  });

  it('piège le focus : Tab reste dans le dialogue', async () => {
    sample();
    await ouvrir();
    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('DialogClose ferme', async () => {
    sample();
    await ouvrir();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('le bouton de fermeture porte closeLabel', async () => {
    sample();
    await ouvrir();
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument();
  });
});
