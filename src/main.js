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

const frameTimeSampleCount = 60;
const frameTimeSamples = new Float32Array(frameTimeSampleCount);
let frameTimeSampleIndex = 0;
let frameTimeSamplesFilled = 0;

let currentMaxBounceCount = 10;

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
    cameraController.resetForLayout(sceneGeometry.currentLayoutName);

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
        let sum = 0;
        for (let i = 0; i < frameTimeSamplesFilled; i++) sum += frameTimeSamples[i];
        const avgFrame = sum / frameTimeSamplesFilled;
        const fps = Math.round(1.0 / avgFrame);
        const ms = (avgFrame * 1000).toFixed(1);
        lastFpsUpdateTime = currentTimeMilliseconds;
        const fpsElement = document.getElementById('fpsDisplay');
        if (fpsElement) fpsElement.textContent = `${fps} FPS  (${ms} ms)`;
    }

    cameraController.updatePosition(deltaTimeSeconds, sceneGeometry);
    lightingManager.updateFlash(deltaTimeSeconds);
    shardParticleSystem.updatePhysics(deltaTimeSeconds);
    sceneGeometry.updateDoors(deltaTimeSeconds);

    updateDoorPrompt();

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

    shardParticleSystem.renderShards(cameraController, renderCanvas.width, renderCanvas.height);

    bloomPostProcessor.runPostProcessPipeline(fullscreenQuadVAO, renderCanvas.width, renderCanvas.height);
}

function updateDoorPrompt() {
    const prompt = document.getElementById('doorPrompt');
    if (!prompt) return;
    if (!cameraController.isPointerLocked) {
        prompt.classList.add('hidden');
        return;
    }
    const door = sceneGeometry.findNearbyDoor(cameraController.cameraPosition);
    if (!door) {
        prompt.classList.add('hidden');
        return;
    }
    const label = prompt.querySelector('.doorPromptLabel');
    if (label) {
        label.textContent = (door.targetProgress > 0.5) ? 'close door' : 'open door';
    }
    prompt.classList.remove('hidden');
}

function resizeCanvasToWindow() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (renderCanvas.width !== w || renderCanvas.height !== h) {
        renderCanvas.width = w;
        renderCanvas.height = h;
        if (bloomPostProcessor) bloomPostProcessor.resizeFramebuffers(w, h);
    }
}

function handleShatterClick() {
    const ray = cameraController.castRayFromScreenPoint(
        renderCanvas.width / 2,
        renderCanvas.height / 2,
        renderCanvas.width,
        renderCanvas.height
    );
    const hit = sceneGeometry.intersectRayWithScene(ray.rayOrigin, ray.rayDirection);
    if (!hit.didHit || hit.hitMaterialType !== 0) return;

    if (hit.hitPrimitiveType === 'plane' && hit.hitPlaneIndex >= 0) {
        shatterManager.breakMirror(hit.hitPlaneIndex, hit.hitSurfaceUV, hit.hitNormal);
        shardParticleSystem.spawnShardsFromShatter(20, hit.hitPosition, hit.hitNormal);
        lightingManager.triggerMuzzleFlash();
    } else if (hit.hitPrimitiveType === 'box' && hit.hitBoxIndex >= 0) {
        const layout = sceneGeometry.getCurrentLayout();
        const box = layout.boxObstacles[hit.hitBoxIndex];
        if (box && box.isDoorPanel) return;
        sceneGeometry.breakBoxByIndex(hit.hitBoxIndex);
        shardParticleSystem.spawnShardsFromShatter(28, hit.hitPosition, hit.hitNormal);
        lightingManager.triggerMuzzleFlash();
    }
}

function hexStringToNormalizedRgb(hexString) {
    const r = parseInt(hexString.slice(1, 3), 16) / 255.0;
    const g = parseInt(hexString.slice(3, 5), 16) / 255.0;
    const b = parseInt(hexString.slice(5, 7), 16) / 255.0;
    return [r * 2.6, g * 2.6, b * 2.6];
}

function setupUserInterface() {
    const bounceCountSlider = document.getElementById('bounceCountSlider');
    bounceCountSlider.addEventListener('input', (e) => {
        currentMaxBounceCount = parseInt(e.target.value);
        document.getElementById('bounceCountLabel').textContent = currentMaxBounceCount;
    });

    const roomLayoutSelector = document.getElementById('roomLayoutSelector');
    roomLayoutSelector.addEventListener('change', (e) => {
        const layoutName = e.target.value;
        sceneGeometry.switchLayout(layoutName);
        cameraController.resetForLayout(layoutName);
        shatterManager.resetAllMirrors();
        sceneGeometry.resetBrokenBoxes();
        shardParticleSystem.clearAllParticles();
    });

    const sensitivitySlider = document.getElementById('mouseSensitivitySlider');
    const sensitivityLabel = document.getElementById('mouseSensitivityLabel');
    const applySensitivity = (v) => {
        cameraController.setMouseSensitivity(v * 0.0001);
        sensitivityLabel.textContent = (v / 10.0).toFixed(1);
    };
    sensitivitySlider.addEventListener('input', (e) => applySensitivity(parseInt(e.target.value)));
    applySensitivity(parseInt(sensitivitySlider.value));

    const bloomStrengthSlider = document.getElementById('bloomStrengthSlider');
    const bloomStrengthLabel = document.getElementById('bloomStrengthLabel');
    bloomStrengthSlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value) / 10.0;
        bloomPostProcessor.setBloomStrength(v);
        bloomStrengthLabel.textContent = v.toFixed(1);
    });
    bloomPostProcessor.setBloomStrength(parseInt(bloomStrengthSlider.value) / 10.0);

    const bloomThresholdSlider = document.getElementById('bloomThresholdSlider');
    const bloomThresholdLabel = document.getElementById('bloomThresholdLabel');
    bloomThresholdSlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value) / 10.0;
        bloomPostProcessor.setBrightnessThreshold(v);
        bloomThresholdLabel.textContent = v.toFixed(1);
    });
    bloomPostProcessor.setBrightnessThreshold(parseInt(bloomThresholdSlider.value) / 10.0);

    const fovSlider = document.getElementById('fovSlider');
    const fovLabel = document.getElementById('fovLabel');
    fovSlider.addEventListener('input', (e) => {
        const deg = parseInt(e.target.value);
        cameraController.setFieldOfView(deg);
        fovLabel.textContent = deg;
    });
    cameraController.setFieldOfView(parseInt(fovSlider.value));

    for (let i = 0; i < 3; i++) {
        const picker = document.getElementById(`lightColor${i}`);
        if (!picker) continue;
        picker.addEventListener('input', (e) => {
            const [r, g, b] = hexStringToNormalizedRgb(e.target.value);
            lightingManager.setLightColor(i, r, g, b);
        });
    }

    const selectedLightSlider = document.getElementById('selectedLightSlider');
    const selectedLightLabel  = document.getElementById('selectedLightLabel');
    const lightPosXSlider = document.getElementById('lightPosXSlider');
    const lightPosYSlider = document.getElementById('lightPosYSlider');
    const lightPosZSlider = document.getElementById('lightPosZSlider');
    const lightPosXLabel = document.getElementById('lightPosXLabel');
    const lightPosYLabel = document.getElementById('lightPosYLabel');
    const lightPosZLabel = document.getElementById('lightPosZLabel');

    const syncPositionSliders = () => {
        const idx = parseInt(selectedLightSlider.value);
        const pos = lightingManager.getLightPosition(idx);
        if (!pos) return;
        lightPosXSlider.value = pos[0].toFixed(1);
        lightPosYSlider.value = pos[1].toFixed(1);
        lightPosZSlider.value = pos[2].toFixed(1);
        lightPosXLabel.textContent = pos[0].toFixed(1);
        lightPosYLabel.textContent = pos[1].toFixed(1);
        lightPosZLabel.textContent = pos[2].toFixed(1);
        selectedLightLabel.textContent = (idx + 1).toString();
    };
    syncPositionSliders();

    selectedLightSlider.addEventListener('input', syncPositionSliders);

    const applyLightPosition = () => {
        const idx = parseInt(selectedLightSlider.value);
        const x = parseFloat(lightPosXSlider.value);
        const y = parseFloat(lightPosYSlider.value);
        const z = parseFloat(lightPosZSlider.value);
        lightingManager.setLightPosition(idx, x, y, z);
        lightPosXLabel.textContent = x.toFixed(1);
        lightPosYLabel.textContent = y.toFixed(1);
        lightPosZLabel.textContent = z.toFixed(1);
    };
    lightPosXSlider.addEventListener('input', applyLightPosition);
    lightPosYSlider.addEventListener('input', applyLightPosition);
    lightPosZSlider.addEventListener('input', applyLightPosition);

    document.getElementById('resetMirrorsButton').addEventListener('click', (e) => {
        e.stopPropagation();
        shatterManager.resetAllMirrors();
        sceneGeometry.resetBrokenBoxes();
        shardParticleSystem.clearAllParticles();
    });

    const pointerLockOverlay = document.getElementById('pointerLockOverlay');
    cameraController.onPointerLockChangeCallback = (isLocked) => {
        if (isLocked) pointerLockOverlay.classList.add('hidden');
        else pointerLockOverlay.classList.remove('hidden');
    };
    pointerLockOverlay.addEventListener('click', () => {
        renderCanvas.requestPointerLock();
    });

    renderCanvas.addEventListener('mousedown', (e) => {
        if (e.button === 0 && cameraController.isPointerLocked) {
            handleShatterClick();
        }
    });

    document.addEventListener('keydown', (keyEvent) => {
        if (keyEvent.code === 'KeyF') {
            lightingManager.triggerMuzzleFlash();
        }
        if (keyEvent.code === 'KeyR') {
            shatterManager.resetAllMirrors();
            sceneGeometry.resetBrokenBoxes();
            shardParticleSystem.clearAllParticles();
        }
        if (keyEvent.code === 'KeyE' && cameraController.isPointerLocked) {
            const door = sceneGeometry.findNearbyDoor(cameraController.cameraPosition);
            if (door) sceneGeometry.toggleDoor(door);
        }
        if (keyEvent.code === 'Tab') {
            keyEvent.preventDefault();
            document.getElementById('controlPanel').classList.toggle('hidden');
            document.getElementById('keybindCard').classList.toggle('hidden');
        }
    });
}

window.addEventListener('DOMContentLoaded', initializeApplication);
