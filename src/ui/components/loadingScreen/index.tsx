import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { Store, UIState } from '../../../store';
import { RondaLoadingView } from '../rondaLoading';
import { MuWindows } from '../muWindow/windowState';

/**
 * The screen over every scene load after the opening one (entering the game,
 * warps, map changes). Mu La Ronda draws its own loading look here instead of
 * upstream's MU artwork (`art.tsx` / `progressBar.tsx`, left in place).
 */
export const LoadingScreen = observer(() => {
  const loading = Store.uiState !== UIState.Preloader && Store.isLoading;

  // Mu La Ronda: the loader comes up over a warp or a map change - the
  // inventory, character, party and every other window close with it.
  useEffect(() => {
    if (loading) MuWindows.closeAll();
  }, [loading]);

  if (!loading) return null;

  const progress = Math.max(0, Math.min(1, Store.loadingProgress));

  return (
    <RondaLoadingView
      progress={progress}
      status={`Cargando… ${Math.round(progress * 100)}%`}
      overlay
    />
  );
});
