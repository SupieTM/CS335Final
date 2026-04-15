import { MathUtils } from './mathUtils.js';

// Material constants - shared with the shader via uniform ints
export const MATERIAL_MIRROR = 0;
export const MATERIAL_MATTE = 1;
export const MATERIAL_GLOSSY = 2;

export class SceneGeometry {
    constructor() {
        this.currentLayoutName = 'corridor';
        this.layouts = this._buildAllLayouts();
    }

    // -- Layout Definitions ------------------------------------------

    _buildAllLayouts() {
        return {
            corridor: {
                // Room spans x in [-2, 2], z in [-8, 8], y in [0, 3.5]
                // All normals point INWARD for correct Phong lighting.
                // Plane eq: dot(P, normal) + d = 0
                wallPlanes: [
                    // Left wall at x = -2, inward normal [1,0,0]
                    { normalVector: [1, 0, 0],  distanceFromOrigin: 2.0,   materialType: MATERIAL_MIRROR },
                    // Right wall at x = 2, inward normal [-1,0,0]
                    { normalVector: [-1, 0, 0], distanceFromOrigin: 2.0,   materialType: MATERIAL_MIRROR },
                    // Back wall at z = -8, inward normal [0,0,1]
                    { normalVector: [0, 0, 1],  distanceFromOrigin: 8.0,   materialType: MATERIAL_MIRROR },
                    // Front wall at z = 8, inward normal [0,0,-1]
                    { normalVector: [0, 0, -1], distanceFromOrigin: 8.0,   materialType: MATERIAL_MIRROR },
                    // Floor at y = 0, inward normal [0,1,0]
                    { normalVector: [0, 1, 0],  distanceFromOrigin: 0.0,   materialType: MATERIAL_GLOSSY },
                    // Ceiling at y = 3.5, inward normal [0,-1,0]
                    { normalVector: [0, -1, 0], distanceFromOrigin: 3.5,   materialType: MATERIAL_MATTE },
                ],
                boxObstacles: [
                    { centerPosition: [-1.5, 0.75, -3.0], halfExtentSize: [0.15, 0.75, 0.15], materialType: MATERIAL_MATTE },
                    { centerPosition: [1.5, 0.75, -3.0],  halfExtentSize: [0.15, 0.75, 0.15], materialType: MATERIAL_MATTE },
                    { centerPosition: [-1.5, 0.75, 3.0],  halfExtentSize: [0.15, 0.75, 0.15], materialType: MATERIAL_MATTE },
                    { centerPosition: [1.5, 0.75, 3.0],   halfExtentSize: [0.15, 0.75, 0.15], materialType: MATERIAL_MATTE },
                ],
                backgroundColor: [0.02, 0.01, 0.03],
                fogDensityValue: 0.03,
            },

            openRoom: {
                // Room spans x in [-5, 5], z in [-5, 5], y in [0, 4]
                wallPlanes: [
                    // Left wall at x = -5, inward normal [1,0,0]
                    { normalVector: [1, 0, 0],  distanceFromOrigin: 5.0,   materialType: MATERIAL_MIRROR },
                    // Right wall at x = 5, inward normal [-1,0,0]
                    { normalVector: [-1, 0, 0], distanceFromOrigin: 5.0,   materialType: MATERIAL_MIRROR },
                    // Back wall at z = -5, inward normal [0,0,1]
                    { normalVector: [0, 0, 1],  distanceFromOrigin: 5.0,   materialType: MATERIAL_MATTE },
                    // Front wall at z = 5, inward normal [0,0,-1]
                    { normalVector: [0, 0, -1], distanceFromOrigin: 5.0,   materialType: MATERIAL_MATTE },
                    // Floor
                    { normalVector: [0, 1, 0],  distanceFromOrigin: 0.0,   materialType: MATERIAL_GLOSSY },
                    // Ceiling at y = 4
                    { normalVector: [0, -1, 0], distanceFromOrigin: 4.0,   materialType: MATERIAL_MATTE },
                ],
                boxObstacles: [
                    { centerPosition: [0, 1.0, 0], halfExtentSize: [0.5, 1.0, 0.5], materialType: MATERIAL_MATTE },
                ],
                backgroundColor: [0.01, 0.01, 0.02],
                fogDensityValue: 0.02,
            },

            labyrinth: (() => {
                // Larger room: x in [-6, 6], z in [-8, 8], y in [0, 4]
                // Outer walls all mirrored. Inside: a maze of free-standing
                // mirror panels modeled as thin axis-aligned boxes (the
                // hallway-of-mirrors set from the John Wick sequence).
                const panelHalfHeight = 1.2;
                const panelThickness = 0.04;
                const panelCenterY = 1.2;

                // Helper to make a panel that runs along the X axis (long in X)
                const panelAlongX = (cx, cz, halfLength) => ({
                    centerPosition: [cx, panelCenterY, cz],
                    halfExtentSize: [halfLength, panelHalfHeight, panelThickness],
                    materialType: MATERIAL_MIRROR,
                    isBroken: false,
                });
                // ... or along Z (long in Z)
                const panelAlongZ = (cx, cz, halfLength) => ({
                    centerPosition: [cx, panelCenterY, cz],
                    halfExtentSize: [panelThickness, panelHalfHeight, halfLength],
                    materialType: MATERIAL_MIRROR,
                    isBroken: false,
                });

                return {
                    wallPlanes: [
                        { normalVector: [1, 0, 0],  distanceFromOrigin: 6.0,  materialType: MATERIAL_MIRROR },
                        { normalVector: [-1, 0, 0], distanceFromOrigin: 6.0,  materialType: MATERIAL_MIRROR },
                        { normalVector: [0, 0, 1],  distanceFromOrigin: 8.0,  materialType: MATERIAL_MIRROR },
                        { normalVector: [0, 0, -1], distanceFromOrigin: 8.0,  materialType: MATERIAL_MIRROR },
                        { normalVector: [0, 1, 0],  distanceFromOrigin: 0.0,  materialType: MATERIAL_GLOSSY },
                        { normalVector: [0, -1, 0], distanceFromOrigin: 4.0,  materialType: MATERIAL_MATTE },
                    ],
                    boxObstacles: [
                        // -- entry zone
                        panelAlongZ(-3.0, -6.5, 0.7),
                        panelAlongZ( 3.0, -6.5, 0.7),
                        panelAlongX(-1.2, -5.0, 0.9),
                        panelAlongX( 1.2, -5.0, 0.9),

                        // -- staggered cluster around z=-3
                        panelAlongZ(-4.2, -3.0, 1.1),
                        panelAlongZ( 0.0, -3.0, 1.0),
                        panelAlongZ( 4.2, -3.0, 1.1),
                        panelAlongX(-2.5, -1.4, 1.0),
                        panelAlongX( 2.5, -1.4, 1.0),

                        // -- center pinch
                        panelAlongZ(-2.8,  0.5, 1.0),
                        panelAlongZ( 2.8,  0.5, 1.0),
                        panelAlongX( 0.0,  1.8, 1.4),

                        // -- back cluster
                        panelAlongZ(-4.2,  3.5, 1.0),
                        panelAlongZ( 0.0,  3.5, 1.0),
                        panelAlongZ( 4.2,  3.5, 1.0),
                        panelAlongX(-2.5,  5.0, 1.0),
                        panelAlongX( 2.5,  5.0, 1.0),

                        // -- exit zone
                        panelAlongZ(-3.0,  6.5, 0.7),
                        panelAlongZ( 3.0,  6.5, 0.7),
                        panelAlongX( 0.0,  6.8, 1.2),
                    ],
                    backgroundColor: [0.015, 0.008, 0.025],
                    fogDensityValue: 0.025,
                };
            })(),

            angled: {
                wallPlanes: (() => {
                    // Hexagonal room - 6 walls at 60 deg increments, all mirrored
                    // Normals point INWARD (toward room center)
                    const hexagonalWallPlanes = [];
                    const wallDistanceFromCenter = 4.0;
                    for (let wallIndex = 0; wallIndex < 6; wallIndex++) {
                        const angleRadians = (wallIndex / 6) * Math.PI * 2;
                        // Inward normal = negated outward direction
                        const inwardNormalX = -Math.cos(angleRadians);
                        const inwardNormalZ = -Math.sin(angleRadians);
                        hexagonalWallPlanes.push({
                            normalVector: [inwardNormalX, 0, inwardNormalZ],
                            distanceFromOrigin: wallDistanceFromCenter,
                            materialType: MATERIAL_MIRROR,
                        });
                    }
                    // Floor + ceiling (inward normals)
                    hexagonalWallPlanes.push(
                        { normalVector: [0, 1, 0],  distanceFromOrigin: 0.0,  materialType: MATERIAL_GLOSSY },
                        { normalVector: [0, -1, 0], distanceFromOrigin: 3.5,  materialType: MATERIAL_MATTE },
                    );
                    return hexagonalWallPlanes;
                })(),
                boxObstacles: [],
                backgroundColor: [0.02, 0.01, 0.04],
                fogDensityValue: 0.025,
            },
        };
    }

    getCurrentLayout() {
        return this.layouts[this.currentLayoutName];
    }

    switchLayout(layoutName) {
        if (this.layouts[layoutName]) {
            this.currentLayoutName = layoutName;
            return true;
        }
        return false;
    }

    getAvailableLayoutNames() {
        return Object.keys(this.layouts);
    }

    breakBoxByIndex(boxIndex) {
        const layout = this.getCurrentLayout();
        if (boxIndex >= 0 && boxIndex < layout.boxObstacles.length) {
            layout.boxObstacles[boxIndex].isBroken = true;
        }
    }

    resetBrokenBoxes() {
        for (const layoutName of Object.keys(this.layouts)) {
            for (const box of this.layouts[layoutName].boxObstacles) {
                box.isBroken = false;
            }
        }
    }

    // -- JS-Side Ray Intersection (for mouse picking) ----------------
    // Same math as Project 1 CPU ray tracer & the GLSL shader.

    intersectRayWithScene(rayOrigin, rayDirection) {
        const currentLayout = this.getCurrentLayout();
        let closestHitDistance = Infinity;
        let closestHitResult = null;

        // Test planes
        for (let planeIndex = 0; planeIndex < currentLayout.wallPlanes.length; planeIndex++) {
            const plane = currentLayout.wallPlanes[planeIndex];
            const planeNormal = new Float32Array(plane.normalVector);
            const hitT = MathUtils.intersectRayPlane(
                rayOrigin, rayDirection,
                planeNormal, plane.distanceFromOrigin
            );

            if (hitT > 0 && hitT < closestHitDistance) {
                const hitPosition = MathUtils.addVectors(
                    rayOrigin,
                    MathUtils.scaleVector(rayDirection, hitT)
                );

                // Compute 2D UV on the plane for shattering
                const hitSurfaceUV = this._computePlaneUV(hitPosition, planeNormal);

                closestHitDistance = hitT;
                closestHitResult = {
                    didHit: true,
                    hitDistance: hitT,
                    hitPosition: hitPosition,
                    hitNormal: planeNormal,
                    hitPlaneIndex: planeIndex,
                    hitSurfaceUV: hitSurfaceUV,
                    hitMaterialType: plane.materialType,
                    hitPrimitiveType: 'plane',
                };
            }
        }

        // Test boxes
        for (let boxIndex = 0; boxIndex < currentLayout.boxObstacles.length; boxIndex++) {
            const box = currentLayout.boxObstacles[boxIndex];
            if (box.isBroken) continue;
            const boxResult = MathUtils.intersectRayBox(
                rayOrigin, rayDirection,
                new Float32Array(box.centerPosition),
                new Float32Array(box.halfExtentSize)
            );

            if (boxResult && boxResult.hitT < closestHitDistance) {
                const hitPosition = MathUtils.addVectors(
                    rayOrigin,
                    MathUtils.scaleVector(rayDirection, boxResult.hitT)
                );
                closestHitDistance = boxResult.hitT;
                closestHitResult = {
                    didHit: true,
                    hitDistance: boxResult.hitT,
                    hitPosition: hitPosition,
                    hitNormal: boxResult.hitNormal,
                    hitPlaneIndex: -1,
                    hitBoxIndex: boxIndex,
                    hitSurfaceUV: [0, 0],
                    hitMaterialType: box.materialType,
                    hitPrimitiveType: 'box',
                };
            }
        }

        if (!closestHitResult) {
            return { didHit: false, hitDistance: -1, hitPosition: null, hitNormal: null, hitPlaneIndex: -1 };
        }

        return closestHitResult;
    }

    /**
     * Project a 3D hit point onto a plane's local 2D coordinate system.
     * Used to map Voronoi seeds for shattering.
     */
    _computePlaneUV(hitPosition, planeNormal) {
        const absoluteNormal = [Math.abs(planeNormal[0]), Math.abs(planeNormal[1]), Math.abs(planeNormal[2])];

        // Choose tangent axes based on which axis the normal is closest to
        if (absoluteNormal[1] > absoluteNormal[0] && absoluteNormal[1] > absoluteNormal[2]) {
            // Horizontal plane (floor/ceiling) -> use xz
            return [hitPosition[0], hitPosition[2]];
        } else if (absoluteNormal[0] > absoluteNormal[2]) {
            // Facing +/-X -> use yz
            return [hitPosition[2], hitPosition[1]];
        } else {
            // Facing +/-Z -> use xy
            return [hitPosition[0], hitPosition[1]];
        }
    }

    // -- Uniform Upload ----------------------------------------------

    uploadSceneUniforms(glContext, shaderProgram) {
        const layout = this.getCurrentLayout();

        // Flatten plane data
        const planeNormalData = new Float32Array(16 * 3); // max 16 planes  vec3
        const planeDistanceData = new Float32Array(16);
        const planeMaterialData = new Int32Array(16);

        for (let i = 0; i < layout.wallPlanes.length; i++) {
            const plane = layout.wallPlanes[i];
            planeNormalData[i * 3 + 0] = plane.normalVector[0];
            planeNormalData[i * 3 + 1] = plane.normalVector[1];
            planeNormalData[i * 3 + 2] = plane.normalVector[2];
            planeDistanceData[i] = plane.distanceFromOrigin;
            planeMaterialData[i] = plane.materialType;
        }

        glContext.uniform3fv(glContext.getUniformLocation(shaderProgram, 'planeNormals'), planeNormalData);
        glContext.uniform1fv(glContext.getUniformLocation(shaderProgram, 'planeDistances'), planeDistanceData);
        glContext.uniform1iv(glContext.getUniformLocation(shaderProgram, 'planeMaterialTypes'), planeMaterialData);
        glContext.uniform1i(glContext.getUniformLocation(shaderProgram, 'activePlaneCount'), layout.wallPlanes.length);

        // Flatten box data (max 32)
        const maxBoxCount = 32;
        const boxCenterData = new Float32Array(maxBoxCount * 3);
        const boxHalfExtentData = new Float32Array(maxBoxCount * 3);
        const boxMaterialData = new Int32Array(maxBoxCount);
        const boxBrokenData = new Int32Array(maxBoxCount);

        for (let i = 0; i < layout.boxObstacles.length; i++) {
            const box = layout.boxObstacles[i];
            boxCenterData[i * 3 + 0] = box.centerPosition[0];
            boxCenterData[i * 3 + 1] = box.centerPosition[1];
            boxCenterData[i * 3 + 2] = box.centerPosition[2];
            boxHalfExtentData[i * 3 + 0] = box.halfExtentSize[0];
            boxHalfExtentData[i * 3 + 1] = box.halfExtentSize[1];
            boxHalfExtentData[i * 3 + 2] = box.halfExtentSize[2];
            boxMaterialData[i] = box.materialType;
            boxBrokenData[i] = box.isBroken ? 1 : 0;
        }

        glContext.uniform3fv(glContext.getUniformLocation(shaderProgram, 'boxCenterPositions'), boxCenterData);
        glContext.uniform3fv(glContext.getUniformLocation(shaderProgram, 'boxHalfExtents'), boxHalfExtentData);
        glContext.uniform1iv(glContext.getUniformLocation(shaderProgram, 'boxMaterialTypes'), boxMaterialData);
        glContext.uniform1iv(glContext.getUniformLocation(shaderProgram, 'isBoxBroken'), boxBrokenData);
        glContext.uniform1i(glContext.getUniformLocation(shaderProgram, 'activeBoxCount'), layout.boxObstacles.length);

        // Fog and background
        glContext.uniform3fv(glContext.getUniformLocation(shaderProgram, 'backgroundColorValue'), new Float32Array(layout.backgroundColor));
        glContext.uniform1f(glContext.getUniformLocation(shaderProgram, 'fogDensityValue'), layout.fogDensityValue);
    }
}
