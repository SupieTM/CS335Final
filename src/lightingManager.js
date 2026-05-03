export class LightingManager {
    constructor() {
        // intensities baked into color - ACES tonemap absorbs the extra headroom
        this.pointLightArray = [
            { positionVec3: new Float32Array([-1.7,  2.6, -6]),  colorVec3: new Float32Array([2.8, 0.35, 1.6]) },
            { positionVec3: new Float32Array([ 1.7,  2.6, -3]),  colorVec3: new Float32Array([0.3, 0.9, 2.6]) },
            { positionVec3: new Float32Array([-1.7,  2.6,  0]),  colorVec3: new Float32Array([0.35, 2.5, 0.7]) },
            { positionVec3: new Float32Array([ 1.7,  2.6,  3]),  colorVec3: new Float32Array([2.8, 0.35, 1.6]) },
            { positionVec3: new Float32Array([-1.7,  2.6,  6]),  colorVec3: new Float32Array([0.3, 0.9, 2.6]) },
        ];

        this.flashIntensityValue = 0.0;
        this.flashDecayPerSecond = 36.0;
        this.flashLightColor = new Float32Array([1.0, 0.95, 0.8]);
        this.isFlashActive = false;
    }

    triggerMuzzleFlash() {
        this.flashIntensityValue = 3.0;
        this.isFlashActive = true;
    }

    updateFlash(deltaTimeSeconds) {
        if (!this.isFlashActive) return;

        this.flashIntensityValue *= Math.exp(-this.flashDecayPerSecond * deltaTimeSeconds);
        if (this.flashIntensityValue < 0.01) {
            this.flashIntensityValue = 0.0;
            this.isFlashActive = false;
        }
    }

    setLightColor(lightIndex, redValue, greenValue, blueValue) {
        if (lightIndex < this.pointLightArray.length) {
            this.pointLightArray[lightIndex].colorVec3[0] = redValue;
            this.pointLightArray[lightIndex].colorVec3[1] = greenValue;
            this.pointLightArray[lightIndex].colorVec3[2] = blueValue;
        }
    }

    setLightPosition(lightIndex, xPos, yPos, zPos) {
        if (lightIndex < this.pointLightArray.length) {
            this.pointLightArray[lightIndex].positionVec3[0] = xPos;
            this.pointLightArray[lightIndex].positionVec3[1] = yPos;
            this.pointLightArray[lightIndex].positionVec3[2] = zPos;
        }
    }

    getLightPosition(lightIndex) {
        if (lightIndex < 0 || lightIndex >= this.pointLightArray.length) return null;
        return this.pointLightArray[lightIndex].positionVec3;
    }

    uploadLightUniforms(glContext, shaderProgram, cameraPosition) {
        const lightPositionData = new Float32Array(8 * 3);
        const lightColorData = new Float32Array(8 * 3);
        let totalLightCount = this.pointLightArray.length;

        for (let lightIdx = 0; lightIdx < this.pointLightArray.length; lightIdx++) {
            const light = this.pointLightArray[lightIdx];
            lightPositionData[lightIdx * 3 + 0] = light.positionVec3[0];
            lightPositionData[lightIdx * 3 + 1] = light.positionVec3[1];
            lightPositionData[lightIdx * 3 + 2] = light.positionVec3[2];
            lightColorData[lightIdx * 3 + 0] = light.colorVec3[0];
            lightColorData[lightIdx * 3 + 1] = light.colorVec3[1];
            lightColorData[lightIdx * 3 + 2] = light.colorVec3[2];
        }

        if (this.isFlashActive && totalLightCount < 8) {
            const flashIdx = totalLightCount;
            lightPositionData[flashIdx * 3 + 0] = cameraPosition[0];
            lightPositionData[flashIdx * 3 + 1] = cameraPosition[1];
            lightPositionData[flashIdx * 3 + 2] = cameraPosition[2];
            lightColorData[flashIdx * 3 + 0] = this.flashLightColor[0] * this.flashIntensityValue;
            lightColorData[flashIdx * 3 + 1] = this.flashLightColor[1] * this.flashIntensityValue;
            lightColorData[flashIdx * 3 + 2] = this.flashLightColor[2] * this.flashIntensityValue;
            totalLightCount++;
        }

        glContext.uniform3fv(glContext.getUniformLocation(shaderProgram, 'lightPositions'), lightPositionData);
        glContext.uniform3fv(glContext.getUniformLocation(shaderProgram, 'lightColors'), lightColorData);
        glContext.uniform1i(glContext.getUniformLocation(shaderProgram, 'activeLightCount'), totalLightCount);
    }
}
