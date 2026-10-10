/**
 * The OpenMU container through the Docker Engine API on its unix socket
 * (mounted into the panel's container by deploy/docker-compose.yml): state,
 * the tail of its log, and a restart - which is how configuration edits reach
 * the game server, since OpenMU reads its configuration at start-up.
 */

const SOCKET = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
const PROJECT = process.env.COMPOSE_PROJECT || 'mu-la-ronda';

type Container = { Id: string; State: string; Status: string; Created: number };

async function docker(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`http://localhost${path}`, { ...init, unix: SOCKET } as RequestInit);
}

async function findOpenmu(): Promise<Container | null> {
  const filters = encodeURIComponent(
    JSON.stringify({ label: [`com.docker.compose.project=${PROJECT}`, 'com.docker.compose.service=openmu'] })
  );
  const res = await docker(`/containers/json?all=1&filters=${filters}`);
  if (!res.ok) throw new Error(`Docker respondio ${res.status}`);
  const list = (await res.json()) as Container[];
  return list[0] ?? null;
}

export async function openmuStatus(): Promise<{ available: boolean; state?: string; status?: string; error?: string }> {
  try {
    const container = await findOpenmu();
    if (!container) return { available: false, error: 'No se encontro el contenedor de OpenMU' };
    return { available: true, state: container.State, status: container.Status };
  } catch (err) {
    return { available: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function restartOpenmu(): Promise<void> {
  const container = await findOpenmu();
  if (!container) throw new Error('No se encontro el contenedor de OpenMU');
  const res = await docker(`/containers/${container.Id}/restart?t=20`, { method: 'POST' });
  if (!res.ok && res.status !== 204) throw new Error(`No se pudo reiniciar (Docker ${res.status})`);
}

/** The last `tail` lines of OpenMU's output (stdout and stderr). */
export async function openmuLogs(tail: number): Promise<string[]> {
  const container = await findOpenmu();
  if (!container) return [];
  const res = await docker(`/containers/${container.Id}/logs?stdout=1&stderr=1&tail=${tail}&timestamps=1`);
  if (!res.ok) return [`(Docker ${res.status})`];

  // Without a TTY the stream is multiplexed: an 8-byte header (stream type,
  // three zero bytes, big-endian length) before every frame.
  const bytes = new Uint8Array(await res.arrayBuffer());
  const decoder = new TextDecoder();
  let text = '';
  let at = 0;
  while (at + 8 <= bytes.length) {
    const size = (bytes[at + 4] << 24) | (bytes[at + 5] << 16) | (bytes[at + 6] << 8) | bytes[at + 7];
    text += decoder.decode(bytes.subarray(at + 8, at + 8 + size));
    at += 8 + size;
  }
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '').split('\n').filter(Boolean);
}

/** Stops OpenMU (it saves and disconnects everyone on the way out). It stays off until started. */
export async function stopOpenmu(): Promise<void> {
  const container = await findOpenmu();
  if (!container) throw new Error('No se encontro el contenedor de OpenMU');
  const res = await docker(`/containers/${container.Id}/stop?t=30`, { method: 'POST' });
  // 304: it was already stopped.
  if (!res.ok && res.status !== 204 && res.status !== 304) throw new Error(`No se pudo apagar (Docker ${res.status})`);
}

export async function startOpenmu(): Promise<void> {
  const container = await findOpenmu();
  if (!container) throw new Error('No se encontro el contenedor de OpenMU');
  const res = await docker(`/containers/${container.Id}/start`, { method: 'POST' });
  if (!res.ok && res.status !== 204 && res.status !== 304) throw new Error(`No se pudo prender (Docker ${res.status})`);
}
