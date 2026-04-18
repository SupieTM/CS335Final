import { MathUtils } from './mathUtils.js';

export const MATERIAL_MIRROR = 0;
export const MATERIAL_MATTE = 1;
export const MATERIAL_GLOSSY = 2;

export class SceneGeometry {
    constructor() {
        this.currentLayoutName = 'corridor';
        this.layouts = this._buildAllLayouts();
    }

    _buildAllLayouts() {
        const corridor = {
            wallPlanes: [
                { normalVector: [1, 0, 0],  distanceFromOrigin: 2.0, materialType: MATERIAL_MIRROR },
                { normalVector: [-1, 0, 0], distanceFromOrigin: 2.0, materialType: MATERIAL_MIRROR },
                { normalVector: [0, 0, 1],  distanceFromOrigin: 8.0, materialType: MATERIAL_MIRROR },
                { normalVector: [0, 0, -1], distanceFromOrigin: 8.0, materialType: MATERIAL_MIRROR },
                { normalVector: [0, 1, 0],  distanceFromOrigin: 0.0, materialType: MATERIAL_GLOSSY },
                { normalVector: [0, -1, 0], distanceFromOrigin: 3.5, materialType: MATERIAL_MATTE },
            ],
            boxObstacles: [
                { centerPosition: [-1.5, 0.75, -3.0], halfExtentSize: [0.15, 0.75, 0.15], materialType: MATERIAL_MATTE },
                { centerPosition: [1.5, 0.75, -3.0],  halfExtentSize: [0.15, 0.75, 0.15], materialType: MATERIAL_MATTE },
                { centerPosition: [-1.5, 0.75, 3.0],  halfExtentSize: [0.15, 0.75, 0.15], materialType: MATERIAL_MATTE },
                { centerPosition: [1.5, 0.75, 3.0],   halfExtentSize: [0.15, 0.75, 0.15], materialType: MATERIAL_MATTE },
            ],
            doors: [],
            backgroundColor: [0.02, 0.01, 0.03],
            fogDensityValue: 0.03,
        };

        const openRoom = {
            wallPlanes: [
                { normalVector: [1, 0, 0],  distanceFromOrigin: 5.0, materialType: MATERIAL_MIRROR },
                { normalVector: [-1, 0, 0], distanceFromOrigin: 5.0, materialType: MATERIAL_MIRROR },
                { normalVector: [0, 0, 1],  distanceFromOrigin: 5.0, materialType: MATERIAL_MATTE },
                { normalVector: [0, 0, -1], distanceFromOrigin: 5.0, materialType: MATERIAL_MATTE },
                { normalVector: [0, 1, 0],  distanceFromOrigin: 0.0, materialType: MATERIAL_GLOSSY },
                { normalVector: [0, -1, 0], distanceFromOrigin: 4.0, materialType: MATERIAL_MATTE },
            ],
            boxObstacles: [
                { centerPosition: [0, 1.0, 0], halfExtentSize: [0.5, 1.0, 0.5], materialType: MATERIAL_MATTE },
            ],
            doors: [],
            backgroundColor: [0.01, 0.01, 0.02],
            fogDensityValue: 0.02,
        };

        const labyrinth = this._buildLabyrinth();
        const angled = this._buildHexagonal();
        const doors = this._buildDoorsRoom();

        return { corridor, openRoom, labyrinth, angled, doors };
    }

    _buildLabyrinth() {
        const panelHalfHeight = 1.2;
        const panelThickness = 0.04;
        const panelCenterY = 1.2;

        const alongX = (cx, cz, halfLength) => ({
            centerPosition: [cx, panelCenterY, cz],
            halfExtentSize: [halfLength, panelHalfHeight, panelThickness],
            materialType: MATERIAL_MIRROR,
            isBroken: false,
        });
        const alongZ = (cx, cz, halfLength) => ({
            centerPosition: [cx, panelCenterY, cz],
            halfExtentSize: [panelThickness, panelHalfHeight, halfLength],
            materialType: MATERIAL_MIRROR,
            isBroken: false,
        });

        return {
            wallPlanes: [
                { normalVector: [1, 0, 0],  distanceFromOrigin: 6.0, materialType: MATERIAL_MIRROR },
                { normalVector: [-1, 0, 0], distanceFromOrigin: 6.0, materialType: MATERIAL_MIRROR },
                { normalVector: [0, 0, 1],  distanceFromOrigin: 8.0, materialType: MATERIAL_MIRROR },
                { normalVector: [0, 0, -1], distanceFromOrigin: 8.0, materialType: MATERIAL_MIRROR },
                { normalVector: [0, 1, 0],  distanceFromOrigin: 0.0, materialType: MATERIAL_GLOSSY },
                { normalVector: [0, -1, 0], distanceFromOrigin: 4.0, materialType: MATERIAL_MATTE },
            ],
            boxObstacles: [
                alongZ(-3.0, -6.5, 0.7),
                alongZ( 3.0, -6.5, 0.7),
                alongX(-1.2, -5.0, 0.9),
                alongX( 1.2, -5.0, 0.9),
                alongZ(-4.2, -3.0, 1.1),
                alongZ( 0.0, -3.0, 1.0),
                alongZ( 4.2, -3.0, 1.1),
                alongX(-2.5, -1.4, 1.0),
                alongX( 2.5, -1.4, 1.0),
                alongZ(-2.8,  0.5, 1.0),
                alongZ( 2.8,  0.5, 1.0),
                alongX( 0.0,  1.8, 1.4),
                alongZ(-4.2,  3.5, 1.0),
                alongZ( 0.0,  3.5, 1.0),
                alongZ( 4.2,  3.5, 1.0),
                alongX(-2.5,  5.0, 1.0),
                alongX( 2.5,  5.0, 1.0),
                alongZ(-3.0,  6.5, 0.7),
                alongZ( 3.0,  6.5, 0.7),
                alongX( 0.0,  6.8, 1.2),
            ],
            doors: [],
            backgroundColor: [0.015, 0.008, 0.025],
            fogDensityValue: 0.025,
        };
    }

    _buildHexagonal() {
        const hexWalls = [];
        const wallDist = 4.0;
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            hexWalls.push({
                normalVector: [-Math.cos(a), 0, -Math.sin(a)],
                distanceFromOrigin: wallDist,
                materialType: MATERIAL_MIRROR,
            });
        }
        hexWalls.push(
            { normalVector: [0, 1, 0],  distanceFromOrigin: 0.0, materialType: MATERIAL_GLOSSY },
            { normalVector: [0, -1, 0], distanceFromOrigin: 3.5, materialType: MATERIAL_MATTE },
        );
        return {
            wallPlanes: hexWalls,
            boxObstacles: [],
            doors: [],
            backgroundColor: [0.02, 0.01, 0.04],
            fogDensityValue: 0.025,
        };
    }

    _buildDoorsRoom() {
        // Room: x in [-5, 5], z in [-10, 10], y in [0, 4]. Three internal
        // walls divide it into four chambers. Each internal wall is two
        // mirror segments flanking a 1.4-wide doorway; the door itself
        // is two mirror panels that slide apart along the wall's tangent.
        const boxes = [];
        const doors = [];

        const panelHalfWidth = 0.35;
        const panelHalfHeight = 1.25;
        const panelHalfThickness = 0.04;
        const centerY = 1.25;
        const doorHalfOpening = panelHalfWidth * 2;  // 0.7
        const openSlideDistance = 0.7;

        // each entry: wall at z=zWall, doorway centered at x=doorX
        const walls = [
            { zWall: -5.0, doorX:  0.0 },
            { zWall:  0.0, doorX: -2.0 },
            { zWall:  5.0, doorX:  2.0 },
        ];

        const roomMinX = -5.0;
        const roomMaxX =  5.0;

        for (const w of walls) {
            const leftCenterX  = (roomMinX + (w.doorX - doorHalfOpening)) * 0.5;
            const leftHalfX    = ((w.doorX - doorHalfOpening) - roomMinX) * 0.5;
            const rightCenterX = ((w.doorX + doorHalfOpening) + roomMaxX) * 0.5;
            const rightHalfX   = (roomMaxX - (w.doorX + doorHalfOpening)) * 0.5;

            if (leftHalfX > 0.01) {
                boxes.push({
                    centerPosition: [leftCenterX, centerY, w.zWall],
                    halfExtentSize: [leftHalfX, panelHalfHeight, panelHalfThickness],
                    materialType: MATERIAL_MIRROR,
                    isBroken: false,
                });
            }
            if (rightHalfX > 0.01) {
                boxes.push({
                    centerPosition: [rightCenterX, centerY, w.zWall],
                    halfExtentSize: [rightHalfX, panelHalfHeight, panelHalfThickness],
                    materialType: MATERIAL_MIRROR,
                    isBroken: false,
                });
            }

            const leftPanelIdx = boxes.length;
            boxes.push({
                centerPosition: [w.doorX - panelHalfWidth, centerY, w.zWall],
                halfExtentSize: [panelHalfWidth, panelHalfHeight, panelHalfThickness],
                materialType: MATERIAL_MIRROR,
                isBroken: false,
                isDoorPanel: true,
            });
            const rightPanelIdx = boxes.length;
            boxes.push({
                centerPosition: [w.doorX + panelHalfWidth, centerY, w.zWall],
                halfExtentSize: [panelHalfWidth, panelHalfHeight, panelHalfThickness],
                materialType: MATERIAL_MIRROR,
                isBroken: false,
                isDoorPanel: true,
            });

            doors.push({
                axis: 'z',
                hingeCenter: [w.doorX, centerY, w.zWall],
                slideAxisIndex: 0,
                panelHalfWidth,
                openSlideDistance,
                openProgress: 0.0,
                targetProgress: 0.0,
                openSpeed: 2.4,
                leftPanelBoxIndex: leftPanelIdx,
                rightPanelBoxIndex: rightPanelIdx,
            });
        }

        return {
            wallPlanes: [
                { normalVector: [1, 0, 0],   distanceFromOrigin: 5.0,  materialType: MATERIAL_MIRROR },
                { normalVector: [-1, 0, 0],  distanceFromOrigin: 5.0,  materialType: MATERIAL_MIRROR },
                { normalVector: [0, 0, 1],   distanceFromOrigin: 10.0, materialType: MATERIAL_MIRROR },
                { normalVector: [0, 0, -1],  distanceFromOrigin: 10.0, materialType: MATERIAL_MIRROR },
                { normalVector: [0, 1, 0],   distanceFromOrigin: 0.0,  materialType: MATERIAL_GLOSSY },
                { normalVector: [0, -1, 0],  distanceFromOrigin: 4.0,  materialType: MATERIAL_MATTE },
            ],
            boxObstacles: boxes,
            doors,
            backgroundColor: [0.012, 0.008, 0.022],
            fogDensityValue: 0.025,
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
        for (const name of Object.keys(this.layouts)) {
            for (const box of this.layouts[name].boxObstacles) {
                box.isBroken = false;
            }
            for (const door of (this.layouts[name].doors || [])) {
                door.openProgress = 0.0;
                door.targetProgress = 0.0;
            }
            this._syncDoorPanels(this.layouts[name]);
        }
    }

    updateDoors(deltaTimeSeconds) {
        const layout = this.getCurrentLayout();
        if (!layout.doors || layout.doors.length === 0) return;

        for (const door of layout.doors) {
            const delta = door.targetProgress - door.openProgress;
            if (Math.abs(delta) < 1e-4) {
                door.openProgress = door.targetProgress;
                continue;
            }
            const step = Math.sign(delta) * door.openSpeed * deltaTimeSeconds;
            if (Math.abs(step) >= Math.abs(delta)) {
                door.openProgress = door.targetProgress;
            } else {
                door.openProgress += step;
            }
        }

        this._syncDoorPanels(layout);
    }

    _syncDoorPanels(layout) {
        if (!layout.doors) return;
        for (const door of layout.doors) {
            const leftBox = layout.boxObstacles[door.leftPanelBoxIndex];
            const rightBox = layout.boxObstacles[door.rightPanelBoxIndex];
            if (!leftBox || !rightBox) continue;

            const offset = door.panelHalfWidth + door.openProgress * door.openSlideDistance;
            const hinge = door.hingeCenter;
            const axisIdx = door.slideAxisIndex;

            leftBox.centerPosition[0] = hinge[0];
            leftBox.centerPosition[1] = hinge[1];
            leftBox.centerPosition[2] = hinge[2];
            leftBox.centerPosition[axisIdx] = hinge[axisIdx] - offset;

            rightBox.centerPosition[0] = hinge[0];
            rightBox.centerPosition[1] = hinge[1];
            rightBox.centerPosition[2] = hinge[2];
            rightBox.centerPosition[axisIdx] = hinge[axisIdx] + offset;
        }
    }

    findNearbyDoor(cameraPosition, maxDistance = 2.6) {
        const layout = this.getCurrentLayout();
        if (!layout.doors || layout.doors.length === 0) return null;

        let closest = null;
        let closestDist = maxDistance;
        for (const door of layout.doors) {
            const dx = cameraPosition[0] - door.hingeCenter[0];
            const dz = cameraPosition[2] - door.hingeCenter[2];
            const d = Math.sqrt(dx * dx + dz * dz);
            if (d < closestDist) {
                closestDist = d;
                closest = door;
            }
        }
        return closest;
    }

    toggleDoor(door) {
        if (!door) return;
        door.targetProgress = (door.targetProgress > 0.5) ? 0.0 : 1.0;
    }

    intersectRayWithScene(rayOrigin, rayDirection) {
        const layout = this.getCurrentLayout();
        let closestT = Infinity;
        let closest = null;

        for (let i = 0; i < layout.wallPlanes.length; i++) {
            const plane = layout.wallPlanes[i];
            const n = new Float32Array(plane.normalVector);
            const t = MathUtils.intersectRayPlane(rayOrigin, rayDirection, n, plane.distanceFromOrigin);
            if (t > 0 && t < closestT) {
                const hitPos = MathUtils.addVectors(rayOrigin, MathUtils.scaleVector(rayDirection, t));
                closestT = t;
                closest = {
                    didHit: true,
                    hitDistance: t,
                    hitPosition: hitPos,
                    hitNormal: n,
                    hitPlaneIndex: i,
                    hitSurfaceUV: this._computePlaneUV(hitPos, n),
                    hitMaterialType: plane.materialType,
                    hitPrimitiveType: 'plane',
                };
            }
        }

        for (let i = 0; i < layout.boxObstacles.length; i++) {
            const box = layout.boxObstacles[i];
            if (box.isBroken) continue;
            const res = MathUtils.intersectRayBox(
                rayOrigin, rayDirection,
                new Float32Array(box.centerPosition),
                new Float32Array(box.halfExtentSize)
            );
            if (res && res.hitT < closestT) {
                closestT = res.hitT;
                closest = {
                    didHit: true,
                    hitDistance: res.hitT,
                    hitPosition: MathUtils.addVectors(rayOrigin, MathUtils.scaleVector(rayDirection, res.hitT)),
                    hitNormal: res.hitNormal,
                    hitPlaneIndex: -1,
                    hitBoxIndex: i,
                    hitSurfaceUV: [0, 0],
                    hitMaterialType: box.materialType,
                    hitPrimitiveType: 'box',
                };
            }
        }

        if (!closest) {
            return { didHit: false, hitDistance: -1, hitPosition: null, hitNormal: null, hitPlaneIndex: -1 };
        }
        return closest;
    }

    _computePlaneUV(hitPosition, planeNormal) {
        const a = [Math.abs(planeNormal[0]), Math.abs(planeNormal[1]), Math.abs(planeNormal[2])];
        if (a[1] > a[0] && a[1] > a[2]) return [hitPosition[0], hitPosition[2]];
        if (a[0] > a[2]) return [hitPosition[2], hitPosition[1]];
        return [hitPosition[0], hitPosition[1]];
    }

    uploadSceneUniforms(glContext, shaderProgram) {
        const layout = this.getCurrentLayout();

        const planeNormalData = new Float32Array(16 * 3);
        const planeDistanceData = new Float32Array(16);
        const planeMaterialData = new Int32Array(16);

        for (let i = 0; i < layout.wallPlanes.length; i++) {
            const p = layout.wallPlanes[i];
            planeNormalData[i * 3 + 0] = p.normalVector[0];
            planeNormalData[i * 3 + 1] = p.normalVector[1];
            planeNormalData[i * 3 + 2] = p.normalVector[2];
            planeDistanceData[i] = p.distanceFromOrigin;
            planeMaterialData[i] = p.materialType;
        }

        glContext.uniform3fv(glContext.getUniformLocation(shaderProgram, 'planeNormals'), planeNormalData);
        glContext.uniform1fv(glContext.getUniformLocation(shaderProgram, 'planeDistances'), planeDistanceData);
        glContext.uniform1iv(glContext.getUniformLocation(shaderProgram, 'planeMaterialTypes'), planeMaterialData);
        glContext.uniform1i(glContext.getUniformLocation(shaderProgram, 'activePlaneCount'), layout.wallPlanes.length);

        const maxBoxes = 32;
        const boxCenters = new Float32Array(maxBoxes * 3);
        const boxHalves = new Float32Array(maxBoxes * 3);
        const boxMats = new Int32Array(maxBoxes);
        const boxBroken = new Int32Array(maxBoxes);

        for (let i = 0; i < layout.boxObstacles.length; i++) {
            const b = layout.boxObstacles[i];
            boxCenters[i * 3 + 0] = b.centerPosition[0];
            boxCenters[i * 3 + 1] = b.centerPosition[1];
            boxCenters[i * 3 + 2] = b.centerPosition[2];
            boxHalves[i * 3 + 0] = b.halfExtentSize[0];
            boxHalves[i * 3 + 1] = b.halfExtentSize[1];
            boxHalves[i * 3 + 2] = b.halfExtentSize[2];
            boxMats[i] = b.materialType;
            boxBroken[i] = b.isBroken ? 1 : 0;
        }

        glContext.uniform3fv(glContext.getUniformLocation(shaderProgram, 'boxCenterPositions'), boxCenters);
        glContext.uniform3fv(glContext.getUniformLocation(shaderProgram, 'boxHalfExtents'), boxHalves);
        glContext.uniform1iv(glContext.getUniformLocation(shaderProgram, 'boxMaterialTypes'), boxMats);
        glContext.uniform1iv(glContext.getUniformLocation(shaderProgram, 'isBoxBroken'), boxBroken);
        glContext.uniform1i(glContext.getUniformLocation(shaderProgram, 'activeBoxCount'), layout.boxObstacles.length);

        glContext.uniform3fv(glContext.getUniformLocation(shaderProgram, 'backgroundColorValue'), new Float32Array(layout.backgroundColor));
        glContext.uniform1f(glContext.getUniformLocation(shaderProgram, 'fogDensityValue'), layout.fogDensityValue);
    }
}
