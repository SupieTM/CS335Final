#version 300 es
precision highp float;

// reconstructs the same camera basis as the raytracer so the shards line up
// perfectly with the world the rays are drawing. builds a perspective matrix
// on the fly from the fov/aspect uniforms.

layout(location = 0) in vec3 worldPosition;
layout(location = 1) in float particleAlpha;

uniform vec3 cameraPosition;
uniform float cameraYawAngle;
uniform float cameraPitchAngle;
uniform float cameraFovRadians;
uniform vec2 canvasResolution;

out float vParticleAlpha;

void main() {
    float cp = cos(cameraPitchAngle);
    float sp = sin(cameraPitchAngle);
    float cy = cos(cameraYawAngle);
    float sy = sin(cameraYawAngle);

    vec3 forwardAxis = vec3(cp * sy, sp, cp * cy);
    vec3 worldUp = vec3(0.0, 1.0, 0.0);
    vec3 rightAxis = normalize(cross(worldUp, forwardAxis));
    vec3 upAxis = cross(forwardAxis, rightAxis);

    vec3 relativePosition = worldPosition - cameraPosition;
    vec3 cameraSpace = vec3(
        dot(rightAxis, relativePosition),
        dot(upAxis, relativePosition),
        dot(forwardAxis, relativePosition)
    );

    float aspectRatio = canvasResolution.x / canvasResolution.y;
    float focalLength = 1.0 / tan(cameraFovRadians * 0.5);
    float nearPlane = 0.05;
    float farPlane = 100.0;

    vec4 clipPosition;
    clipPosition.x = cameraSpace.x * focalLength / aspectRatio;
    clipPosition.y = cameraSpace.y * focalLength;
    clipPosition.z = cameraSpace.z * (farPlane + nearPlane) / (farPlane - nearPlane)
                   - 2.0 * farPlane * nearPlane / (farPlane - nearPlane);
    clipPosition.w = cameraSpace.z;

    gl_Position = clipPosition;
    vParticleAlpha = particleAlpha;
}
