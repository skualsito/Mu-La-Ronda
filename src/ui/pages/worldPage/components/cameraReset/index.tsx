import { observer } from 'mobx-react-lite';
import { t } from '../../../../../i18n';
import { Store } from '../../../../../store';
import { GameOptions } from '../../../../../common/gameOptions';
import { cameraView, resetCamera } from '../../../../../camera';
import { GmPanel } from '../../../../../gmPanel';
import { MuButton } from '../../../../components/muButton';
import { minimapCornerReach } from '../minimap/corner';

/** Where the GM plate sits (gmPanel/style.less `.gm-tab-plate`), so this goes under it. */
const GM_PLATE_HEIGHT = 30;

/**
 * Mu La Ronda: "reset camera", shown while the camera is turned, tilted or
 * zoomed away from the map's own frame. Top right, left of the corner
 * minimap, so it covers neither the minimap nor the event list under it.
 */
export const CameraResetButton = observer(() => {
  if (!cameraView.moved || Store.hudHidden || !GameOptions.cameraControl) return null;

  const reach = minimapCornerReach();
  const top = 8 + (GmPanel.available ? GM_PLATE_HEIGHT : 0);

  return (
    <div className="camera-reset" style={{ position: 'absolute', top, right: reach ? Math.round(reach + 8) : 10, zIndex: 10, pointerEvents: 'auto' }}>
      <MuButton
        file="newui_btn_empty.OZT"
        width={108}
        height={29}
        frames={{ up: 0, active: 1, down: 2 }}
        label={t('camera.reset')}
        labelStyle={{ fontWeight: 'bold', fontSize: 11 }}
        onClick={resetCamera}
      />
    </div>
  );
});
