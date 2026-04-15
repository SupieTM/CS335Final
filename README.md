# Mirror Room

WebGL2 real-time recursive ray tracer. First-person walk through a hall of neon-lit mirrors inspired by the hall of mirrors fight in *John Wick: Chapter 2*. Reflections bounce up to 15 times per pixel, mirrors shatter into Voronoi shards that fall and bounce on the floor, and the whole thing runs through a real HDR bloom pipeline.

CS335 final project, University of Kentucky.

## Requirements

- A browser with WebGL2 (any recent Chrome / Firefox / Edge)
- Node.js, only so `npx serve` works. No build step, no bundler, no npm install.

## Running

```bash
npx serve .
```

Then open http://localhost:3000. If port 3000 is busy, `serve` will print a different one.

Any static file server works. `python3 -m http.server` is fine too:

```bash
python3 -m http.server 8000
```

## Controls

| Key            | Action                                  |
|----------------|-----------------------------------------|
| Click overlay  | Lock pointer / enter the scene          |
| W A S D        | Move                                    |
| Shift          | Sprint                                  |
| Mouse          | Look                                    |
| Left click     | Shatter the mirror under the crosshair  |
| F              | Muzzle flash                            |
| R              | Repair all mirrors                      |
| Tab            | Hide / show the UI                      |
| Esc            | Release pointer lock                    |

The control panel in the top-left has sliders for bounce count, bloom strength, bloom threshold, mouse sensitivity, FOV, room layout, and color pickers for the three neon lights.

## Room layouts

- **Corridor** - long mirrored hallway, the classic infinite-reflection look
- **Labyrinth** - large room filled with free-standing mirror panels you can walk between, the closest match to the John Wick set
- **Open Room** - square room with two mirror walls and two matte walls
- **Hexagonal** - six-sided mirrored room

## Tests

```bash
npx serve .
# then open http://localhost:3000/tests/
```

54 unit + integration tests covering vector math, ray / plane / box / sphere intersection, multi-bounce reflection, fog, the room layouts, the camera controller, and lighting. The tests page also renders a few small WebGL canvases as visual sanity checks.

## Project layout

```
index.html
src/
  main.js                  entry point + render loop
  cameraController.js      FPS camera, pointer lock, WASD, box collision
  sceneGeometry.js         room layouts, JS-side raycasting for picking
  lightingManager.js       neon point lights + muzzle flash
  shatterManager.js        Voronoi seed generation per broken mirror
  shardParticleSystem.js   500-particle pool, physics, render
  bloomPostProcessor.js    HDR scene FBO + bright extract + blur + composite
  mathUtils.js             Vector3 + ray intersections
  shaderUtils.js           compile / link helpers
shaders/
  raytrace.vert/.frag      the ray tracer
  shard.vert/.frag         falling glass shard shader
  bloomExtract.frag        bright pass
  bloomBlur.frag           separable 5-tap Gaussian
  bloomComposite.frag      ACES tonemap + vignette + composite
tests/
  ...
```

## Notes on conventions

- Descriptive camelCase everywhere (`surfaceNormal`, not `n`). Same rule in GLSL.
- Room walls use inward-facing plane normals, equation `dot(p, n) + d = 0`.
- Camera right vector is `cross(worldUp, forward)` (not the other way around).
- No external dependencies. Pure WebGL2 + vanilla JS modules.
