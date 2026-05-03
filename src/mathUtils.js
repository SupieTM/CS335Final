export const MathUtils = {
    createVector(xValue, yValue, zValue) {
        return new Float32Array([xValue, yValue, zValue]);
    },

    addVectors(vectorA, vectorB) {
        return new Float32Array([
            vectorA[0] + vectorB[0],
            vectorA[1] + vectorB[1],
            vectorA[2] + vectorB[2]
        ]);
    },

    subtractVectors(vectorA, vectorB) {
        return new Float32Array([
            vectorA[0] - vectorB[0],
            vectorA[1] - vectorB[1],
            vectorA[2] - vectorB[2]
        ]);
    },

    scaleVector(vector, scalarValue) {
        return new Float32Array([
            vector[0] * scalarValue,
            vector[1] * scalarValue,
            vector[2] * scalarValue
        ]);
    },

    dotProduct(vectorA, vectorB) {
        return vectorA[0] * vectorB[0] +
               vectorA[1] * vectorB[1] +
               vectorA[2] * vectorB[2];
    },

    crossProduct(vectorA, vectorB) {
        return new Float32Array([
            vectorA[1] * vectorB[2] - vectorA[2] * vectorB[1],
            vectorA[2] * vectorB[0] - vectorA[0] * vectorB[2],
            vectorA[0] * vectorB[1] - vectorA[1] * vectorB[0]
        ]);
    },

    vectorLength(vector) {
        return Math.sqrt(
            vector[0] * vector[0] +
            vector[1] * vector[1] +
            vector[2] * vector[2]
        );
    },

    normalizeVector(vector) {
        const len = this.vectorLength(vector);
        if (len < 1e-10) return new Float32Array([0, 0, 0]);
        return this.scaleVector(vector, 1.0 / len);
    },

    reflectVector(incidentDirection, surfaceNormal) {
        const d = this.dotProduct(incidentDirection, surfaceNormal);
        return new Float32Array([
            incidentDirection[0] - 2.0 * d * surfaceNormal[0],
            incidentDirection[1] - 2.0 * d * surfaceNormal[1],
            incidentDirection[2] - 2.0 * d * surfaceNormal[2]
        ]);
    },

    negateVector(vector) {
        return new Float32Array([-vector[0], -vector[1], -vector[2]]);
    },

    vectorsAreEqual(vectorA, vectorB, toleranceEpsilon = 1e-6) {
        return Math.abs(vectorA[0] - vectorB[0]) < toleranceEpsilon &&
               Math.abs(vectorA[1] - vectorB[1]) < toleranceEpsilon &&
               Math.abs(vectorA[2] - vectorB[2]) < toleranceEpsilon;
    },

    intersectRayPlane(rayOrigin, rayDirection, planeNormal, planeDistance) {
        const denom = this.dotProduct(rayDirection, planeNormal);
        if (Math.abs(denom) < 1e-8) return -1.0;
        const hitT = -(this.dotProduct(rayOrigin, planeNormal) + planeDistance) / denom;
        return hitT > 0.001 ? hitT : -1.0;
    },

    intersectRayBox(rayOrigin, rayDirection, boxCenter, boxHalfExtent) {
        const boxMin = this.subtractVectors(boxCenter, boxHalfExtent);
        const boxMax = this.addVectors(boxCenter, boxHalfExtent);

        let tEntry = -Infinity;
        let tExit = Infinity;
        let normalAxis = -1;
        let normalSign = 1.0;

        for (let axis = 0; axis < 3; axis++) {
            if (Math.abs(rayDirection[axis]) < 1e-8) {
                if (rayOrigin[axis] < boxMin[axis] || rayOrigin[axis] > boxMax[axis]) {
                    return null;
                }
                continue;
            }

            const invDir = 1.0 / rayDirection[axis];
            let slabEntry = (boxMin[axis] - rayOrigin[axis]) * invDir;
            let slabExit  = (boxMax[axis] - rayOrigin[axis]) * invDir;

            let sign = -1.0;
            if (slabEntry > slabExit) {
                [slabEntry, slabExit] = [slabExit, slabEntry];
                sign = 1.0;
            }

            if (slabEntry > tEntry) {
                tEntry = slabEntry;
                normalAxis = axis;
                normalSign = sign;
            }
            tExit = Math.min(tExit, slabExit);
        }

        if (tEntry > tExit || tExit < 0.001) return null;
        const hitT = tEntry > 0.001 ? tEntry : tExit;
        if (hitT < 0.001) return null;

        const hitNormal = new Float32Array([0, 0, 0]);
        if (normalAxis >= 0) hitNormal[normalAxis] = normalSign;
        return { hitT, hitNormal };
    },

    intersectRaySphere(rayOrigin, rayDirection, sphereCenter, sphereRadius) {
        const oc = this.subtractVectors(rayOrigin, sphereCenter);
        const a = this.dotProduct(rayDirection, rayDirection);
        const b = 2.0 * this.dotProduct(oc, rayDirection);
        const c = this.dotProduct(oc, oc) - sphereRadius * sphereRadius;
        const disc = b * b - 4.0 * a * c;
        if (disc < 0) return -1.0;
        const sq = Math.sqrt(disc);
        const t1 = (-b - sq) / (2.0 * a);
        const t2 = (-b + sq) / (2.0 * a);
        if (t1 > 0.001) return t1;
        if (t2 > 0.001) return t2;
        return -1.0;
    },

    buildCameraRayDirection(pixelX, pixelY, canvasWidth, canvasHeight, cameraYawAngle, cameraPitchAngle, fieldOfViewRadians = Math.PI * 0.5) {
        const aspect = canvasWidth / canvasHeight;
        const fovScale = Math.tan(fieldOfViewRadians / 2.0);

        const ndcX = (2.0 * pixelX / canvasWidth - 1.0) * aspect * fovScale;
        const ndcY = (1.0 - 2.0 * pixelY / canvasHeight) * fovScale;

        const cosYaw = Math.cos(cameraYawAngle);
        const sinYaw = Math.sin(cameraYawAngle);
        const cosPitch = Math.cos(cameraPitchAngle);
        const sinPitch = Math.sin(cameraPitchAngle);

        const forward = this.createVector(
            cosPitch * sinYaw,
            sinPitch,
            cosPitch * cosYaw
        );
        const worldUp = this.createVector(0, 1, 0);
        const right = this.normalizeVector(this.crossProduct(worldUp, forward));
        const up = this.crossProduct(forward, right);

        return this.normalizeVector(this.addVectors(
            this.addVectors(forward, this.scaleVector(right, ndcX)),
            this.scaleVector(up, ndcY)
        ));
    }
};
