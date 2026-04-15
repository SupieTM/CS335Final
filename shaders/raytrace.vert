#version 300 es
// fullscreen quad passthrough used by every render pass

layout(location = 0) in vec2 vertexPosition;
out vec2 fragmentScreenCoord;

void main() {
    fragmentScreenCoord = vertexPosition * 0.5 + 0.5;
    gl_Position = vec4(vertexPosition, 0.0, 1.0);
}
