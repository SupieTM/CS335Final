// tracks which mirrors have been shattered and holds the voronoi
// seed cluster for the most recently hit mirror. the shader reads
// these uniforms every frame.

export class ShatterManager {
    constructor() {
        this.maxMirrorCount = 16;
        this.maxSeedCount = 32;
        this.shatterFlags = new Int32Array(this.maxMirrorCount);
        this.seedPositions = new Float32Array(this.maxSeedCount * 2);
        this.seedNormals = new Float32Array(this.maxSeedCount * 3);
        this.activeSeedCount = 0;
        this.lastHitPlaneIndex = -1;
    }

    breakMirror(planeIndex, hitUV, baseNormal) {
        if (planeIndex < 0 || planeIndex >= this.maxMirrorCount) return;

        this.shatterFlags[planeIndex] = 1;
        this.lastHitPlaneIndex = planeIndex;

        // 20 seeds clustered around the impact. sqrt radial spacing gives
        // a dense core with sparser chunks farther out, which looks right
        // for a bullet impact.
        const seedCount = 20;
        this.activeSeedCount = seedCount;

        for (let seedIdx = 0; seedIdx < seedCount; seedIdx++) {
            const radialRandom = Math.sqrt(Math.random());
            const angleRandom = Math.random() * Math.PI * 2.0;
            const radius = radialRandom * 1.8;
            const offsetU = Math.cos(angleRandom) * radius;
            const offsetV = Math.sin(angleRandom) * radius;

            this.seedPositions[seedIdx * 2 + 0] = hitUV[0] + offsetU;
            this.seedPositions[seedIdx * 2 + 1] = hitUV[1] + offsetV;

            // perturb the base normal slightly so each cell reflects in
            // a slightly different direction (the cracked-glass look)
            const nx = baseNormal[0] + (Math.random() - 0.5) * 0.12;
            const ny = baseNormal[1] + (Math.random() - 0.5) * 0.12;
            const nz = baseNormal[2] + (Math.random() - 0.5) * 0.12;
            const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
            this.seedNormals[seedIdx * 3 + 0] = nx * invLen;
            this.seedNormals[seedIdx * 3 + 1] = ny * invLen;
            this.seedNormals[seedIdx * 3 + 2] = nz * invLen;
        }
    }

    resetAllMirrors() {
        for (let i = 0; i < this.maxMirrorCount; i++) this.shatterFlags[i] = 0;
        this.activeSeedCount = 0;
        this.lastHitPlaneIndex = -1;
    }

    uploadShatterUniforms(glContext, shaderProgram) {
        glContext.uniform1iv(
            glContext.getUniformLocation(shaderProgram, 'isShatteredMirror'),
            this.shatterFlags
        );
        glContext.uniform2fv(
            glContext.getUniformLocation(shaderProgram, 'voronoiSeedPositions'),
            this.seedPositions
        );
        glContext.uniform3fv(
            glContext.getUniformLocation(shaderProgram, 'voronoiPerturbedNormals'),
            this.seedNormals
        );
        glContext.uniform1i(
            glContext.getUniformLocation(shaderProgram, 'voronoiSeedCount'),
            this.activeSeedCount
        );
        glContext.uniform1i(
            glContext.getUniformLocation(shaderProgram, 'shatteredMirrorIndex'),
            this.lastHitPlaneIndex
        );
    }
}
