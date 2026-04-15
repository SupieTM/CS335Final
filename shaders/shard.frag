#version 300 es
precision highp float;

in float vParticleAlpha;
out vec4 finalFragmentColor;

// shard fragments are rendered into the HDR scene FBO with additive blending
// so they read as bright silver sparks that naturally get picked up by the
// bloom bright-pass extraction
void main() {
    if (vParticleAlpha < 0.01) discard;
    vec3 silverColor = vec3(3.5, 3.5, 4.2);
    finalFragmentColor = vec4(silverColor, vParticleAlpha);
}
