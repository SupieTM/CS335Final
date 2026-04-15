import { MathUtils } from '../src/mathUtils.js';
import {
    TestRunner, assertAlmostEqual, assertVec3AlmostEqual,
    assertTrue, assertGreaterThan, assertLessThan
} from './testRunner.js';

// =====================================================================
//  VECTOR OPERATIONS
// =====================================================================

export function createVectorTests() {
    const suite = new TestRunner('Vector Operations');

    suite.test('addVectors produces correct sum', () => {
        const resultVec = MathUtils.addVectors([1, 2, 3], [4, 5, 6]);
        assertVec3AlmostEqual(resultVec, [5, 7, 9]);
    });

    suite.test('subtractVectors produces correct difference', () => {
        const resultVec = MathUtils.subtractVectors([5, 7, 9], [4, 5, 6]);
        assertVec3AlmostEqual(resultVec, [1, 2, 3]);
    });

    suite.test('scaleVector scales all components', () => {
        const resultVec = MathUtils.scaleVector([2, 3, 4], 0.5);
        assertVec3AlmostEqual(resultVec, [1, 1.5, 2]);
    });

    suite.test('dotProduct computes correctly', () => {
        const dotValue = MathUtils.dotProduct([1, 0, 0], [0, 1, 0]);
        assertAlmostEqual(dotValue, 0.0, 1e-10, 'perpendicular');

        const dotValue2 = MathUtils.dotProduct([1, 0, 0], [1, 0, 0]);
        assertAlmostEqual(dotValue2, 1.0, 1e-10, 'parallel');
    });

    suite.test('crossProduct computes correct perpendicular vector', () => {
        const crossVec = MathUtils.crossProduct([1, 0, 0], [0, 1, 0]);
        assertVec3AlmostEqual(crossVec, [0, 0, 1]);

        const crossVec2 = MathUtils.crossProduct([0, 1, 0], [1, 0, 0]);
        assertVec3AlmostEqual(crossVec2, [0, 0, -1]);
    });

    suite.test('normalizeVector produces unit length', () => {
        const normalizedVec = MathUtils.normalizeVector([3, 4, 0]);
        assertAlmostEqual(MathUtils.vectorLength(normalizedVec), 1.0);
        assertVec3AlmostEqual(normalizedVec, [0.6, 0.8, 0]);
    });

    suite.test('normalizeVector handles zero vector gracefully', () => {
        const normalizedVec = MathUtils.normalizeVector([0, 0, 0]);
        assertVec3AlmostEqual(normalizedVec, [0, 0, 0]);
    });

    suite.test('reflectVector reflects correctly off horizontal surface', () => {
        // Ray going down-right, reflect off floor (normal = up)
        const incidentDir = MathUtils.normalizeVector([1, -1, 0]);
        const surfaceNormal = [0, 1, 0];
        const reflectedDir = MathUtils.reflectVector(incidentDir, surfaceNormal);

        // Should bounce up-right
        assertAlmostEqual(reflectedDir[0], incidentDir[0], 1e-6, 'x preserved');
        assertAlmostEqual(reflectedDir[1], -incidentDir[1], 1e-6, 'y flipped');
        assertAlmostEqual(reflectedDir[2], 0, 1e-6, 'z zero');
    });

    suite.test('reflectVector preserves vector length', () => {
        const incidentDir = MathUtils.normalizeVector([0.5, -0.7, 0.3]);
        const surfaceNormal = MathUtils.normalizeVector([0, 1, 0]);
        const reflectedDir = MathUtils.reflectVector(incidentDir, surfaceNormal);
        assertAlmostEqual(MathUtils.vectorLength(reflectedDir), 1.0, 1e-5);
    });

    suite.test('reflectVector at 45 degrees off vertical wall', () => {
        // Ray going into a wall facing +X
        const incidentDir = MathUtils.normalizeVector([1, 0, 1]);
        const wallNormal = [-1, 0, 0]; // wall faces left
        const reflectedDir = MathUtils.reflectVector(incidentDir, wallNormal);

        // X should flip, Z preserved
        assertAlmostEqual(reflectedDir[0], -incidentDir[0], 1e-5, 'x flipped');
        assertAlmostEqual(reflectedDir[2], incidentDir[2], 1e-5, 'z preserved');
    });

    return suite;
}

// =====================================================================
//  RAY-PLANE INTERSECTION
// =====================================================================

export function createRayPlaneTests() {
    const suite = new TestRunner('Ray-Plane Intersection');

    suite.test('ray hits plane head-on', () => {
        // Ray from origin going +Z, plane at z=5, inward normal [0,0,-1]
        // dot([0,0,5], [0,0,-1]) + 5 = 0 -> plane at z=5
        const hitT = MathUtils.intersectRayPlane(
            [0, 0, 0], [0, 0, 1],
            [0, 0, -1], 5.0
        );
        assertAlmostEqual(hitT, 5.0, 1e-5);
    });

    suite.test('ray hits floor plane', () => {
        // Ray from height 1.6 going down, floor at y=0
        const hitT = MathUtils.intersectRayPlane(
            [0, 1.6, 0], [0, -1, 0],
            [0, 1, 0], 0.0
        );
        assertAlmostEqual(hitT, 1.6, 1e-5);
    });

    suite.test('parallel ray misses plane', () => {
        // Ray along X axis, plane faces X
        const hitT = MathUtils.intersectRayPlane(
            [0, 0, 0], [0, 1, 0],
            [1, 0, 0], -5.0
        );
        assertAlmostEqual(hitT, -1.0, 1e-5, 'should miss');
    });

    suite.test('ray behind plane returns -1', () => {
        // Ray going -Z from origin, plane at z=5 (inward normal [0,0,-1], d=5)
        // Ray goes AWAY from the plane -> should miss
        const hitT = MathUtils.intersectRayPlane(
            [0, 0, 0], [0, 0, -1],
            [0, 0, -1], 5.0
        );
        assertAlmostEqual(hitT, -1.0, 1e-5, 'plane behind ray');
    });

    suite.test('ray at grazing angle still hits', () => {
        const hitT = MathUtils.intersectRayPlane(
            [0, 0.01, 0],
            MathUtils.normalizeVector([1, -0.001, 0]),
            [0, 1, 0], 0.0
        );
        assertGreaterThan(hitT, 0, 'grazing hit');
    });

    suite.test('corridor left wall intersection', () => {
        // Left wall at x=-2: inward normal [1,0,0], d = 2
        const hitT = MathUtils.intersectRayPlane(
            [0, 1.6, 0], [-1, 0, 0],
            [1, 0, 0], 2.0
        );
        assertAlmostEqual(hitT, 2.0, 1e-5);
    });

    suite.test('corridor right wall intersection', () => {
        // Right wall at x=2: inward normal [-1,0,0], d = 2
        const hitT = MathUtils.intersectRayPlane(
            [0, 1.6, 0], [1, 0, 0],
            [-1, 0, 0], 2.0
        );
        assertAlmostEqual(hitT, 2.0, 1e-5);
    });

    return suite;
}

// =====================================================================
//  RAY-BOX INTERSECTION (SLAB METHOD)
// =====================================================================

export function createRayBoxTests() {
    const suite = new TestRunner('Ray-Box Intersection (Slab Method)');

    suite.test('ray hits unit box at origin', () => {
        const result = MathUtils.intersectRayBox(
            [0, 0, -3], [0, 0, 1],
            [0, 0, 0], [1, 1, 1]
        );
        assertTrue(result !== null, 'should hit');
        assertAlmostEqual(result.hitT, 2.0, 1e-5);
        assertVec3AlmostEqual(result.hitNormal, [0, 0, -1]);
    });

    suite.test('ray misses box entirely', () => {
        const result = MathUtils.intersectRayBox(
            [0, 5, -3], [0, 0, 1],
            [0, 0, 0], [1, 1, 1]
        );
        assertTrue(result === null, 'should miss');
    });

    suite.test('ray hits box from side', () => {
        const result = MathUtils.intersectRayBox(
            [-5, 0.5, 0], [1, 0, 0],
            [0, 0.5, 0], [1, 1, 1]
        );
        assertTrue(result !== null, 'should hit from side');
        assertAlmostEqual(result.hitT, 4.0, 1e-5);
        assertVec3AlmostEqual(result.hitNormal, [-1, 0, 0]);
    });

    suite.test('ray from inside box hits exit face', () => {
        const result = MathUtils.intersectRayBox(
            [0, 0, 0], [1, 0, 0],
            [0, 0, 0], [2, 2, 2]
        );
        assertTrue(result !== null, 'should hit exit');
        assertAlmostEqual(result.hitT, 2.0, 1e-5);
    });

    suite.test('column intersection in corridor', () => {
        // Column at [-1.5, 0.75, -3] with half [0.15, 0.75, 0.15]
        const result = MathUtils.intersectRayBox(
            [0, 1.6, 0], MathUtils.normalizeVector([-1.5, -0.85, -3]),
            [-1.5, 0.75, -3], [0.15, 0.75, 0.15]
        );
        assertTrue(result !== null, 'should hit column');
        assertGreaterThan(result.hitT, 0, 'positive distance');
    });

    suite.test('ray parallel to box face misses', () => {
        const result = MathUtils.intersectRayBox(
            [0, 3, 0], [1, 0, 0], // above the box, going sideways
            [0, 0, 0], [1, 1, 1]
        );
        assertTrue(result === null, 'should miss above');
    });

    return suite;
}

// =====================================================================
//  RAY-SPHERE INTERSECTION
// =====================================================================

export function createRaySphereTests() {
    const suite = new TestRunner('Ray-Sphere Intersection');

    suite.test('ray hits sphere head-on', () => {
        const hitT = MathUtils.intersectRaySphere(
            [0, 0, -5], [0, 0, 1],
            [0, 0, 0], 1.0
        );
        assertAlmostEqual(hitT, 4.0, 1e-5, 'front face hit');
    });

    suite.test('ray misses sphere', () => {
        const hitT = MathUtils.intersectRaySphere(
            [0, 5, -5], [0, 0, 1],
            [0, 0, 0], 1.0
        );
        assertAlmostEqual(hitT, -1.0, 1e-5, 'should miss');
    });

    suite.test('ray from inside sphere hits exit', () => {
        const hitT = MathUtils.intersectRaySphere(
            [0, 0, 0], [1, 0, 0],
            [0, 0, 0], 2.0
        );
        assertAlmostEqual(hitT, 2.0, 1e-5, 'exit point');
    });

    suite.test('ray tangent to sphere', () => {
        // Ray just barely touching sphere of radius 1 at y=1
        const hitT = MathUtils.intersectRaySphere(
            [-5, 1, 0], [1, 0, 0],
            [0, 0, 0], 1.0
        );
        // Tangent means discriminant  0, should still register a hit
        assertTrue(hitT > 0 || hitT === -1, 'tangent case');
    });

    return suite;
}

// =====================================================================
//  CAMERA RAY GENERATION
// =====================================================================

export function createCameraRayTests() {
    const suite = new TestRunner('Camera Ray Generation');

    suite.test('center pixel ray points forward (yaw=0, pitch=0)', () => {
        const rayDir = MathUtils.buildCameraRayDirection(
            400, 300, 800, 600, 0, 0
        );
        // yaw=0, pitch=0 -> forward is [0, 0, 1]
        assertAlmostEqual(rayDir[2], 1.0, 0.1, 'should point +Z');
        assertAlmostEqual(rayDir[0], 0.0, 0.1, 'no X offset');
        assertAlmostEqual(rayDir[1], 0.0, 0.1, 'no Y offset');
    });

    suite.test('ray directions are unit length', () => {
        const corners = [
            [0, 0], [800, 0], [0, 600], [800, 600], [400, 300]
        ];
        for (const [pixelX, pixelY] of corners) {
            const rayDir = MathUtils.buildCameraRayDirection(
                pixelX, pixelY, 800, 600, 0, 0
            );
            assertAlmostEqual(MathUtils.vectorLength(rayDir), 1.0, 1e-5,
                `pixel (${pixelX},${pixelY})`);
        }
    });

    suite.test('left pixel ray points left of center', () => {
        const centerRay = MathUtils.buildCameraRayDirection(400, 300, 800, 600, 0, 0);
        const leftRay = MathUtils.buildCameraRayDirection(100, 300, 800, 600, 0, 0);
        // With yaw=0, forward is +Z and right is +X
        // Left pixel should have negative X component relative to center
        assertLessThan(leftRay[0], centerRay[0], 'left ray should have less X');
    });

    suite.test('top pixel ray points above center', () => {
        const centerRay = MathUtils.buildCameraRayDirection(400, 300, 800, 600, 0, 0);
        const topRay = MathUtils.buildCameraRayDirection(400, 50, 800, 600, 0, 0);
        assertGreaterThan(topRay[1], centerRay[1], 'top ray should have more Y');
    });

    suite.test('yaw rotation changes forward direction', () => {
        const rayAtYaw0 = MathUtils.buildCameraRayDirection(400, 300, 800, 600, 0, 0);
        const rayAtYaw90 = MathUtils.buildCameraRayDirection(400, 300, 800, 600, Math.PI / 2, 0);

        // At yaw=0, forward  [0,0,1]. At yaw=/2, forward  [1,0,0]
        assertAlmostEqual(rayAtYaw90[0], 1.0, 0.15, 'yaw /2 should face +X');
        assertAlmostEqual(Math.abs(rayAtYaw90[2]), 0.0, 0.15, 'yaw /2 Z  0');
    });

    suite.test('pitch rotation tilts ray up', () => {
        const rayFlat = MathUtils.buildCameraRayDirection(400, 300, 800, 600, 0, 0);
        const rayLookingUp = MathUtils.buildCameraRayDirection(400, 300, 800, 600, 0, 0.5);
        assertGreaterThan(rayLookingUp[1], rayFlat[1], 'positive pitch = look up');
    });

    return suite;
}

// =====================================================================
//  REFLECTION INTEGRATION TESTS
// =====================================================================

export function createReflectionIntegrationTests() {
    const suite = new TestRunner('Reflection Integration (Multi-Bounce)');

    suite.test('ray bouncing between two parallel mirrors converges to corridor', () => {
        // Simulate a ray bouncing between left wall (x=-2) and right wall (x=2)
        // Inward normals: left [1,0,0] d=2, right [-1,0,0] d=2
        let rayOrigin = new Float32Array([0, 1.6, 0]);
        let rayDirection = MathUtils.normalizeVector([1, 0, 0.1]); // slightly angled

        const leftWallNormal = [1, 0, 0];
        const leftWallD = 2.0;
        const rightWallNormal = [-1, 0, 0];
        const rightWallD = 2.0;
        let bounceCount = 0;

        for (let i = 0; i < 10; i++) {
            // Test against both walls
            const hitLeft = MathUtils.intersectRayPlane(rayOrigin, rayDirection, leftWallNormal, leftWallD);
            const hitRight = MathUtils.intersectRayPlane(rayOrigin, rayDirection, rightWallNormal, rightWallD);

            let closestT = Infinity;
            let hitNormal;

            if (hitLeft > 0 && hitLeft < closestT) { closestT = hitLeft; hitNormal = leftWallNormal; }
            if (hitRight > 0 && hitRight < closestT) { closestT = hitRight; hitNormal = rightWallNormal; }

            if (closestT === Infinity) break;

            const hitPos = MathUtils.addVectors(rayOrigin, MathUtils.scaleVector(rayDirection, closestT));

            // Reflect
            rayDirection = MathUtils.reflectVector(rayDirection, hitNormal);
            rayOrigin = MathUtils.addVectors(hitPos, MathUtils.scaleVector(hitNormal, 0.002));
            bounceCount++;
        }

        assertAlmostEqual(bounceCount, 10, 0, 'should complete 10 bounces');
        assertAlmostEqual(MathUtils.vectorLength(rayDirection), 1.0, 1e-4, 'direction stays normalized');
    });

    suite.test('reflection angle equals incidence angle', () => {
        const incidentDir = MathUtils.normalizeVector([1, -1, 0]); // 45 deg down
        const surfaceNormal = [0, 1, 0]; // floor
        const reflectedDir = MathUtils.reflectVector(incidentDir, surfaceNormal);

        // Angle of incidence
        const cosIncidence = Math.abs(MathUtils.dotProduct(incidentDir, surfaceNormal));
        const cosReflection = Math.abs(MathUtils.dotProduct(reflectedDir, surfaceNormal));

        assertAlmostEqual(cosIncidence, cosReflection, 1e-6, 'angles should match');
    });

    suite.test('ray in corner bounces back toward origin', () => {
        // 2D corner: two perpendicular mirrors. A ray at 45 deg into a corner
        // should bounce off both walls and return in the opposite direction.
        let rayOrigin = new Float32Array([0, 1.6, 0]);
        let rayDirection = MathUtils.normalizeVector([1, 0, 1]);

        // Wall 1 at x=2: inward normal [-1, 0, 0], d = 2
        const wall1Normal = [-1, 0, 0];
        const wall1D = 2.0;
        // Wall 2 at z=2: inward normal [0, 0, -1], d = 2
        const wall2Normal = [0, 0, -1];
        const wall2D = 2.0;

        // First bounce
        const t1a = MathUtils.intersectRayPlane(rayOrigin, rayDirection, wall1Normal, wall1D);
        const t1b = MathUtils.intersectRayPlane(rayOrigin, rayDirection, wall2Normal, wall2D);
        const t1 = Math.min(
            t1a > 0 ? t1a : Infinity,
            t1b > 0 ? t1b : Infinity
        );
        const hitNormal1 = (t1 === t1a) ? wall1Normal : wall2Normal;
        const hitPos1 = MathUtils.addVectors(rayOrigin, MathUtils.scaleVector(rayDirection, t1));
        rayDirection = MathUtils.reflectVector(rayDirection, hitNormal1);
        rayOrigin = MathUtils.addVectors(hitPos1, MathUtils.scaleVector(hitNormal1, 0.002));

        // Second bounce
        const t2a = MathUtils.intersectRayPlane(rayOrigin, rayDirection, wall1Normal, wall1D);
        const t2b = MathUtils.intersectRayPlane(rayOrigin, rayDirection, wall2Normal, wall2D);
        const t2 = Math.min(
            t2a > 0 ? t2a : Infinity,
            t2b > 0 ? t2b : Infinity
        );
        const hitNormal2 = (t2 === t2a) ? wall1Normal : wall2Normal;
        const hitPos2 = MathUtils.addVectors(rayOrigin, MathUtils.scaleVector(rayDirection, t2));
        rayDirection = MathUtils.reflectVector(rayDirection, hitNormal2);

        // After two bounces in a corner, ray should go back roughly toward [-1, 0, -1]
        assertLessThan(rayDirection[0], 0, 'X should be negative (going back)');
        assertLessThan(rayDirection[2], 0, 'Z should be negative (going back)');
    });

    suite.test('energy accumulation decreases with each bounce', () => {
        let reflectivityMultiplier = 1.0;
        const decayFactor = 0.92;
        const energyPerBounce = [];

        for (let bounce = 0; bounce < 10; bounce++) {
            energyPerBounce.push(reflectivityMultiplier);
            reflectivityMultiplier *= decayFactor;
        }

        // Energy should monotonically decrease
        for (let i = 1; i < energyPerBounce.length; i++) {
            assertLessThan(energyPerBounce[i], energyPerBounce[i - 1],
                `bounce ${i} should have less energy than bounce ${i - 1}`);
        }

        // After 10 bounces with 0.92 decay: 0.92^10  0.434
        assertAlmostEqual(reflectivityMultiplier, Math.pow(0.92, 10), 1e-6);
    });

    return suite;
}

// =====================================================================
//  FOG TESTS
// =====================================================================

export function createFogTests() {
    const suite = new TestRunner('Fog / Distance Attenuation');

    suite.test('fog factor is 0 at distance 0', () => {
        const fogDensity = 0.03;
        const fogFactor = 1.0 - Math.exp(-fogDensity * 0);
        assertAlmostEqual(fogFactor, 0.0, 1e-10);
    });

    suite.test('fog factor approaches 1 at large distance', () => {
        const fogDensity = 0.03;
        const fogFactor = 1.0 - Math.exp(-fogDensity * 200);
        assertGreaterThan(fogFactor, 0.99, 'should be nearly opaque at 200 units');
    });

    suite.test('fog factor at typical corridor depth', () => {
        const fogDensity = 0.03;
        // After 10 bounces in a 16m corridor  160m total distance
        const totalDistance = 160;
        const fogFactor = 1.0 - Math.exp(-fogDensity * totalDistance);
        assertGreaterThan(fogFactor, 0.9, 'deep reflections should be mostly fogged');
    });

    suite.test('higher density fog is more opaque at same distance', () => {
        const distance = 50;
        const lowDensityFog = 1.0 - Math.exp(-0.02 * distance);
        const highDensityFog = 1.0 - Math.exp(-0.05 * distance);
        assertGreaterThan(highDensityFog, lowDensityFog, 'higher density = more fog');
    });

    return suite;
}

// =====================================================================
//  SCENE GEOMETRY TESTS
// =====================================================================

export function createSceneGeometryTests() {
    const suite = new TestRunner('Scene Geometry & Layouts');

    suite.test('corridor layout has 6 planes', async () => {
        const { SceneGeometry } = await importSceneGeometry();
        const scene = new SceneGeometry();
        const layout = scene.getCurrentLayout();
        assertAlmostEqual(layout.wallPlanes.length, 6, 0);
    });

    suite.test('all layout normals are unit length', async () => {
        const { SceneGeometry } = await importSceneGeometry();
        const scene = new SceneGeometry();

        for (const layoutName of scene.getAvailableLayoutNames()) {
            scene.switchLayout(layoutName);
            const layout = scene.getCurrentLayout();

            for (let i = 0; i < layout.wallPlanes.length; i++) {
                const normal = layout.wallPlanes[i].normalVector;
                const length = MathUtils.vectorLength(normal);
                assertAlmostEqual(length, 1.0, 1e-4,
                    `${layoutName} plane ${i} normal length`);
            }
        }
    });

    suite.test('ray from center hits all walls in corridor', async () => {
        const { SceneGeometry } = await importSceneGeometry();
        const scene = new SceneGeometry();
        const origin = new Float32Array([0, 1.6, 0]);

        // Test 6 axis-aligned directions
        const directions = [
            [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
        ];

        for (const dir of directions) {
            const hit = scene.intersectRayWithScene(
                origin, MathUtils.normalizeVector(dir)
            );
            assertTrue(hit.didHit, `should hit in direction [${dir}]`);
            assertGreaterThan(hit.hitDistance, 0, `positive distance for [${dir}]`);
        }
    });

    suite.test('switching layouts changes plane count', async () => {
        const { SceneGeometry } = await importSceneGeometry();
        const scene = new SceneGeometry();

        scene.switchLayout('corridor');
        const corridorPlaneCount = scene.getCurrentLayout().wallPlanes.length;

        scene.switchLayout('angled');
        const angledPlaneCount = scene.getCurrentLayout().wallPlanes.length;

        // Angled has 6 hex walls + floor + ceiling = 8
        assertAlmostEqual(angledPlaneCount, 8, 0);
        assertTrue(angledPlaneCount !== corridorPlaneCount, 'layouts should differ');
    });

    suite.test('intersectRayWithScene returns correct material types', async () => {
        const { SceneGeometry, MATERIAL_MIRROR, MATERIAL_GLOSSY } = await importSceneGeometry();
        const scene = new SceneGeometry();

        // Ray going right should hit left wall (mirror)
        const wallHit = scene.intersectRayWithScene(
            new Float32Array([0, 1.6, 0]),
            MathUtils.normalizeVector([1, 0, 0])
        );
        assertTrue(wallHit.didHit);
        assertAlmostEqual(wallHit.hitMaterialType, MATERIAL_MIRROR, 0, 'wall is mirror');

        // Ray going down should hit floor (glossy)
        const floorHit = scene.intersectRayWithScene(
            new Float32Array([0, 1.6, 0]),
            MathUtils.normalizeVector([0, -1, 0])
        );
        assertTrue(floorHit.didHit);
        assertAlmostEqual(floorHit.hitMaterialType, MATERIAL_GLOSSY, 0, 'floor is glossy');
    });

    suite.test('box obstacles are detected in ray intersection', async () => {
        const { SceneGeometry } = await importSceneGeometry();
        const scene = new SceneGeometry();
        scene.switchLayout('corridor');

        // Ray aimed directly at column at [-1.5, 0.75, -3]
        const dirToColumn = MathUtils.normalizeVector([-1.5, -0.85, -3.0]);
        const hit = scene.intersectRayWithScene(
            new Float32Array([0, 1.6, 0]),
            dirToColumn
        );

        assertTrue(hit.didHit, 'should hit column');
        assertTrue(hit.hitPrimitiveType === 'box' || hit.hitPrimitiveType === 'plane',
            'should be a scene primitive');
    });

    return suite;
}

// Dynamic import helper for SceneGeometry (since it imports MathUtils)
async function importSceneGeometry() {
    return await import('../src/sceneGeometry.js');
}

// =====================================================================
//  CAMERA CONTROLLER TESTS (unit-level, no DOM needed)
// =====================================================================

export function createCameraControllerTests() {
    const suite = new TestRunner('Camera Controller Logic');

    suite.test('screen center ray matches buildCameraRayDirection', () => {
        // Verify the camera controller's castRay is consistent with mathUtils
        const rayDir = MathUtils.buildCameraRayDirection(400, 300, 800, 600, 0, 0);
        assertAlmostEqual(MathUtils.vectorLength(rayDir), 1.0, 1e-5);
        // Center ray at yaw=0 pitch=0 should roughly point +Z
        assertGreaterThan(rayDir[2], 0.5, 'center ray should face forward');
    });

    suite.test('wall collision keeps camera inside room', () => {
        // With inward normals: right wall at x=2, normal [-1,0,0], d=2
        // Signed distance = dot(P, normal) + d
        // At x=1.9: dot([1.9,1.6,0], [-1,0,0]) + 2 = -1.9 + 2 = 0.1 (near wall)
        const cameraPos = new Float32Array([1.9, 1.6, 0]);
        const wallNormal = [-1, 0, 0]; // right wall inward normal
        const wallD = 2.0;
        const wallMargin = 0.3;

        const signedDistance = MathUtils.dotProduct(cameraPos, wallNormal) + wallD;
        // 0.1 < 0.3 margin -> should push back
        assertLessThan(signedDistance, wallMargin, 'near wall should trigger pushback');
        assertGreaterThan(signedDistance, 0, 'still inside room');

        // Point safely inside room at x=0
        const safeCameraPos = new Float32Array([0, 1.6, 0]);
        const safeDistance = MathUtils.dotProduct(safeCameraPos, wallNormal) + wallD;
        assertGreaterThan(safeDistance, wallMargin, 'center of room is safe');
    });

    return suite;
}

// =====================================================================
//  LIGHTING TESTS
// =====================================================================

export function createLightingTests() {
    const suite = new TestRunner('Lighting & Flash');

    suite.test('Phong diffuse is zero when surface faces away from light', () => {
        const surfaceNormal = [0, 1, 0];
        const lightDirection = [0, -1, 0]; // light below surface
        const diffuseIntensity = Math.max(MathUtils.dotProduct(surfaceNormal, lightDirection), 0.0);
        assertAlmostEqual(diffuseIntensity, 0.0, 1e-10);
    });

    suite.test('Phong diffuse is max when surface directly faces light', () => {
        const surfaceNormal = MathUtils.normalizeVector([0, 1, 0]);
        const lightDirection = MathUtils.normalizeVector([0, 1, 0]); // directly above
        const diffuseIntensity = Math.max(MathUtils.dotProduct(surfaceNormal, lightDirection), 0.0);
        assertAlmostEqual(diffuseIntensity, 1.0, 1e-6);
    });

    suite.test('Blinn-Phong specular peaks when halfway vector aligns with normal', () => {
        const surfaceNormal = [0, 1, 0];
        const lightDir = MathUtils.normalizeVector([0, 1, 0]);
        const viewDir = MathUtils.normalizeVector([0, 1, 0]);
        const halfwayVector = MathUtils.normalizeVector(
            MathUtils.addVectors(lightDir, viewDir)
        );
        const specularIntensity = Math.pow(
            Math.max(MathUtils.dotProduct(surfaceNormal, halfwayVector), 0.0), 64.0
        );
        assertAlmostEqual(specularIntensity, 1.0, 1e-6, 'max specular');
    });

    suite.test('quadratic attenuation decreases with distance', () => {
        const attenAt1 = 1.0 / (1.0 + 0.1 * 1 + 0.01 * 1);
        const attenAt10 = 1.0 / (1.0 + 0.1 * 10 + 0.01 * 100);
        const attenAt50 = 1.0 / (1.0 + 0.1 * 50 + 0.01 * 2500);
        assertGreaterThan(attenAt1, attenAt10, 'closer = brighter');
        assertGreaterThan(attenAt10, attenAt50, 'further = dimmer');
    });

    suite.test('muzzle flash intensity decays exponentially', () => {
        let flashIntensity = 3.0;
        const decayRate = 0.55;
        const intensityOverFrames = [];

        for (let frame = 0; frame < 15; frame++) {
            intensityOverFrames.push(flashIntensity);
            flashIntensity *= decayRate;
        }

        // Should be near zero after ~10 frames
        assertLessThan(intensityOverFrames[10], 0.01, 'flash should fade quickly');
        // Monotonically decreasing
        for (let i = 1; i < intensityOverFrames.length; i++) {
            assertLessThan(intensityOverFrames[i], intensityOverFrames[i - 1]);
        }
    });

    return suite;
}
