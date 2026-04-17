export const MathUtils = {
    // -- Vector3 operations ------------------------------------------

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
        const lengthValue = this.vectorLength(vector);
        if (lengthValue < 1e-10) return new Float32Array([0, 0, 0]);
        return this.scaleVector(vector, 1.0 / lengthValue);
    },

    reflectVector(incidentDirection, surfaceNormal) {
        // Same reflection formula as Project 1: r = d - 2(d*n)n
        const dotValue = this.dotProduct(incidentDirection, surfaceNormal);
        return new Float32Array([
            incidentDirection[0] - 2.0 * dotValue * surfaceNormal[0],
            incidentDirection[1] - 2.0 * dotValue * surfaceNormal[1],
            incidentDirection[2] - 2.0 * dotValue * surfaceNormal[2]
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

    // -- Ray-Geometry Intersection -----------------------------------
    // Direct port of Project 1's intersection routines.

    /**
     * Ray-plane intersection.
     * Plane defined by: dot(point, planeNormal) + planeDistance = 0
     * Returns hitT or -1 if no intersection (parallel or behind).
     */
    intersectRayPlane(rayOrigin, rayDirection, planeNormal, planeDistance) {
        const denominatorValue = this.dotProduct(rayDirection, planeNormal);
        if (Math.abs(denominatorValue) < 1e-8) return -1.0; // parallel
        const hitT = -(this.dotProduct(rayOrigin, planeNormal) + planeDistance) / denominatorValue;
        return hitT > 0.001 ? hitT : -1.0;
    },

    /**
     * Ray-AABB intersection using the slab method (Project 1 style).
     * boxCenter and boxHalfExtent define the box.
     * Returns { hitT, hitNormal } or null.
     */
    intersectRayBox(rayOrigin, rayDirection, boxCenter, boxHalfExtent) {
        const boxMinCorner = this.subtractVectors(boxCenter, boxHalfExtent);
        const boxMaxCorner = this.addVectors(boxCenter, boxHalfExtent);

        let tEntryMax = -Infinity;
        let tExitMin = Infinity;
        let hitNormalAxis = -1;
        let hitNormalSign = 1.0;

        for (let axisIndex = 0; axisIndex < 3; axisIndex++) {
            if (Math.abs(rayDirection[axisIndex]) < 1e-8) {
                // Ray parallel to slab
                if (rayOrigin[axisIndex] < boxMinCorner[axisIndex] ||
                    rayOrigin[axisIndex] > boxMaxCorner[axisIndex]) {
                    return null; // outside slab, no hit
                }
                continue;
            }

            const inverseDirection = 1.0 / rayDirection[axisIndex];
            let slabEntryT = (boxMinCorner[axisIndex] - rayOrigin[axisIndex]) * inverseDirection;
            let slabExitT = (boxMaxCorner[axisIndex] - rayOrigin[axisIndex]) * inverseDirection;

            let entrySign = -1.0;
            if (slabEntryT > slabExitT) {
                [slabEntryT, slabExitT] = [slabExitT, slabEntryT];
                entrySign = 1.0;
            }

            if (slabEntryT > tEntryMax) {
                tEntryMax = slabEntryT;
                hitNormalAxis = axisIndex;
                hitNormalSign = entrySign;
            }
            tExitMin = Math.min(tExitMin, slabExitT);
        }

        if (tEntryMax > tExitMin || tExitMin < 0.001) return null;

        const hitT = tEntryMax > 0.001 ? tEntryMax : tExitMin;
        if (hitT < 0.001) return null;

        const hitNormal = new Float32Array([0, 0, 0]);
        if (hitNormalAxis >= 0) {
            hitNormal[hitNormalAxis] = hitNormalSign;
        }

        return { hitT, hitNormal };
    },

    /**
     * Ray-sphere intersection (from Project 1).
     * Returns hitT or -1.
     */
    intersectRaySphere(rayOrigin, rayDirection, sphereCenter, sphereRadius) {
        const originToCenter = this.subtractVectors(rayOrigin, sphereCenter);
        const quadraticA = this.dotProduct(rayDirection, rayDirection);
        const quadraticB = 2.0 * this.dotProduct(originToCenter, rayDirection);
        const quadraticC = this.dotProduct(originToCenter, originToCenter) - sphereRadius * sphereRadius;
        const discriminantValue = quadraticB * quadraticB - 4.0 * quadraticA * quadraticC;

        if (discriminantValue < 0) return -1.0;

        const sqrtDiscriminant = Math.sqrt(discriminantValue);
        const hitT1 = (-quadraticB - sqrtDiscriminant) / (2.0 * quadraticA);
        const hitT2 = (-quadraticB + sqrtDiscriminant) / (2.0 * quadraticA);

        if (hitT1 > 0.001) return hitT1;
        if (hitT2 > 0.001) return hitT2;
        return -1.0;
    },

    // -- Camera Ray Generation ---------------------------------------

    /**
     * Build a ray direction from pixel coordinates + camera orientation.
     * Same approach as Project 1's camera model ported to real-time.
     */
    buildCameraRayDirection(pixelX, pixelY, canvasWidth, canvasHeight, cameraYawAngle, cameraPitchAngle, fieldOfViewRadians = Math.PI * 0.5) {
        const aspectRatioValue = canvasWidth / canvasHeight;
        const fieldOfViewScale = Math.tan(fieldOfViewRadians / 2.0);

        // Normalized device coordinates
        const normalizedX = (2.0 * pixelX / canvasWidth - 1.0) * aspectRatioValue * fieldOfViewScale;
        const normalizedY = (1.0 - 2.0 * pixelY / canvasHeight) * fieldOfViewScale;

        // Camera forward, right, up from yaw/pitch
        const cosYaw = Math.cos(cameraYawAngle);
        const sinYaw = Math.sin(cameraYawAngle);
        const cosPitch = Math.cos(cameraPitchAngle);
        const sinPitch = Math.sin(cameraPitchAngle);

        const forwardVector = this.createVector(
            cosPitch * sinYaw,
            sinPitch,
            cosPitch * cosYaw
        );
        const worldUpVector = this.createVector(0, 1, 0);
        const rightVector = this.normalizeVector(this.crossProduct(worldUpVector, forwardVector));
        const cameraUpVector = this.crossProduct(forwardVector, rightVector);

        // Ray direction = forward + normalizedX * right + normalizedY * up
        const rayDirection = this.normalizeVector(this.addVectors(
            this.addVectors(
                forwardVector,
                this.scaleVector(rightVector, normalizedX)
            ),
            this.scaleVector(cameraUpVector, normalizedY)
        ));

        return rayDirection;
    }
};
