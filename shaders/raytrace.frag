#version 300 es
precision highp float;

uniform vec3 cameraPosition;
uniform float cameraYawAngle;
uniform float cameraPitchAngle;
uniform float cameraFovRadians;
uniform vec2 canvasResolution;

uniform vec3 planeNormals[16];
uniform float planeDistances[16];
uniform int planeMaterialTypes[16];
uniform int activePlaneCount;

uniform vec3 boxCenterPositions[32];
uniform vec3 boxHalfExtents[32];
uniform int boxMaterialTypes[32];
uniform int isBoxBroken[32];
uniform int activeBoxCount;

uniform vec3 lightPositions[8];
uniform vec3 lightColors[8];
uniform int activeLightCount;

uniform int maxBounceCount;
uniform vec3 backgroundColorValue;
uniform float fogDensityValue;

uniform float currentTimeSeconds;

uniform int isShatteredMirror[16];
uniform vec2 voronoiSeedPositions[32];
uniform vec3 voronoiPerturbedNormals[32];
uniform int voronoiSeedCount;
uniform int shatteredMirrorIndex;

const int MATERIAL_MIRROR = 0;
const int MATERIAL_MATTE  = 1;
const int MATERIAL_GLOSSY = 2;

in vec2 fragmentScreenCoord;
out vec4 finalFragmentColor;

struct HitResult {
    bool  didHit;
    float hitDistance;
    vec3  hitPosition;
    vec3  surfaceNormal;
    int   materialType;
    int   planeIndex;
    vec3  surfaceColor;
};

float intersectRayWithPlane(vec3 rayOrigin, vec3 rayDirection,
                            vec3 planeNormal, float planeDistance) {
    float denom = dot(rayDirection, planeNormal);
    if (abs(denom) < 1e-6) return -1.0;
    float t = -(dot(rayOrigin, planeNormal) + planeDistance) / denom;
    return t > 0.001 ? t : -1.0;
}

float intersectRayWithBox(vec3 rayOrigin, vec3 rayDirection,
                          vec3 boxCenter, vec3 boxHalf,
                          out vec3 boxHitNormal) {
    vec3 boxMin = boxCenter - boxHalf;
    vec3 boxMax = boxCenter + boxHalf;

    float tEntry = -1e20;
    float tExit  =  1e20;
    vec3 entryNormal = vec3(0.0);

    for (int axis = 0; axis < 3; axis++) {
        float o = (axis == 0) ? rayOrigin.x : (axis == 1) ? rayOrigin.y : rayOrigin.z;
        float d = (axis == 0) ? rayDirection.x : (axis == 1) ? rayDirection.y : rayDirection.z;
        float lo = (axis == 0) ? boxMin.x : (axis == 1) ? boxMin.y : boxMin.z;
        float hi = (axis == 0) ? boxMax.x : (axis == 1) ? boxMax.y : boxMax.z;

        if (abs(d) < 1e-8) {
            if (o < lo || o > hi) return -1.0;
            continue;
        }

        float inv = 1.0 / d;
        float t0 = (lo - o) * inv;
        float t1 = (hi - o) * inv;

        vec3 n = vec3(0.0);
        if (axis == 0) n = vec3(-sign(d), 0.0, 0.0);
        if (axis == 1) n = vec3(0.0, -sign(d), 0.0);
        if (axis == 2) n = vec3(0.0, 0.0, -sign(d));

        if (t0 > t1) {
            float tmp = t0; t0 = t1; t1 = tmp;
            n = -n;
        }

        if (t0 > tEntry) {
            tEntry = t0;
            entryNormal = n;
        }
        tExit = min(tExit, t1);
    }

    if (tEntry > tExit || tExit < 0.001) return -1.0;
    float t = tEntry > 0.001 ? tEntry : tExit;
    if (t < 0.001) return -1.0;
    boxHitNormal = entryNormal;
    return t;
}

vec2 projectHitToPlaneUV(vec3 hitPosition, vec3 planeNormal) {
    vec3 a = abs(planeNormal);
    if (a.y > a.x && a.y > a.z) return hitPosition.xz;
    if (a.x > a.z) return hitPosition.zy;
    return hitPosition.xy;
}

vec3 getShatteredNormal(vec3 hitPosition, int planeIndex, vec3 baseNormal,
                        out bool isCrackLine) {
    isCrackLine = false;
    if (isShatteredMirror[planeIndex] == 0) return baseNormal;

    vec2 uv = projectHitToPlaneUV(hitPosition, baseNormal);

    float closestD = 1e20;
    float secondD  = 1e20;
    int closestIdx = 0;

    for (int i = 0; i < 32; i++) {
        if (i >= voronoiSeedCount) break;
        float d = distance(uv, voronoiSeedPositions[i]);
        if (d < closestD) {
            secondD = closestD;
            closestD = d;
            closestIdx = i;
        } else if (d < secondD) {
            secondD = d;
        }
    }

    // crack line where two cells meet
    if (secondD - closestD < 0.008) isCrackLine = true;

    return normalize(voronoiPerturbedNormals[closestIdx]);
}

HitResult intersectEntireScene(vec3 rayOrigin, vec3 rayDirection) {
    HitResult closest;
    closest.didHit = false;
    closest.hitDistance = 1e20;
    closest.planeIndex = -1;

    for (int i = 0; i < 16; i++) {
        if (i >= activePlaneCount) break;
        float t = intersectRayWithPlane(rayOrigin, rayDirection,
                                        planeNormals[i], planeDistances[i]);
        if (t > 0.0 && t < closest.hitDistance) {
            closest.didHit = true;
            closest.hitDistance = t;
            closest.hitPosition = rayOrigin + rayDirection * t;
            closest.surfaceNormal = planeNormals[i];
            closest.materialType = planeMaterialTypes[i];
            closest.planeIndex = i;

            if (closest.materialType == MATERIAL_GLOSSY) {
                // faint grout pattern so the floor has depth cues without reading as chess
                vec2 tile = floor(closest.hitPosition.xz * 1.0);
                float edge = 1.0 - smoothstep(0.0, 0.03,
                    min(fract(closest.hitPosition.x), fract(closest.hitPosition.z)));
                closest.surfaceColor = vec3(0.015, 0.012, 0.025) + edge * vec3(0.01, 0.008, 0.015);
            } else if (closest.materialType == MATERIAL_MATTE) {
                closest.surfaceColor = vec3(0.04, 0.035, 0.055);
            } else {
                closest.surfaceColor = vec3(0.02);
            }
        }
    }

    for (int i = 0; i < 32; i++) {
        if (i >= activeBoxCount) break;
        if (isBoxBroken[i] == 1) continue;

        vec3 n;
        float t = intersectRayWithBox(rayOrigin, rayDirection,
                                      boxCenterPositions[i], boxHalfExtents[i], n);
        if (t > 0.0 && t < closest.hitDistance) {
            closest.didHit = true;
            closest.hitDistance = t;
            closest.hitPosition = rayOrigin + rayDirection * t;
            closest.surfaceNormal = n;
            closest.materialType = boxMaterialTypes[i];
            closest.planeIndex = -1;
            closest.surfaceColor = (boxMaterialTypes[i] == MATERIAL_MIRROR)
                ? vec3(0.018, 0.014, 0.025)
                : vec3(0.12, 0.1, 0.14);
        }
    }

    return closest;
}

vec3 computePhongLighting(vec3 hitPosition, vec3 surfaceNormal,
                          vec3 viewDirection, vec3 surfaceColor) {
    vec3 total = surfaceColor * 0.08;

    for (int i = 0; i < 8; i++) {
        if (i >= activeLightCount) break;

        vec3 L = lightPositions[i] - hitPosition;
        float dist = length(L);
        vec3 Ldir = L / max(dist, 0.001);

        // softer falloff so neons reach further down the corridor
        float atten = 1.0 / (1.0 + 0.06 * dist + 0.012 * dist * dist);

        float diff = max(dot(surfaceNormal, Ldir), 0.0);
        vec3 H = normalize(Ldir + viewDirection);
        float spec = pow(max(dot(surfaceNormal, H), 0.0), 96.0);

        vec3 diffuseTerm = surfaceColor * diff * 1.4;
        vec3 specTerm = lightColors[i] * spec * 0.9;

        total += atten * lightColors[i] * (diffuseTerm + vec3(0.2))
               + atten * specTerm;
    }

    return total;
}

float fresnelSchlick(float cosTheta, float F0) {
    float m = 1.0 - clamp(cosTheta, 0.0, 1.0);
    float m2 = m * m;
    return F0 + (1.0 - F0) * m2 * m2 * m;
}

vec3 buildCameraRayDirection(vec2 screenUV) {
    float aspect = canvasResolution.x / canvasResolution.y;
    float fovScale = tan(cameraFovRadians * 0.5);

    float ndcX = (screenUV.x * 2.0 - 1.0) * aspect * fovScale;
    float ndcY = (screenUV.y * 2.0 - 1.0) * fovScale;

    float cy = cos(cameraYawAngle);
    float sy = sin(cameraYawAngle);
    float cp = cos(cameraPitchAngle);
    float sp = sin(cameraPitchAngle);

    vec3 forward = vec3(cp * sy, sp, cp * cy);
    vec3 worldUp = vec3(0.0, 1.0, 0.0);
    vec3 right = normalize(cross(worldUp, forward));
    vec3 up = cross(forward, right);

    return normalize(forward + ndcX * right + ndcY * up);
}

void main() {
    vec3 rayOrigin = cameraPosition;
    vec3 rayDirection = buildCameraRayDirection(fragmentScreenCoord);

    vec3 accumulated = vec3(0.0);
    float reflectivity = 1.0;
    float totalDist = 0.0;

    // iterative bounce loop (GLSL can't recurse)
    for (int bounce = 0; bounce < 15; bounce++) {
        if (bounce >= maxBounceCount) break;

        HitResult hit = intersectEntireScene(rayOrigin, rayDirection);

        if (!hit.didHit) {
            accumulated += reflectivity * backgroundColorValue;
            break;
        }

        totalDist += hit.hitDistance;
        vec3 viewDir = -rayDirection;
        vec3 N = hit.surfaceNormal;

        bool isCrackLine = false;
        if (hit.planeIndex >= 0 && isShatteredMirror[hit.planeIndex] == 1) {
            N = getShatteredNormal(hit.hitPosition, hit.planeIndex, hit.surfaceNormal, isCrackLine);
        }

        vec3 local = computePhongLighting(hit.hitPosition, N, viewDir, hit.surfaceColor);

        if (hit.materialType == MATERIAL_MIRROR && !isCrackLine) {
            float cosI = max(dot(viewDir, N), 0.0);
            float F = fresnelSchlick(cosI, 0.04);
            float mirrorR = mix(0.88, 0.995, F);

            accumulated += reflectivity * local * (1.0 - mirrorR);
            // faint silvered tint per bounce
            reflectivity *= mirrorR * 0.992;

            rayOrigin = hit.hitPosition + N * 0.002;
            rayDirection = reflect(rayDirection, N);

        } else if (hit.materialType == MATERIAL_GLOSSY && !isCrackLine) {
            float cosI = max(dot(viewDir, N), 0.0);
            float F = fresnelSchlick(cosI, 0.025);
            float floorR = mix(0.15, 0.7, F);

            accumulated += reflectivity * local * (1.0 - floorR);
            reflectivity *= floorR;

            rayOrigin = hit.hitPosition + N * 0.002;
            rayDirection = reflect(rayDirection, N);

        } else {
            vec3 crackTint = isCrackLine ? vec3(0.02, 0.02, 0.04) : vec3(1.0);
            accumulated += reflectivity * local * crackTint;
            break;
        }
    }

    float fog = 1.0 - exp(-fogDensityValue * totalDist);
    accumulated = mix(accumulated, backgroundColorValue, fog);

    // output raw HDR; tonemap + gamma + bloom happen in the composite pass
    finalFragmentColor = vec4(accumulated, 1.0);
}
