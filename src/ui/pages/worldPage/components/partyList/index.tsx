import './style.less';
import { observer } from 'mobx-react-lite';
import { runInAction } from 'mobx';
import { Store } from '../../../../../store';
import { Social } from '../../../../../social';

/**
 * Mu La Ronda: `CNewUIPartyListWindow`, the original's party list at the top
 * left: every other member with their health, always on while in a party
 * (the party window only opens with its key now). The leader is row 0 of
 * the server's list and gets the gold name; a member on another map is dimmed.
 * Clicking a row opens the party window.
 */
export const PartyList = observer(() => {
  if (!Social.inParty || Store.hudHidden) return null;

  const me = Store.playerData.name;
  const leader = Social.partyMembers[0]?.name;
  const myMap = Store.world?.mapIndex;
  const others = Social.partyMembers.filter(m => m.name !== me);
  if (!others.length) return null;

  return (
    <div className="party-list" data-no-drag="true">
      {others.map(m => {
        // PartyHealthUpdate's tenths once it arrived, else the list's own numbers.
        const fraction =
          m.healthStep >= 0
            ? m.healthStep / 10
            : m.maximumHealth > 0
              ? Math.max(0, Math.min(1, m.currentHealth / m.maximumHealth))
              : 1;
        const away = myMap !== undefined && m.mapId !== myMap;
        return (
          <div
            key={m.name}
            className={`party-list-row${away ? ' is-away' : ''}`}
            title={away ? 'En otro mapa' : undefined}
            onClick={() => runInAction(() => (Social.partyWindowEnabled = true))}
          >
            <span className={`party-list-name${m.name === leader ? ' is-leader' : ''}`}>{m.name}</span>
            <span className="party-list-bar">
              <span className="party-list-fill" style={{ width: `${Math.round(fraction * 100)}%` }} />
            </span>
          </div>
        );
      })}
    </div>
  );
});
