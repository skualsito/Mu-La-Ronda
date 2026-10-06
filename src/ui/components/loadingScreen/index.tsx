import { observer } from 'mobx-react-lite';
import { Store, UIState } from '../../../store';
import { RondaLoadingView } from '../rondaLoading';

/**
 * The screen over every scene load after the opening one (entering the game,
 * warps, map changes). Mu La Ronda draws its own loading look here instead of
 * upstream's MU artwork (`art.tsx` / `progressBar.tsx`, left in place).
 */
export const LoadingScreen = observer(() => {
  if (Store.uiState === UIState.Preloader) return null;

  if (!Store.isLoading) return null;

  const progress = Math.max(0, Math.min(1, Store.loadingProgress));

  return (
    <RondaLoadingView
      progress={progress}
      status={`Cargando… ${Math.round(progress * 100)}%`}
      overlay
    />
  );
});
