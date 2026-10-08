import { afterEach, beforeEach, expect, test } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import type { LoadedModel } from '../common/modelLoader';
import { POOL_PER_MODEL, clearModelPool, returnModel, spareModelCount, takeModel } from './modelPool';

let engine: NullEngine;
let scene: Scene;

beforeEach(() => {
  engine = new NullEngine();
  scene = new Scene(engine);
});

afterEach(() => {
  clearModelPool();
  engine.dispose();
});

function fakeModel(): LoadedModel {
  const root = new Mesh('root', scene);
  const part = CreateBox('node_0', { size: 1 }, scene);
  part.parent = root;
  part.material = new StandardMaterial('own', scene);
  part.metadata = { diffuseTexture: 'sheet' };
  return { mesh: root, skeleton: null as never, animationGroups: [] };
}

test('a returned clone is handed out again, as it was loaded', async () => {
  let loads = 0;
  const load = async () => {
    loads++;
    return fakeModel();
  };

  const first = await takeModel('fx.glb', load);
  // A fresh load is handed out disabled too, until the spawn has dressed it.
  expect(first.mesh.isEnabled()).toBe(false);
  const part = first.mesh.getChildMeshes(false)[0];
  const original = part.material;

  // What a spawn does to it.
  const holder = new TransformNode('fxModel', scene);
  first.mesh.setParent(holder);
  part.material = new StandardMaterial('additive', scene);
  part.metadata.brightMesh = true;
  part.isVisible = false;
  part.alwaysSelectAsActiveMesh = true;
  const shine = (part as Mesh).clone('node_0:shine', part.parent);

  returnModel(first);
  holder.dispose(false, false);

  expect(first.mesh.isDisposed()).toBe(false);
  expect(shine.isDisposed()).toBe(true);
  expect(spareModelCount()).toBe(1);

  const again = await takeModel('fx.glb', load);
  expect(again).toBe(first);
  expect(loads).toBe(1);
  expect(part.material).toBe(original);
  expect(part.metadata).toEqual({ diffuseTexture: 'sheet' });
  expect(part.isVisible).toBe(true);
  expect(part.alwaysSelectAsActiveMesh).toBe(false);
  expect(again.mesh.parent).toBeNull();
  // Disabled until the spawn has dressed it: a clone never shows as the raw GLB.
  expect(again.mesh.isEnabled()).toBe(false);
});

test('keeps a bounded number per model and disposes the rest', async () => {
  const taken: LoadedModel[] = [];
  for (let i = 0; i < POOL_PER_MODEL + 3; i++) taken.push(await takeModel('fx.glb', async () => fakeModel()));
  for (const model of taken) returnModel(model);

  expect(spareModelCount()).toBe(POOL_PER_MODEL);
  expect(taken.filter(m => m.mesh.isDisposed()).length).toBe(3);
});

test('a clone that was not taken from the pool is just disposed', () => {
  const stray = fakeModel();
  returnModel(stray);
  expect(stray.mesh.isDisposed()).toBe(true);
  expect(spareModelCount()).toBe(0);
});
