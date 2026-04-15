#version 300 es
precision highp float;

in vec2 fragmentScreenCoord;
out vec4 finalFragmentColor;

uniform sampler2D sceneColorTexture;
uniform float brightnessThreshold;

// soft knee around the threshold so the extraction isn't a hard edge
void main() {
    vec3 sceneColor = texture(sceneColorTexture, fragmentScreenCoord).rgb;
    float peakLuminance = max(max(sceneColor.r, sceneColor.g), sceneColor.b);
    float softKnee = 0.5;
    float kneeLower = brightnessThreshold - softKnee;
    float kneeCurve = clamp(peakLuminance - kneeLower, 0.0, 2.0 * softKnee);
    kneeCurve = kneeCurve * kneeCurve / (4.0 * softKnee + 1e-5);
    float contribution = max(peakLuminance - brightnessThreshold, kneeCurve) / max(peakLuminance, 1e-5);

    finalFragmentColor = vec4(sceneColor * contribution, 1.0);
}
