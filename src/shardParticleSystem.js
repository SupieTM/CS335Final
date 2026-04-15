import { createShaderProgram, fetchShaderSource } from './shaderUtils.js';

// fixed pool of 500 glass shards. each particle is a small triangle in world
// space with its own position, velocity and full euler rotation. physics runs
// at frame-rate-independent dt and is simple: gravity, floor bounce with
// restitution, xz friction on contact, angular damping, life timer.

export class ShardParticleSystem {
    constructor(glContext) {
        this.gl = glContext;
        this.maxParticleCount = 500;

        // struct-of-arrays pools
        this.particlePositions = new Float32Array(this.maxParticleCount * 3);
        this.particleVelocities = new Float32Array(this.maxParticleCount * 3);
        this.particleRotations = new Float32Array(this.maxParticleCount * 3);
        this.particleAngularVelocities = new Float32Array(this.maxParticleCount * 3);
        this.particleSizes = new Float32Array(this.maxParticleCount);
        this.particleLives = new Float32Array(this.maxParticleCount);
        this.particleActive = new Uint8Array(this.maxParticleCount);

        // 3 verts per particle, each (x, y, z, alpha) = 4 floats
        this.vertexFloatsPerVertex = 4;
        this.vertexData = new Float32Array(this.maxParticleCount * 3 * this.vertexFloatsPerVertex);

        this.shaderProgram = null;
        this.vertexArrayObject = null;
        this.vertexBufferObject = null;

        this.nextFreeSlotIndex = 0;
        this.gravityAcceleration = -9.8;
    }

    async initializeGraphicsResources() {
        const vertSource = await fetchShaderSource('shaders/shard.vert');
        const fragSource = await fetchShaderSource('shaders/shard.frag');
        this.shaderProgram = createShaderProgram(this.gl, vertSource, fragSource);

        const gl = this.gl;
        this.vertexArrayObject = gl.createVertexArray();
        gl.bindVertexArray(this.vertexArrayObject);

        this.vertexBufferObject = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBufferObject);
        gl.bufferData(gl.ARRAY_BUFFER, this.vertexData.byteLength, gl.DYNAMIC_DRAW);

        const strideBytes = this.vertexFloatsPerVertex * 4;
        // attribute 0: worldPosition vec3
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, strideBytes, 0);
        // attribute 1: particleAlpha float
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 1, gl.FLOAT, false, strideBytes, 12);

        gl.bindVertexArray(null);
    }

    _findFreeSlot() {
        for (let attempt = 0; attempt < this.maxParticleCount; attempt++) {
            const slotIdx = (this.nextFreeSlotIndex + attempt) % this.maxParticleCount;
            if (!this.particleActive[slotIdx]) {
                this.nextFreeSlotIndex = (slotIdx + 1) % this.maxParticleCount;
                return slotIdx;
            }
        }
        return -1;
    }

    clearAllParticles() {
        this.particleActive.fill(0);
        this.nextFreeSlotIndex = 0;
    }

    spawnShardsFromShatter(spawnCount, impactPoint, mirrorNormal) {
        for (let shardIdx = 0; shardIdx < spawnCount; shardIdx++) {
            const slotIdx = this._findFreeSlot();
            if (slotIdx < 0) break;
            const base = slotIdx * 3;

            // sit just off the mirror surface so first-frame verts don't clip
            this.particlePositions[base + 0] = impactPoint[0] + mirrorNormal[0] * 0.03;
            this.particlePositions[base + 1] = impactPoint[1] + mirrorNormal[1] * 0.03;
            this.particlePositions[base + 2] = impactPoint[2] + mirrorNormal[2] * 0.03;

            // outward velocity along the mirror normal plus a random spray cone
            const outwardStrength = 2.2 + Math.random() * 3.0;
            const sprayMagnitude = 1.4;
            this.particleVelocities[base + 0] = mirrorNormal[0] * outwardStrength + (Math.random() - 0.5) * sprayMagnitude;
            this.particleVelocities[base + 1] = mirrorNormal[1] * outwardStrength + (Math.random() - 0.5) * sprayMagnitude + 1.8;
            this.particleVelocities[base + 2] = mirrorNormal[2] * outwardStrength + (Math.random() - 0.5) * sprayMagnitude;

            this.particleRotations[base + 0] = Math.random() * Math.PI * 2;
            this.particleRotations[base + 1] = Math.random() * Math.PI * 2;
            this.particleRotations[base + 2] = Math.random() * Math.PI * 2;
            this.particleAngularVelocities[base + 0] = (Math.random() - 0.5) * 12;
            this.particleAngularVelocities[base + 1] = (Math.random() - 0.5) * 12;
            this.particleAngularVelocities[base + 2] = (Math.random() - 0.5) * 12;

            this.particleSizes[slotIdx] = 0.04 + Math.random() * 0.035;
            this.particleLives[slotIdx] = 2.8 + Math.random() * 1.5;
            this.particleActive[slotIdx] = 1;
        }
    }

    updatePhysics(deltaTimeSeconds) {
        const floorY = 0.02;
        const floorRestitution = 0.3;
        const xzFrictionOnBounce = 0.8;
        const angularDampingOnBounce = 0.7;
        const minSettledSpeedSquared = 0.05 * 0.05;

        for (let slotIdx = 0; slotIdx < this.maxParticleCount; slotIdx++) {
            if (!this.particleActive[slotIdx]) continue;
            const base = slotIdx * 3;

            this.particleVelocities[base + 1] += this.gravityAcceleration * deltaTimeSeconds;

            this.particlePositions[base + 0] += this.particleVelocities[base + 0] * deltaTimeSeconds;
            this.particlePositions[base + 1] += this.particleVelocities[base + 1] * deltaTimeSeconds;
            this.particlePositions[base + 2] += this.particleVelocities[base + 2] * deltaTimeSeconds;

            if (this.particlePositions[base + 1] < floorY) {
                this.particlePositions[base + 1] = floorY;
                this.particleVelocities[base + 1] = -this.particleVelocities[base + 1] * floorRestitution;
                this.particleVelocities[base + 0] *= xzFrictionOnBounce;
                this.particleVelocities[base + 2] *= xzFrictionOnBounce;
                this.particleAngularVelocities[base + 0] *= angularDampingOnBounce;
                this.particleAngularVelocities[base + 1] *= angularDampingOnBounce;
                this.particleAngularVelocities[base + 2] *= angularDampingOnBounce;
            }

            this.particleRotations[base + 0] += this.particleAngularVelocities[base + 0] * deltaTimeSeconds;
            this.particleRotations[base + 1] += this.particleAngularVelocities[base + 1] * deltaTimeSeconds;
            this.particleRotations[base + 2] += this.particleAngularVelocities[base + 2] * deltaTimeSeconds;

            this.particleLives[slotIdx] -= deltaTimeSeconds;

            const vx = this.particleVelocities[base + 0];
            const vy = this.particleVelocities[base + 1];
            const vz = this.particleVelocities[base + 2];
            const speedSquared = vx * vx + vy * vy + vz * vz;
            const settledOnFloor = speedSquared < minSettledSpeedSquared
                && this.particlePositions[base + 1] <= floorY + 0.01;
            if (this.particleLives[slotIdx] <= 0 || settledOnFloor) {
                this.particleActive[slotIdx] = 0;
            }
        }
    }

    _rebuildVertexData() {
        // equilateral triangle template, scaled per particle
        const triVert0X = 0.0,   triVert0Y = 0.866, triVert0Z = 0.0;
        const triVert1X = -0.75, triVert1Y = -0.433, triVert1Z = 0.0;
        const triVert2X = 0.75,  triVert2Y = -0.433, triVert2Z = 0.0;

        this.vertexData.fill(0);

        for (let slotIdx = 0; slotIdx < this.maxParticleCount; slotIdx++) {
            if (!this.particleActive[slotIdx]) continue;
            const base = slotIdx * 3;
            const posX = this.particlePositions[base + 0];
            const posY = this.particlePositions[base + 1];
            const posZ = this.particlePositions[base + 2];
            const sizeValue = this.particleSizes[slotIdx];

            const lifeRemaining = this.particleLives[slotIdx];
            const alphaValue = Math.min(1.0, lifeRemaining / 0.6) * 0.9;

            // euler XYZ rotation matrix
            const rx = this.particleRotations[base + 0];
            const ry = this.particleRotations[base + 1];
            const rz = this.particleRotations[base + 2];
            const cx = Math.cos(rx), sx = Math.sin(rx);
            const cy = Math.cos(ry), sy = Math.sin(ry);
            const cz = Math.cos(rz), sz = Math.sin(rz);

            const m00 = cy * cz;
            const m01 = sx * sy * cz - cx * sz;
            const m02 = cx * sy * cz + sx * sz;
            const m10 = cy * sz;
            const m11 = sx * sy * sz + cx * cz;
            const m12 = cx * sy * sz - sx * cz;
            const m20 = -sy;
            const m21 = sx * cy;
            const m22 = cx * cy;

            // vert 0
            let lx = triVert0X * sizeValue, ly = triVert0Y * sizeValue, lz = triVert0Z * sizeValue;
            let writeIdx = (slotIdx * 3 + 0) * this.vertexFloatsPerVertex;
            this.vertexData[writeIdx + 0] = m00 * lx + m01 * ly + m02 * lz + posX;
            this.vertexData[writeIdx + 1] = m10 * lx + m11 * ly + m12 * lz + posY;
            this.vertexData[writeIdx + 2] = m20 * lx + m21 * ly + m22 * lz + posZ;
            this.vertexData[writeIdx + 3] = alphaValue;

            // vert 1
            lx = triVert1X * sizeValue; ly = triVert1Y * sizeValue; lz = triVert1Z * sizeValue;
            writeIdx = (slotIdx * 3 + 1) * this.vertexFloatsPerVertex;
            this.vertexData[writeIdx + 0] = m00 * lx + m01 * ly + m02 * lz + posX;
            this.vertexData[writeIdx + 1] = m10 * lx + m11 * ly + m12 * lz + posY;
            this.vertexData[writeIdx + 2] = m20 * lx + m21 * ly + m22 * lz + posZ;
            this.vertexData[writeIdx + 3] = alphaValue;

            // vert 2
            lx = triVert2X * sizeValue; ly = triVert2Y * sizeValue; lz = triVert2Z * sizeValue;
            writeIdx = (slotIdx * 3 + 2) * this.vertexFloatsPerVertex;
            this.vertexData[writeIdx + 0] = m00 * lx + m01 * ly + m02 * lz + posX;
            this.vertexData[writeIdx + 1] = m10 * lx + m11 * ly + m12 * lz + posY;
            this.vertexData[writeIdx + 2] = m20 * lx + m21 * ly + m22 * lz + posZ;
            this.vertexData[writeIdx + 3] = alphaValue;
        }
    }

    renderShards(cameraController, canvasWidth, canvasHeight) {
        this._rebuildVertexData();

        const gl = this.gl;
        gl.useProgram(this.shaderProgram);
        gl.bindVertexArray(this.vertexArrayObject);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBufferObject);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertexData);

        gl.uniform3fv(gl.getUniformLocation(this.shaderProgram, 'cameraPosition'), cameraController.cameraPosition);
        gl.uniform1f(gl.getUniformLocation(this.shaderProgram, 'cameraYawAngle'), cameraController.cameraYawAngle);
        gl.uniform1f(gl.getUniformLocation(this.shaderProgram, 'cameraPitchAngle'), cameraController.cameraPitchAngle);
        gl.uniform1f(gl.getUniformLocation(this.shaderProgram, 'cameraFovRadians'), cameraController.fieldOfViewRadians);
        gl.uniform2f(gl.getUniformLocation(this.shaderProgram, 'canvasResolution'), canvasWidth, canvasHeight);

        // additive blend so shards add bright silver into the HDR scene buffer
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

        gl.drawArrays(gl.TRIANGLES, 0, this.maxParticleCount * 3);

        gl.disable(gl.BLEND);
        gl.bindVertexArray(null);
    }
}
