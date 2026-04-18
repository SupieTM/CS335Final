#version 300 es
precision highp float;

in vec2 fragmentScreenCoord;
out vec4 finalFragmentColor;

uniform sampler2D sceneColorTexture;
uniform sampler2D bloomBlurredTexture;
uniform float bloomStrengthMultiplier;
uniform float vignetteStrength;

// ACES - keeps neon saturation; Reinhard desaturated the pinks too hard
vec3 applyAcesTonemap(vec3 hdrColor) {
    vec3 scaledColor = hdrColor * 0.6;
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((scaledColor * (a * scaledColor + b)) /
                 (scaledColor * (c * scaledColor + d) + e), 0.0, 1.0);
}

void main() {
    vec3 sceneColor = texture(sceneColorTexture, fragmentScreenCoord).rgb;
    vec3 bloomColor = texture(bloomBlurredTexture, fragmentScreenCoord).rgb;

    vec3 combinedColor = sceneColor + bloomColor * bloomStrengthMultiplier;
    combinedColor = applyAcesTonemap(combinedColor);

    vec2 vignetteCoord = fragmentScreenCoord * 2.0 - 1.0;
    float vignetteFactor = 1.0 - dot(vignetteCoord, vignetteCoord) * vignetteStrength;
    combinedColor *= clamp(vignetteFactor, 0.0, 1.0);

    combinedColor = pow(combinedColor, vec3(1.0 / 2.2));

    finalFragmentColor = vec4(combinedColor, 1.0);
}
