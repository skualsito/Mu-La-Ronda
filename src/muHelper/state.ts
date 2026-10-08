import { observable, reaction, runInAction } from 'mobx';
import { Store } from '../store';
import { MuHelperSaveDataRequestPacket } from '../common/packets/ClientToServerPackets';
import {
  decodeMuHelperConfig as decodeBlob,
  defaultMuHelperConfig,
  encodeMuHelperConfig,
  restoreExtraItemNames,
  type MuHelperConfig,
} from './config';

/**
 * Mu La Ronda: the extra items as typed, per character. The blob the server
 * keeps cuts each to 14 characters; the whole text lives here and is put back
 * over the cut one on every decode.
 */
const fullNamesKey = () => `mu_helper_extra:${Store.playerData.name ?? ''}`;

function readFullNames(): string[] {
  try {
    const raw = localStorage.getItem(fullNamesKey());
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeFullNames(names: readonly string[]): void {
  try {
    localStorage.setItem(fullNamesKey(), JSON.stringify(names));
  } catch {
    // Private mode: the cut names from the blob still work.
  }
}

function decodeMuHelperConfig(blob: Uint8Array): MuHelperConfig {
  const config = decodeBlob(blob);
  config.extraItems = restoreExtraItemNames(config.extraItems, readFullNames());
  return config;
}

/**
 * MU Helper state: the live config the loop follows and the window's draft.
 * Single writer of both; `logic.ts` keeps landing the raw blob in
 * `Store.muHelper.config` and a reaction decodes it here (the deferred
 * pattern of `skills/buffs.ts` - at module evaluation `Store` is still in
 * its temporal dead zone).
 */
export const MuHelperState = observable({
  windowOpen: false,
  config: defaultMuHelperConfig() as MuHelperConfig,
  draft: defaultMuHelperConfig() as MuHelperConfig,
});

/** Canonical clone: what survives the wire is what the copy holds. */
function cloneConfig(config: MuHelperConfig): MuHelperConfig {
  return decodeMuHelperConfig(encodeMuHelperConfig(config));
}

let stopWatching: (() => void) | null = null;

/** Start following the stored blob. Safe to call every frame/render. */
export function ensureMuHelperWatching(): void {
  if (stopWatching) return;
  stopWatching = reaction(
    () => Store.muHelper.config,
    blob => {
      if (!blob) return;
      runInAction(() => {
        MuHelperState.config = decodeMuHelperConfig(blob);
        // A save echo while the window is up must not stomp live edits.
        if (!MuHelperState.windowOpen) {
          MuHelperState.draft = cloneConfig(MuHelperState.config);
        }
      });
    },
    { fireImmediately: true }
  );
}

export function toggleMuHelperWindow(open?: boolean): void {
  ensureMuHelperWatching();
  runInAction(() => {
    const next = open ?? !MuHelperState.windowOpen;
    if (next) MuHelperState.draft = cloneConfig(MuHelperState.config);
    MuHelperState.windowOpen = next;
  });
}

/** The Init button (`CNewUIMuHelper::Reset` defaults). */
export function resetMuHelperDraft(): void {
  runInAction(() => {
    MuHelperState.draft = defaultMuHelperConfig();
  });
}

/**
 * `SaveConfig` (NewUIMuHelper.cpp:1095-1116): apply the draft and send
 * `MuHelperSaveDataRequest`; the server echoes `MuHelperConfigurationData`.
 * Offline the config only applies locally.
 */
export function saveMuHelperConfig(): void {
  writeFullNames(MuHelperState.draft.extraItems);
  const blob = encodeMuHelperConfig(MuHelperState.draft);
  runInAction(() => {
    MuHelperState.config = decodeMuHelperConfig(blob);
    MuHelperState.windowOpen = false;
  });
  if (Store.isOffline) return;
  const packet = MuHelperSaveDataRequestPacket.createPacket();
  packet.setHelperData(blob);
  Store.sendToGS(packet.buffer);
}
