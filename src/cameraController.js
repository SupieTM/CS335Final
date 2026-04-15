import { MathUtils } from './mathUtils.js';

export class CameraController {
    constructor(canvasElement) {
        this.canvasElement = canvasElement;

        // Camera state
        this.cameraPosition = new Float32Array([0, 1.6, 0]); // eye height
        this.cameraYawAngle = 0.0;
        this.cameraPitchAngle = 0.0;

        // Movement config
        this.movementSpeed = 3.0;
        this.sprintSpeedMultiplier = 1.8;
        this.mouseSensitivity = 0.002;
        this.pitchClampRadians = 1.553; // ~89 deg

        // smooth stop/start instead of snapping
        this.currentVelocity = new Float32Array([0, 0, 0]);
        this.accelerationRate = 15.0;
        this.decelerationRate = 12.0;

        // flush mouse deltas once per frame (fixes jitter)
        this.pendingMouseDeltaX = 0;
        this.pendingMouseDeltaY = 0;

        // Input tracking
        this.pressedKeys = {};
        this.isPointerLocked = false;
        this.onPointerLockChangeCallback = null;

        // fov in radians - 90 deg default
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
        // Keyboard
        document.addEventListener('keydown', (keyEvent) => {
            this.pressedKeys[keyEvent.code] = true;
        });
        document.addEventListener('keyup', (keyEvent) => {
            this.pressedKeys[keyEvent.code] = false;
        });

        // Pointer lock
        this.canvasElement.addEventListener('click', () => {
            if (!this.isPointerLocked) {
                this.canvasElement.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = (document.pointerLockElement === this.canvasElement);
            if (this.onPointerLockChangeCallback) {
                this.onPointerLockChangeCallback(this.isPointerLocked);
            }
        });

        document.addEventListener('mousemove', (mouseEvent) => {
            if (!this.isPointerLocked) return;
            this.pendingMouseDeltaX += mouseEvent.movementX;
            this.pendingMouseDeltaY += mouseEvent.movementY;
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
        const cosYaw = Math.cos(this.cameraYawAngle);
        const sinYaw = Math.sin(this.cameraYawAngle);
        const cosPitch = Math.cos(this.cameraPitchAngle);
        const sinPitch = Math.sin(this.cameraPitchAngle);
        return MathUtils.createVector(
            cosPitch * sinYaw,
            sinPitch,
            cosPitch * cosYaw
        );
    }

    getHorizontalForwardVector() {
        // Forward projected onto the xz plane (for walking)
        const sinYaw = Math.sin(this.cameraYawAngle);
        const cosYaw = Math.cos(this.cameraYawAngle);
        return MathUtils.normalizeVector(MathUtils.createVector(sinYaw, 0, cosYaw));
    }

    getRightVector() {
        const forwardVec = this.getForwardVector();
        const worldUpVector = MathUtils.createVector(0, 1, 0);
        return MathUtils.normalizeVector(MathUtils.crossProduct(worldUpVector, forwardVec));
    }

    updatePosition(deltaTimeSeconds, sceneGeometry = null) {
        this._applyPendingMouseLook();

        const horizontalForward = this.getHorizontalForwardVector();
        const rightVector = this.getRightVector();

        // normalize so diagonals aren't faster
        let inputDirection = MathUtils.createVector(0, 0, 0);
        if (this.pressedKeys['KeyW']) {
            inputDirection = MathUtils.addVectors(inputDirection, horizontalForward);
        }
        if (this.pressedKeys['KeyS']) {
            inputDirection = MathUtils.addVectors(inputDirection,
                MathUtils.scaleVector(horizontalForward, -1));
        }
        if (this.pressedKeys['KeyD']) {
            inputDirection = MathUtils.addVectors(inputDirection, rightVector);
        }
        if (this.pressedKeys['KeyA']) {
            inputDirection = MathUtils.addVectors(inputDirection,
                MathUtils.scaleVector(rightVector, -1));
        }

        const inputMagnitude = MathUtils.vectorLength(inputDirection);
        const isSprinting = !!this.pressedKeys['ShiftLeft'] || !!this.pressedKeys['ShiftRight'];
        const targetSpeed = this.movementSpeed * (isSprinting ? this.sprintSpeedMultiplier : 1.0);

        let targetVelocity;
        if (inputMagnitude > 1e-5) {
            targetVelocity = MathUtils.scaleVector(
                MathUtils.scaleVector(inputDirection, 1.0 / inputMagnitude),
                targetSpeed
            );
        } else {
            targetVelocity = MathUtils.createVector(0, 0, 0);
        }

        const lerpRate = (inputMagnitude > 1e-5) ? this.accelerationRate : this.decelerationRate;
        const lerpFactor = Math.min(1.0, lerpRate * deltaTimeSeconds);
        this.currentVelocity[0] += (targetVelocity[0] - this.currentVelocity[0]) * lerpFactor;
        this.currentVelocity[1] += (targetVelocity[1] - this.currentVelocity[1]) * lerpFactor;
        this.currentVelocity[2] += (targetVelocity[2] - this.currentVelocity[2]) * lerpFactor;

        const movementDelta = MathUtils.scaleVector(this.currentVelocity, deltaTimeSeconds);
        const candidatePosition = MathUtils.addVectors(this.cameraPosition, movementDelta);

        // Simple wall collision - keep camera inside room bounds
        if (sceneGeometry) {
            const clampedPosition = this._clampToRoomBounds(candidatePosition, sceneGeometry);
            this.cameraPosition[0] = clampedPosition[0];
            this.cameraPosition[1] = clampedPosition[1];
            this.cameraPosition[2] = clampedPosition[2];
        } else {
            this.cameraPosition[0] = candidatePosition[0];
            this.cameraPosition[1] = candidatePosition[1];
            this.cameraPosition[2] = candidatePosition[2];
        }
    }

    _clampToRoomBounds(candidatePosition, sceneGeometry) {
        const layout = sceneGeometry.getCurrentLayout();
        const wallMargin = 0.3; // don't get too close to walls
        const boxMargin = 0.25;
        const clampedPosition = new Float32Array(candidatePosition);

        for (const plane of layout.wallPlanes) {
            const normalVec = new Float32Array(plane.normalVector);
            const signedDistance = MathUtils.dotProduct(clampedPosition, normalVec) + plane.distanceFromOrigin;

            if (signedDistance < wallMargin) {
                // Push back along the normal
                const pushBackAmount = wallMargin - signedDistance;
                clampedPosition[0] += normalVec[0] * pushBackAmount;
                clampedPosition[1] += normalVec[1] * pushBackAmount;
                clampedPosition[2] += normalVec[2] * pushBackAmount;
            }
        }

        // 2D AABB push-out against unbroken boxes (panels span the full
        // vertical range so we only need to test xz)
        for (const box of layout.boxObstacles) {
            if (box.isBroken) continue;
            const dx = clampedPosition[0] - box.centerPosition[0];
            const dz = clampedPosition[2] - box.centerPosition[2];
            const overlapX = (box.halfExtentSize[0] + boxMargin) - Math.abs(dx);
            const overlapZ = (box.halfExtentSize[2] + boxMargin) - Math.abs(dz);
            if (overlapX > 0 && overlapZ > 0) {
                if (overlapX < overlapZ) {
                    clampedPosition[0] += overlapX * (dx >= 0 ? 1 : -1);
                } else {
                    clampedPosition[2] += overlapZ * (dz >= 0 ? 1 : -1);
                }
            }
        }

        // Keep at eye height
        clampedPosition[1] = 1.6;

        return clampedPosition;
    }

    /**
     * Cast a ray from screen coordinates for mouse picking.
     * Same camera ray math as Project 1 but from a click point.
     */
    castRayFromScreenPoint(clickX, clickY, canvasWidth, canvasHeight) {
        const rayDirection = MathUtils.buildCameraRayDirection(
            clickX, clickY,
            canvasWidth, canvasHeight,
            this.cameraYawAngle, this.cameraPitchAngle
        );
        return {
            rayOrigin: new Float32Array(this.cameraPosition),
            rayDirection: rayDirection,
        };
    }

    uploadCameraUniforms(glContext, shaderProgram) {
        glContext.uniform3fv(glContext.getUniformLocation(shaderProgram, 'cameraPosition'), this.cameraPosition);
        glContext.uniform1f(glContext.getUniformLocation(shaderProgram, 'cameraYawAngle'), this.cameraYawAngle);
        glContext.uniform1f(glContext.getUniformLocation(shaderProgram, 'cameraPitchAngle'), this.cameraPitchAngle);
        glContext.uniform1f(glContext.getUniformLocation(shaderProgram, 'cameraFovRadians'), this.fieldOfViewRadians);
    }
}
