// SPDX-License-Identifier: GPL-3.0-or-later
import type { Geometry } from './types.ts';

const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 200;
const DEFAULT_OFFSET = 30;

type Screen = { width: number; height: number };
type Defaults = { width: number; height: number; offset: number };

export const clampToScreen = (geom: Geometry, screen: Screen) => ({
  x: Math.max(0, Math.min(geom.x, screen.width - geom.width)),
  y: Math.max(0, Math.min(geom.y, screen.height - geom.height)),
  width: geom.width,
  height: geom.height,
});

export const nextCascadePosition = (
  taken: Geometry[],
  screen: Screen,
  defaults: Defaults = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, offset: DEFAULT_OFFSET },
) => {
  const { width, height, offset } = defaults;
  const origins = new Set(taken.map((g) => `${g.x},${g.y}`));
  let x = 0;
  let y = 0;
  while (origins.has(`${x},${y}`)) {
    const nx = x + offset;
    const ny = y + offset;
    if (nx + width > screen.width || ny + height > screen.height) {
      return { x: 0, y: 0, width, height };
    }
    x = nx;
    y = ny;
  }
  return { x, y, width, height };
};
