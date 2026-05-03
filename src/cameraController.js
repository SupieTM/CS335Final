import { MathUtils } from './mathUtils.js';

export class CameraController {
    constructor(canvasElement) {
        this.canvasElement = canvasElement;

        this.cameraPosition = new Float32Array([0, 1.6, 0]);
        this.cameraYawAngle = 0.0;
        this.cameraPitchAngle = 0.0;

        this.movementSpeed = 3.0;
        this.sprintSpeedMultiplier = 1.8;
        this.mouseSensitivity = 0.002;
        this.pitchClampRadians = 1.553;

        this.currentVelocity = new Float32Array([0, 0, 0]);
        this.accelerationRate = 15.0;
        this.decelerationRate = 12.0;

        // flush mouse deltas once per frame to fix jitter on high-refresh displays
        this.pendingMouseDeltaX = 0;
        this.pendingMouseDeltaY = 0;

        this.pressedKeys = {};
        this.isPointerLocked = false;
        this.onPointerLockChangeCallback = null;

        this.fieldOfViewRadians = Math.PI * 0.5;

        this._setupInputListeners();
    }

    setFieldOfView(fovDegrees) {
        this.fieldOfViewRadians = fovDegrees * Math.PI / 180.0;
    }

    setMouseSensitivity(newSensitivity) {
        this.mouseSensitivity = newSensitivity;
    }

    _setupInputListeners() {
        document.addEventListener('keydown', (e) => { this.pressedKeys[e.code] = true; });
        document.addEventListener('keyup',   (e) => { this.pressedKeys[e.code] = false; });

        this.canvasElement.addEventListener('click', () => {
            if (!this.isPointerLocked) this.canvasElement.requestPointerLock();
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = (document.pointerLockElement === this.canvasElement);
            if (this.onPointerLockChangeCallback) this.onPointerLockChangeCallback(this.isPointerLocked);
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isPointerLocked) return;
            this.pendingMouseDeltaX += e.movementX;
            this.pendingMouseDeltaY += e.movementY;
        });
    }

    _applyPendingMouseLook() {
        this.cameraYawAngle += this.pendingMouseDeltaX * this.mouseSensitivity;
        this.cameraPitchAngle -= this.pendingMouseDeltaY * this.mouseSensitivity;
        this.cameraPitchAngle = Math.max(-this.pitchClampRadians,
            Math.min(this.pitchClampRadians, this.cameraPitchAngle));
        this.pendingMouseDeltaX = 0;
        this.pendingMouseDeltaY = 0;
    }

    getForwardVector() {
        const cy = Math.cos(this.cameraYawAngle);
        const sy = Math.sin(this.cameraYawAngle);
        const cp = Math.cos(this.cameraPitchAngle);
        const sp = Math.sin(this.cameraPitchAngle);
        return MathUtils.createVector(cp * sy, sp, cp * cy);
    }

    getHorizontalForwardVector() {
        const sy = Math.sin(this.cameraYawAngle);
        const cy = Math.cos(this.cameraYawAngle);
        return MathUtils.normalizeVector(MathUtils.createVector(sy, 0, cy));
    }

    getRightVector() {
        const fwd = this.getForwardVector();
        const worldUp = MathUtils.createVector(0, 1, 0);
        return MathUtils.normalizeVector(MathUtils.crossProduct(worldUp, fwd));
    }

    updatePosition(deltaTimeSeconds, sceneGeometry = null) {
        this._applyPendingMouseLook();

        const horizontalForward = this.getHorizontalForwardVector();
        const rightVector = this.getRightVector();

        let inputDir = MathUtils.createVector(0, 0, 0);
        if (this.pressedKeys['KeyW']) inputDir = MathUtils.addVectors(inputDir, horizontalForward);
        if (this.pressedKeys['KeyS']) inputDir = MathUtils.addVectors(inputDir, MathUtils.scaleVector(horizontalForward, -1));
        if (this.pressedKeys['KeyD']) inputDir = MathUtils.addVectors(inputDir, rightVector);
        if (this.pressedKeys['KeyA']) inputDir = MathUtils.addVectors(inputDir, MathUtils.scaleVector(rightVector, -1));

        const inputMag = MathUtils.vectorLength(inputDir);
        const sprinting = !!this.pressedKeys['ShiftLeft'] || !!this.pressedKeys['ShiftRight'];
        const targetSpeed = this.movementSpeed * (sprinting ? this.sprintSpeedMultiplier : 1.0);

        let targetVel;
        if (inputMag > 1e-5) {
            targetVel = MathUtils.scaleVector(
                MathUtils.scaleVector(inputDir, 1.0 / inputMag),
                targetSpeed
            );
        } else {
            targetVel = MathUtils.createVector(0, 0, 0);
        }

        const lerpRate = (inputMag > 1e-5) ? this.accelerationRate : this.decelerationRate;
        const lerpFactor = Math.min(1.0, lerpRate * deltaTimeSeconds);
        this.currentVelocity[0] += (targetVel[0] - this.currentVelocity[0]) * lerpFactor;
        this.currentVelocity[1] += (targetVel[1] - this.currentVelocity[1]) * lerpFactor;
        this.currentVelocity[2] += (targetVel[2] - this.currentVelocity[2]) * lerpFactor;

        const moveDelta = MathUtils.scaleVector(this.currentVelocity, deltaTimeSeconds);
        const candidate = MathUtils.addVectors(this.cameraPosition, moveDelta);

        if (sceneGeometry) {
            const clamped = this._clampToRoomBounds(candidate, sceneGeometry);
            this.cameraPosition[0] = clamped[0];
            this.cameraPosition[1] = clamped[1];
            this.cameraPosition[2] = clamped[2];
        } else {
            this.cameraPosition[0] = candidate[0];
            this.cameraPosition[1] = candidate[1];
            this.cameraPosition[2] = candidate[2];
        }
    }

    _clampToRoomBounds(candidatePosition, sceneGeometry) {
        const layout = sceneGeometry.getCurrentLayout();
        const wallMargin = 0.3;
        const boxMargin = 0.25;
        const pos = new Float32Array(candidatePosition);

        for (const plane of layout.wallPlanes) {
            const n = new Float32Array(plane.normalVector);
            const signedDist = MathUtils.dotProduct(pos, n) + plane.distanceFromOrigin;
            if (signedDist < wallMargin) {
                const push = wallMargin - signedDist;
                pos[0] += n[0] * push;
                pos[1] += n[1] * push;
                pos[2] += n[2] * push;
            }
        }

        for (const box of layout.boxObstacles) {
            if (box.isBroken) continue;
            const dx = pos[0] - box.centerPosition[0];
            const dz = pos[2] - box.centerPosition[2];
            const ox = (box.halfExtentSize[0] + boxMargin) - Math.abs(dx);
            const oz = (box.halfExtentSize[2] + boxMargin) - Math.abs(dz);
            if (ox > 0 && oz > 0) {
                if (ox < oz) pos[0] += ox * (dx >= 0 ? 1 : -1);
                else         pos[2] += oz * (dz >= 0 ? 1 : -1);
            }
        }

        pos[1] = 1.6;
        return pos;
    }

    resetForLayout(layoutName) {
        const spawnTable = {
            corridor:  [0.0, 1.6,  0.0],
            labyrinth: [0.0, 1.6, -7.0],
            doors:     [0.0, 1.6, -8.5],
            openRoom:  [0.0, 1.6,  3.0],
            angled:    [0.0, 1.6,  0.0],
        };
        const spawn = spawnTable[layoutName] || [0.0, 1.6, 0.0];

        this.cameraPosition[0] = spawn[0];
        this.cameraPosition[1] = spawn[1];
        this.cameraPosition[2] = spawn[2];

        this.currentVelocity[0] = 0.0;
        this.currentVelocity[1] = 0.0;
        this.currentVelocity[2] = 0.0;
    }

    castRayFromScreenPoint(clickX, clickY, canvasWidth, canvasHeight) {
        const dir = MathUtils.buildCameraRayDirection(
            clickX, clickY,
            canvasWidth, canvasHeight,
            this.cameraYawAngle, this.cameraPitchAngle,
            this.fieldOfViewRadians
        );
        return {
            rayOrigin: new Float32Array(this.cameraPosition),
            rayDirection: dir,
        };
    }

    uploadCameraUniforms(glContext, shaderProgram) {
        glContext.uniform3fv(glContext.getUniformLocation(shaderProgram, 'cameraPosition'), this.cameraPosition);
        glContext.uniform1f (glContext.getUniformLocation(shaderProgram, 'cameraYawAngle'), this.cameraYawAngle);
        glContext.uniform1f (glContext.getUniformLocation(shaderProgram, 'cameraPitchAngle'), this.cameraPitchAngle);
        glContext.uniform1f (glContext.getUniformLocation(shaderProgram, 'cameraFovRadians'), this.fieldOfViewRadians);
    }
}
