#version 300 es
precision highp float;

in float vParticleAlpha;
out vec4 finalFragmentColor;

// additive-blended into the HDR buffer so bloom picks these up as sparks
void main() {
    if (vParticleAlpha < 0.01) discard;
    vec3 silverColor = vec3(3.5, 3.5, 4.2);
    finalFragmentColor = vec4(silverColor, vParticleAlpha);
}
