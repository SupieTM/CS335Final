import { createShaderProgram, fetchShaderSource } from './shaderUtils.js';
import { CameraController } from './cameraController.js';
import { SceneGeometry } from './sceneGeometry.js';
import { LightingManager } from './lightingManager.js';
import { ShatterManager } from './shatterManager.js';
import { BloomPostProcessor } from './bloomPostProcessor.js';
import { ShardParticleSystem } from './shardParticleSystem.js';

let glContext;
let renderCanvas;
let raytraceShaderProgram;
let fullscreenQuadVAO;

let cameraController;
let sceneGeometry;
let lightingManager;
let shatterManager;
let bloomPostProcessor;
let shardParticleSystem;
let cachedPassthroughVertSource = null;

let previousFrameTime = 0;
let lastFpsUpdateTime = 0;

// rolling avg - instant FPS jitters too much to read
const frameTimeSampleCount = 60;
const frameTimeSamples = new Float32Array(frameTimeSampleCount);
let frameTimeSampleIndex = 0;
let frameTimeSamplesFilled = 0;

let currentMaxBounceCount = 12;

async function initializeApplication() {
    renderCanvas = document.getElementById('renderCanvas');
    glContext = renderCanvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' });

    if (!glContext) {
        document.getElementById('errorDisplay').textContent =
            'WebGL2 is not supported by your browser.';
        return;
    }

    resizeCanvasToWindow();
    window.addEventListener('resize', resizeCanvasToWindow);

    const quadVertexPositions = new Float32Array([
        -1, -1,   1, -1,   -1, 1,
        -1,  1,   1, -1,    1, 1,
    ]);

    fullscreenQuadVAO = glContext.createVertexArray();
    glContext.bindVertexArray(fullscreenQuadVAO);

    const quadVertexBuffer = glContext.createBuffer();
    glContext.bindBuffer(glContext.ARRAY_BUFFER, quadVertexBuffer);
    glContext.bufferData(glContext.ARRAY_BUFFER, quadVertexPositions, glContext.STATIC_DRAW);

    glContext.enableVertexAttribArray(0);
    glContext.vertexAttribPointer(0, 2, glContext.FLOAT, false, 0, 0);
    glContext.bindVertexArray(null);

    try {
        const vertexShaderSource = await fetchShaderSource('shaders/raytrace.vert');
        const fragmentShaderSource = await fetchShaderSource('shaders/raytrace.frag');
        raytraceShaderProgram = createShaderProgram(glContext, vertexShaderSource, fragmentShaderSource);
        cachedPassthroughVertSource = vertexShaderSource;
    } catch (shaderError) {
        document.getElementById('errorDisplay').textContent = shaderError.message;
        console.error(shaderError);
        return;
    }

    cameraController = new CameraController(renderCanvas);
    sceneGeometry = new SceneGeometry();
    lightingManager = new LightingManager();
    shatterManager = new ShatterManager();

    bloomPostProcessor = new BloomPostProcessor(glContext, renderCanvas.width, renderCanvas.height);
    try {
        await bloomPostProcessor.loadShaderPrograms(cachedPassthroughVertSource);
    } catch (bloomError) {
        document.getElementById('errorDisplay').textContent = 'Bloom shader compile failed: ' + bloomError.message;
        console.error(bloomError);
        return;
    }

    shardParticleSystem = new ShardParticleSystem(glContext);
    await shardParticleSystem.initializeGraphicsResources();

    setupUserInterface();

    previousFrameTime = performance.now();
    lastFpsUpdateTime = previousFrameTime;
    requestAnimationFrame(renderFrame);
}

function renderFrame(currentTimeMilliseconds) {
    requestAnimationFrame(renderFrame);

    const deltaTimeSeconds = Math.min(
        (currentTimeMilliseconds - previousFrameTime) / 1000.0,
        0.1
    );
    previousFrameTime = currentTimeMilliseconds;

    frameTimeSamples[frameTimeSampleIndex] = deltaTimeSeconds;
    frameTimeSampleIndex = (frameTimeSampleIndex + 1) % frameTimeSampleCount;
    if (frameTimeSamplesFilled < frameTimeSampleCount) frameTimeSamplesFilled++;

    if (currentTimeMilliseconds - lastFpsUpdateTime >= 250) {
        let frameTimeSum = 0;
        for (let sampleIdx = 0; sampleIdx < frameTimeSamplesFilled; sampleIdx++) {
            frameTimeSum += frameTimeSamples[sampleIdx];
        }
        const averageFrameTimeSeconds = frameTimeSum / frameTimeSamplesFilled;
        const averageFpsValue = Math.round(1.0 / averageFrameTimeSeconds);
        const averageFrameMilliseconds = (averageFrameTimeSeconds * 1000).toFixed(1);
        lastFpsUpdateTime = currentTimeMilliseconds;
        const fpsElement = document.getElementById('fpsDisplay');
        if (fpsElement) fpsElement.textContent = `${averageFpsValue} FPS  (${averageFrameMilliseconds} ms)`;
    }

    cameraController.updatePosition(deltaTimeSeconds, sceneGeometry);
    lightingManager.updateFlash(deltaTimeSeconds);
    shardParticleSystem.updatePhysics(deltaTimeSeconds);

    // -- scene pass: raytrace into the HDR scene FBO
    bloomPostProcessor.bindSceneFramebuffer();
    glContext.clearColor(0, 0, 0, 1);
    glContext.clear(glContext.COLOR_BUFFER_BIT);

    glContext.useProgram(raytraceShaderProgram);

    cameraController.uploadCameraUniforms(glContext, raytraceShaderProgram);
    sceneGeometry.uploadSceneUniforms(glContext, raytraceShaderProgram);
    lightingManager.uploadLightUniforms(glContext, raytraceShaderProgram, cameraController.cameraPosition);
    shatterManager.uploadShatterUniforms(glContext, raytraceShaderProgram);

    glContext.uniform2f(
        glContext.getUniformLocation(raytraceShaderProgram, 'canvasResolution'),
        renderCanvas.width, renderCanvas.height
    );
    glContext.uniform1f(
        glContext.getUniformLocation(raytraceShaderProgram, 'currentTimeSeconds'),
        currentTimeMilliseconds / 1000.0
    );
    glContext.uniform1i(
        glContext.getUniformLocation(raytraceShaderProgram, 'maxBounceCount'),
        currentMaxBounceCount
    );

    glContext.bindVertexArray(fullscreenQuadVAO);
    glContext.drawArrays(glContext.TRIANGLES, 0, 6);
    glContext.bindVertexArray(null);

    // shards draw into the same HDR scene FBO so bloom picks them up
    shardParticleSystem.renderShards(cameraController, renderCanvas.width, renderCanvas.height);

    // -- post-process: bright extract, blur, composite to screen
    bloomPostProcessor.runPostProcessPipeline(fullscreenQuadVAO, renderCanvas.width, renderCanvas.height);
}

function resizeCanvasToWindow() {
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;
    if (renderCanvas.width !== displayWidth || renderCanvas.height !== displayHeight) {
        renderCanvas.width = displayWidth;
        renderCanvas.height = displayHeight;
        if (bloomPostProcessor) {
            bloomPostProcessor.resizeFramebuffers(displayWidth, displayHeight);
        }
    }
}

function handleShatterClick() {
    // cast a ray from the center of the screen since pointer is locked
    const ray = cameraController.castRayFromScreenPoint(
        renderCanvas.width / 2,
        renderCanvas.height / 2,
        renderCanvas.width,
        renderCanvas.height
    );
    const hit = sceneGeometry.intersectRayWithScene(ray.rayOrigin, ray.rayDirection);
    if (!hit.didHit || hit.hitMaterialType !== 0 /* MIRROR */) return;

    if (hit.hitPrimitiveType === 'plane' && hit.hitPlaneIndex >= 0) {
        shatterManager.breakMirror(hit.hitPlaneIndex, hit.hitSurfaceUV, hit.hitNormal);
        shardParticleSystem.spawnShardsFromShatter(20, hit.hitPosition, hit.hitNormal);
        lightingManager.triggerMuzzleFlash();
    } else if (hit.hitPrimitiveType === 'box' && hit.hitBoxIndex >= 0) {
        // free-standing panel just disappears in a burst of shards (no
        // voronoi cracks since the panel itself is gone)
        sceneGeometry.breakBoxByIndex(hit.hitBoxIndex);
        shardParticleSystem.spawnShardsFromShatter(28, hit.hitPosition, hit.hitNormal);
        lightingManager.triggerMuzzleFlash();
    }
}

function hexStringToNormalizedRgb(hexString) {
    const r = parseInt(hexString.slice(1, 3), 16) / 255.0;
    const g = parseInt(hexString.slice(3, 5), 16) / 255.0;
    const b = parseInt(hexString.slice(5, 7), 16) / 255.0;
    // boost saturation/intensity so ACES tonemap shows off the neon
    return [r * 2.6, g * 2.6, b * 2.6];
}

function setupUserInterface() {
    // bounce count
    const bounceCountSlider = document.getElementById('bounceCountSlider');
    bounceCountSlider.addEventListener('input', (e) => {
        currentMaxBounceCount = parseInt(e.target.value);
        document.getElementById('bounceCountLabel').textContent = currentMaxBounceCount;
    });

    // room layout
    const roomLayoutSelector = document.getElementById('roomLayoutSelector');
    roomLayoutSelector.addEventListener('change', (e) => {
        sceneGeometry.switchLayout(e.target.value);
        shatterManager.resetAllMirrors();
        sceneGeometry.resetBrokenBoxes();
        shardParticleSystem.clearAllParticles();
    });

    // mouse sensitivity (slider 1..50 maps to 0.0001..0.005)
    const sensitivitySlider = document.getElementById('mouseSensitivitySlider');
    const sensitivityLabel = document.getElementById('mouseSensitivityLabel');
    const applySensitivity = (sliderVal) => {
        const normalized = sliderVal / 10.0; // display value
        cameraController.setMouseSensitivity(sliderVal * 0.0001);
        sensitivityLabel.textContent = normalized.toFixed(1);
    };
    sensitivitySlider.addEventListener('input', (e) => applySensitivity(parseInt(e.target.value)));
    applySensitivity(parseInt(sensitivitySlider.value));

    // bloom strength (slider 0..40 maps to 0.0..4.0)
    const bloomStrengthSlider = document.getElementById('bloomStrengthSlider');
    const bloomStrengthLabel = document.getElementById('bloomStrengthLabel');
    bloomStrengthSlider.addEventListener('input', (e) => {
        const sliderValue = parseInt(e.target.value);
        const strengthValue = sliderValue / 10.0;
        bloomPostProcessor.setBloomStrength(strengthValue);
        bloomStrengthLabel.textContent = strengthValue.toFixed(1);
    });
    bloomPostProcessor.setBloomStrength(parseInt(bloomStrengthSlider.value) / 10.0);

    // bloom threshold (slider 2..30 maps to 0.2..3.0)
    const bloomThresholdSlider = document.getElementById('bloomThresholdSlider');
    const bloomThresholdLabel = document.getElementById('bloomThresholdLabel');
    bloomThresholdSlider.addEventListener('input', (e) => {
        const sliderValue = parseInt(e.target.value);
        const thresholdValue = sliderValue / 10.0;
        bloomPostProcessor.setBrightnessThreshold(thresholdValue);
        bloomThresholdLabel.textContent = thresholdValue.toFixed(1);
    });
    bloomPostProcessor.setBrightnessThreshold(parseInt(bloomThresholdSlider.value) / 10.0);

    // fov
    const fovSlider = document.getElementById('fovSlider');
    const fovLabel = document.getElementById('fovLabel');
    fovSlider.addEventListener('input', (e) => {
        const fovDeg = parseInt(e.target.value);
        cameraController.setFieldOfView(fovDeg);
        fovLabel.textContent = fovDeg;
    });
    cameraController.setFieldOfView(parseInt(fovSlider.value));

    // light color pickers
    for (let lightIdx = 0; lightIdx < 3; lightIdx++) {
        const picker = document.getElementById(`lightColor${lightIdx}`);
        if (!picker) continue;
        picker.addEventListener('input', (e) => {
            const [r, g, b] = hexStringToNormalizedRgb(e.target.value);
            lightingManager.setLightColor(lightIdx, r, g, b);
        });
    }

    // repair mirrors button
    document.getElementById('resetMirrorsButton').addEventListener('click', (e) => {
        e.stopPropagation();
        shatterManager.resetAllMirrors();
        sceneGeometry.resetBrokenBoxes();
        shardParticleSystem.clearAllParticles();
    });

    // pointer lock overlay - hide it while locked, show it when released
    const pointerLockOverlay = document.getElementById('pointerLockOverlay');
    cameraController.onPointerLockChangeCallback = (isLocked) => {
        if (isLocked) pointerLockOverlay.classList.add('hidden');
        else pointerLockOverlay.classList.remove('hidden');
    };
    pointerLockOverlay.addEventListener('click', () => {
        renderCanvas.requestPointerLock();
    });

    // left click = shatter (while locked)
    renderCanvas.addEventListener('mousedown', (e) => {
        if (e.button === 0 && cameraController.isPointerLocked) {
            handleShatterClick();
        }
    });

    // keyboard extras
    document.addEventListener('keydown', (keyEvent) => {
        if (keyEvent.code === 'KeyF') {
            lightingManager.triggerMuzzleFlash();
        }
        if (keyEvent.code === 'KeyR') {
            shatterManager.resetAllMirrors();
            shardParticleSystem.clearAllParticles();
        }
        if (keyEvent.code === 'Tab') {
            keyEvent.preventDefault();
            document.getElementById('controlPanel').classList.toggle('hidden');
            document.getElementById('keybindCard').classList.toggle('hidden');
        }
    });
}

window.addEventListener('DOMContentLoaded', initializeApplication);
