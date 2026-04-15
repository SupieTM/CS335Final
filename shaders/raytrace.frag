#version 300 es
precision highp float;

// uniforms

// Camera
uniform vec3 cameraPosition;
uniform float cameraYawAngle;
uniform float cameraPitchAngle;
uniform float cameraFovRadians;
uniform vec2 canvasResolution;

// Scene planes (max 16)
uniform vec3 planeNormals[16];
uniform float planeDistances[16];
uniform int planeMaterialTypes[16];
uniform int activePlaneCount;

// Scene boxes (max 32 - the labyrinth needs lots of mirror panels)
uniform vec3 boxCenterPositions[32];
uniform vec3 boxHalfExtents[32];
uniform int boxMaterialTypes[32];
uniform int isBoxBroken[32];
uniform int activeBoxCount;

// Lighting (max 8 point lights)
uniform vec3 lightPositions[8];
uniform vec3 lightColors[8];
uniform int activeLightCount;

// Ray tracing parameters
uniform int maxBounceCount;  // controlled by UI slider
uniform vec3 backgroundColorValue;
uniform float fogDensityValue;

// Time for animation
uniform float currentTimeSeconds;

// Shatter state (max 16 mirrors)
uniform int isShatteredMirror[16];
uniform vec2 voronoiSeedPositions[32]; // max 32 seeds
uniform vec3 voronoiPerturbedNormals[32];
uniform int voronoiSeedCount;
uniform int shatteredMirrorIndex; // which mirror's voronoi data is loaded

// -- Material constants ----------------------------------------------
const int MATERIAL_MIRROR = 0;
const int MATERIAL_MATTE  = 1;
const int MATERIAL_GLOSSY = 2;

// -- Varyings --------------------------------------------------------
in vec2 fragmentScreenCoord;
out vec4 finalFragmentColor;

// -- Hit info struct -------------------------------------------------
struct HitResult {
    bool  didHit;
    float hitDistance;
    vec3  hitPosition;
    vec3  surfaceNormal;
    int   materialType;
    int   planeIndex;      // -1 if not a plane
    vec3  surfaceColor;    // base color for matte/glossy surfaces
};

// -- Ray-Plane Intersection ------------------------------------------
// Same formula as Project 1: t = -(dot(o,n) + d) / dot(dir,n)

float intersectRayWithPlane(vec3 rayOrigin, vec3 rayDirection,
                            vec3 planeNormal, float planeDistance) {
    float denominatorValue = dot(rayDirection, planeNormal);
    if (abs(denominatorValue) < 1e-6) return -1.0;
    float hitT = -(dot(rayOrigin, planeNormal) + planeDistance) / denominatorValue;
    return hitT > 0.001 ? hitT : -1.0;
}

// -- Ray-Box Intersection (Slab Method) ------------------------------
// Same slab method used in Project 1 for AABB tests.

float intersectRayWithBox(vec3 rayOrigin, vec3 rayDirection,
                          vec3 boxCenter, vec3 boxHalf,
                          out vec3 boxHitNormal) {
    vec3 boxMinCorner = boxCenter - boxHalf;
    vec3 boxMaxCorner = boxCenter + boxHalf;

    float tEntryMax = -1e20;
    float tExitMin = 1e20;
    vec3 entryNormal = vec3(0.0);

    for (int axisIndex = 0; axisIndex < 3; axisIndex++) {
        float originComponent = (axisIndex == 0) ? rayOrigin.x : (axisIndex == 1) ? rayOrigin.y : rayOrigin.z;
        float dirComponent = (axisIndex == 0) ? rayDirection.x : (axisIndex == 1) ? rayDirection.y : rayDirection.z;
        float minComponent = (axisIndex == 0) ? boxMinCorner.x : (axisIndex == 1) ? boxMinCorner.y : boxMinCorner.z;
        float maxComponent = (axisIndex == 0) ? boxMaxCorner.x : (axisIndex == 1) ? boxMaxCorner.y : boxMaxCorner.z;

        if (abs(dirComponent) < 1e-8) {
            if (originComponent < minComponent || originComponent > maxComponent) return -1.0;
            continue;
        }

        float inverseDir = 1.0 / dirComponent;
        float slabEntryT = (minComponent - originComponent) * inverseDir;
        float slabExitT  = (maxComponent - originComponent) * inverseDir;

        vec3 candidateNormal = vec3(0.0);
        if (axisIndex == 0) candidateNormal = vec3(-sign(dirComponent), 0.0, 0.0);
        if (axisIndex == 1) candidateNormal = vec3(0.0, -sign(dirComponent), 0.0);
        if (axisIndex == 2) candidateNormal = vec3(0.0, 0.0, -sign(dirComponent));

        if (slabEntryT > slabExitT) {
            float tempSwap = slabEntryT;
            slabEntryT = slabExitT;
            slabExitT = tempSwap;
            candidateNormal = -candidateNormal;
        }

        if (slabEntryT > tEntryMax) {
            tEntryMax = slabEntryT;
            entryNormal = candidateNormal;
        }
        tExitMin = min(tExitMin, slabExitT);
    }

    if (tEntryMax > tExitMin || tExitMin < 0.001) return -1.0;
    float hitT = tEntryMax > 0.001 ? tEntryMax : tExitMin;
    if (hitT < 0.001) return -1.0;
    boxHitNormal = entryNormal;
    return hitT;
}

// -- Voronoi shattering ----------------------------------------------

vec2 projectHitToPlaneUV(vec3 hitPosition, vec3 planeNormal) {
    vec3 absNormal = abs(planeNormal);
    if (absNormal.y > absNormal.x && absNormal.y > absNormal.z) {
        return hitPosition.xz;
    } else if (absNormal.x > absNormal.z) {
        return hitPosition.zy;
    } else {
        return hitPosition.xy;
    }
}

vec3 getShatteredNormal(vec3 hitPosition, int planeIndex, vec3 baseNormal,
                        out bool isCrackLine) {
    isCrackLine = false;

    if (isShatteredMirror[planeIndex] == 0) return baseNormal;

    vec2 hitUV = projectHitToPlaneUV(hitPosition, baseNormal);

    float closestSeedDistance = 1e20;
    float secondClosestDistance = 1e20;
    int closestSeedIndex = 0;

    for (int seedIdx = 0; seedIdx < 32; seedIdx++) {
        if (seedIdx >= voronoiSeedCount) break;
        float seedDistance = distance(hitUV, voronoiSeedPositions[seedIdx]);
        if (seedDistance < closestSeedDistance) {
            secondClosestDistance = closestSeedDistance;
            closestSeedDistance = seedDistance;
            closestSeedIndex = seedIdx;
        } else if (seedDistance < secondClosestDistance) {
            secondClosestDistance = seedDistance;
        }
    }

    // Crack lines where two cells meet
    if (secondClosestDistance - closestSeedDistance < 0.008) {
        isCrackLine = true;
    }

    return normalize(voronoiPerturbedNormals[closestSeedIndex]);
}

// -- Full Scene Intersection -----------------------------------------

HitResult intersectEntireScene(vec3 rayOrigin, vec3 rayDirection) {
    HitResult closestHit;
    closestHit.didHit = false;
    closestHit.hitDistance = 1e20;
    closestHit.planeIndex = -1;

    // Test all planes
    for (int planeIdx = 0; planeIdx < 16; planeIdx++) {
        if (planeIdx >= activePlaneCount) break;

        float hitT = intersectRayWithPlane(rayOrigin, rayDirection,
                                           planeNormals[planeIdx], planeDistances[planeIdx]);
        if (hitT > 0.0 && hitT < closestHit.hitDistance) {
            closestHit.didHit = true;
            closestHit.hitDistance = hitT;
            closestHit.hitPosition = rayOrigin + rayDirection * hitT;
            closestHit.surfaceNormal = planeNormals[planeIdx];
            closestHit.materialType = planeMaterialTypes[planeIdx];
            closestHit.planeIndex = planeIdx;

            // floor and ceiling get a faint grout pattern so the corridor
            // has depth cues without reading as a chess board
            if (closestHit.materialType == MATERIAL_GLOSSY) {
                vec2 floorTile = floor(closestHit.hitPosition.xz * 1.0);
                float tileEdge = 1.0 - smoothstep(0.0, 0.03,
                    min(fract(closestHit.hitPosition.x), fract(closestHit.hitPosition.z)));
                closestHit.surfaceColor = vec3(0.015, 0.012, 0.025) + tileEdge * vec3(0.01, 0.008, 0.015);
            } else if (closestHit.materialType == MATERIAL_MATTE) {
                closestHit.surfaceColor = vec3(0.04, 0.035, 0.055);
            } else {
                closestHit.surfaceColor = vec3(0.02);
            }
        }
    }

    // Test all boxes
    for (int boxIdx = 0; boxIdx < 32; boxIdx++) {
        if (boxIdx >= activeBoxCount) break;
        if (isBoxBroken[boxIdx] == 1) continue;

        vec3 boxHitNormal;
        float hitT = intersectRayWithBox(rayOrigin, rayDirection,
                                         boxCenterPositions[boxIdx], boxHalfExtents[boxIdx],
                                         boxHitNormal);
        if (hitT > 0.0 && hitT < closestHit.hitDistance) {
            closestHit.didHit = true;
            closestHit.hitDistance = hitT;
            closestHit.hitPosition = rayOrigin + rayDirection * hitT;
            closestHit.surfaceNormal = boxHitNormal;
            closestHit.materialType = boxMaterialTypes[boxIdx];
            closestHit.planeIndex = -1;
            // mirror panels get a near-black tint so the reflection dominates
            closestHit.surfaceColor = (boxMaterialTypes[boxIdx] == MATERIAL_MIRROR)
                ? vec3(0.018, 0.014, 0.025)
                : vec3(0.12, 0.1, 0.14);
        }
    }

    return closestHit;
}

// -- Phong Lighting --------------------------------------------------
// Same Phong model as Project 1: ambient + diffuse + specular.

vec3 computePhongLighting(vec3 hitPosition, vec3 surfaceNormal,
                          vec3 viewDirection, vec3 surfaceColor) {
    vec3 ambientComponent = surfaceColor * 0.08;
    vec3 totalLighting = ambientComponent;

    for (int lightIdx = 0; lightIdx < 8; lightIdx++) {
        if (lightIdx >= activeLightCount) break;

        vec3 lightOffset = lightPositions[lightIdx] - hitPosition;
        float lightDistance = length(lightOffset);
        vec3 lightDirection = lightOffset / max(lightDistance, 0.001);

        // softer falloff so the neons reach further down the corridor
        float attenuationFactor = 1.0 / (1.0 + 0.06 * lightDistance + 0.012 * lightDistance * lightDistance);

        float diffuseIntensity = max(dot(surfaceNormal, lightDirection), 0.0);

        vec3 halfwayVector = normalize(lightDirection + viewDirection);
        float specularIntensity = pow(max(dot(surfaceNormal, halfwayVector), 0.0), 96.0);

        vec3 diffuseContribution = surfaceColor * diffuseIntensity * 1.4;
        vec3 specularContribution = lightColors[lightIdx] * specularIntensity * 0.9;

        totalLighting += attenuationFactor * lightColors[lightIdx] *
                         (diffuseContribution + vec3(0.2)) + attenuationFactor * specularContribution;
    }

    return totalLighting;
}

// schlick fresnel - grazing angles reflect more strongly, like real glass
float fresnelSchlick(float cosTheta, float baseReflectance) {
    float oneMinusCos = 1.0 - clamp(cosTheta, 0.0, 1.0);
    float powFive = oneMinusCos * oneMinusCos;
    powFive = powFive * powFive * oneMinusCos;
    return baseReflectance + (1.0 - baseReflectance) * powFive;
}

// -- Camera Ray Construction -----------------------------------------
// Same camera model as Project 1 / Project 2.

vec3 buildCameraRayDirection(vec2 screenUV) {
    float aspectRatioValue = canvasResolution.x / canvasResolution.y;
    float fieldOfViewScale = tan(cameraFovRadians * 0.5);

    float normalizedX = (screenUV.x * 2.0 - 1.0) * aspectRatioValue * fieldOfViewScale;
    float normalizedY = (screenUV.y * 2.0 - 1.0) * fieldOfViewScale;

    float cosYaw = cos(cameraYawAngle);
    float sinYaw = sin(cameraYawAngle);
    float cosPitch = cos(cameraPitchAngle);
    float sinPitch = sin(cameraPitchAngle);

    vec3 forwardVector = vec3(cosPitch * sinYaw, sinPitch, cosPitch * cosYaw);
    vec3 worldUpVector = vec3(0.0, 1.0, 0.0);
    vec3 rightVector = normalize(cross(worldUpVector, forwardVector));
    vec3 cameraUpVector = cross(forwardVector, rightVector);

    return normalize(forwardVector + normalizedX * rightVector + normalizedY * cameraUpVector);
}

// -- Main Ray Trace Loop ---------------------------------------------
// Iterative version of the recursive ray tracer from Project 1.
// for loop replaces recursion since GLSL doesn't support true recursion.

void main() {
    vec3 rayOrigin = cameraPosition;
    vec3 rayDirection = buildCameraRayDirection(fragmentScreenCoord);

    vec3 accumulatedColor = vec3(0.0);
    float reflectivityMultiplier = 1.0;
    float totalRayDistance = 0.0;

    // Iterative bounce loop (compile-time max 15, runtime controlled by maxBounceCount)
    for (int bounceIndex = 0; bounceIndex < 15; bounceIndex++) {
        if (bounceIndex >= maxBounceCount) break;

        HitResult hitResult = intersectEntireScene(rayOrigin, rayDirection);

        if (!hitResult.didHit) {
            // Ray escaped the scene - add background
            accumulatedColor += reflectivityMultiplier * backgroundColorValue;
            break;
        }

        totalRayDistance += hitResult.hitDistance;
        vec3 viewDirection = -rayDirection;
        vec3 effectiveNormal = hitResult.surfaceNormal;

        // Handle shattered mirrors
        bool isCrackLine = false;
        if (hitResult.planeIndex >= 0 && isShatteredMirror[hitResult.planeIndex] == 1) {
            effectiveNormal = getShatteredNormal(hitResult.hitPosition,
                                                  hitResult.planeIndex,
                                                  hitResult.surfaceNormal,
                                                  isCrackLine);
        }

        // Compute lighting at this hit point
        vec3 localLighting = computePhongLighting(hitResult.hitPosition,
                                                   effectiveNormal,
                                                   viewDirection,
                                                   hitResult.surfaceColor);

        if (hitResult.materialType == MATERIAL_MIRROR && !isCrackLine) {
            float cosIncident = max(dot(viewDirection, effectiveNormal), 0.0);
            float fresnelFactor = fresnelSchlick(cosIncident, 0.04);
            float mirrorReflectivity = mix(0.88, 0.995, fresnelFactor);

            accumulatedColor += reflectivityMultiplier * localLighting * (1.0 - mirrorReflectivity);
            reflectivityMultiplier *= mirrorReflectivity * 0.992; // faint silvered tint per bounce

            rayOrigin = hitResult.hitPosition + effectiveNormal * 0.002;
            rayDirection = reflect(rayDirection, effectiveNormal);

        } else if (hitResult.materialType == MATERIAL_GLOSSY && !isCrackLine) {
            // polished floor - weak fresnel reflection on top of diffuse
            float cosIncident = max(dot(viewDirection, effectiveNormal), 0.0);
            float glossFresnel = fresnelSchlick(cosIncident, 0.025);
            float floorReflectivity = mix(0.15, 0.7, glossFresnel);

            accumulatedColor += reflectivityMultiplier * localLighting * (1.0 - floorReflectivity);
            reflectivityMultiplier *= floorReflectivity;

            rayOrigin = hitResult.hitPosition + effectiveNormal * 0.002;
            rayDirection = reflect(rayDirection, effectiveNormal);

        } else {
            // matte or crack line absorbs remaining light
            vec3 crackTint = isCrackLine ? vec3(0.02, 0.02, 0.04) : vec3(1.0);
            accumulatedColor += reflectivityMultiplier * localLighting * crackTint;
            break;
        }
    }

    // exponential fog
    float fogFactor = 1.0 - exp(-fogDensityValue * totalRayDistance);
    accumulatedColor = mix(accumulatedColor, backgroundColorValue, fogFactor);

    // output raw HDR - tonemap, gamma, bloom, and vignette all happen in the
    // post-process composite pass so that bright-pass extraction can operate
    // on true HDR values above 1.0
    finalFragmentColor = vec4(accumulatedColor, 1.0);
}
