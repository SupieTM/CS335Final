#version 300 es
precision highp float;

in vec2 fragmentScreenCoord;
out vec4 finalFragmentColor;

uniform sampler2D bloomSourceTexture;
uniform vec2 blurDirection;  // (1,0) for horizontal, (0,1) for vertical

// 5-tap separable gaussian, symmetrical around the center sample.
// weights from standard unit-variance gaussian, normalized.
const float gaussianWeights[5] = float[](
    0.227027, 0.194596, 0.121622, 0.054054, 0.016216
);

void main() {
    vec2 pixelSize = 1.0 / vec2(textureSize(bloomSourceTexture, 0));
    vec3 accumulatedColor = texture(bloomSourceTexture, fragmentScreenCoord).rgb * gaussianWeights[0];

    for (int tapIndex = 1; tapIndex < 5; tapIndex++) {
        vec2 pixelOffset = blurDirection * pixelSize * float(tapIndex);
        accumulatedColor += texture(bloomSourceTexture, fragmentScreenCoord + pixelOffset).rgb * gaussianWeights[tapIndex];
        accumulatedColor += texture(bloomSourceTexture, fragmentScreenCoord - pixelOffset).rgb * gaussianWeights[tapIndex];
    }

    finalFragmentColor = vec4(accumulatedColor, 1.0);
}
