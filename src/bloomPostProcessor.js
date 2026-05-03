import { createShaderProgram, fetchShaderSource } from './shaderUtils.js';

export class BloomPostProcessor {
    constructor(glContext, canvasWidth, canvasHeight) {
        this.gl = glContext;

        // RGBA16F needed so HDR values > 1.0 survive into the bright-pass
        const colorBufferFloatExt = glContext.getExtension('EXT_color_buffer_float');
        this.useFloatTextures = !!colorBufferFloatExt;
        if (!this.useFloatTextures) {
            console.warn('EXT_color_buffer_float unavailable, bloom falls back to LDR RGBA8');
        }

        this.bloomStrengthMultiplier = 1.4;
        this.brightnessThreshold = 1.0;
        this.vignetteStrength = 0.35;
        this.blurIterationCount = 5;

        this.sceneFramebuffer = null;
        this.bloomPingFbo = null;
        this.bloomPongFbo = null;
        this._createAllFramebuffers(canvasWidth, canvasHeight);

        this.extractProgram = null;
        this.blurProgram = null;
        this.compositeProgram = null;
    }

    async loadShaderPrograms(passthroughVertSource) {
        const extractFragSource = await fetchShaderSource('shaders/bloomExtract.frag');
        const blurFragSource = await fetchShaderSource('shaders/bloomBlur.frag');
        const compositeFragSource = await fetchShaderSource('shaders/bloomComposite.frag');

        this.extractProgram = createShaderProgram(this.gl, passthroughVertSource, extractFragSource);
        this.blurProgram = createShaderProgram(this.gl, passthroughVertSource, blurFragSource);
        this.compositeProgram = createShaderProgram(this.gl, passthroughVertSource, compositeFragSource);
    }

    _createAllFramebuffers(canvasWidth, canvasHeight) {
        this.sceneFramebuffer = this._createSingleFbo(canvasWidth, canvasHeight);
        const halfWidth = Math.max(1, Math.floor(canvasWidth / 2));
        const halfHeight = Math.max(1, Math.floor(canvasHeight / 2));
        this.bloomPingFbo = this._createSingleFbo(halfWidth, halfHeight);
        this.bloomPongFbo = this._createSingleFbo(halfWidth, halfHeight);
    }

    _createSingleFbo(fboWidth, fboHeight) {
        const gl = this.gl;

        const colorTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, colorTexture);

        const internalFormat = this.useFloatTextures ? gl.RGBA16F : gl.RGBA8;
        const dataType = this.useFloatTextures ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, fboWidth, fboHeight, 0, gl.RGBA, dataType, null);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        const framebufferObject = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebufferObject);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0);

        const fboStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (fboStatus !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('FBO incomplete, status =', fboStatus);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        return { framebufferObject, colorTexture, fboWidth, fboHeight };
    }

    _deleteSingleFbo(fboEntry) {
        if (!fboEntry) return;
        this.gl.deleteFramebuffer(fboEntry.framebufferObject);
        this.gl.deleteTexture(fboEntry.colorTexture);
    }

    resizeFramebuffers(canvasWidth, canvasHeight) {
        this._deleteSingleFbo(this.sceneFramebuffer);
        this._deleteSingleFbo(this.bloomPingFbo);
        this._deleteSingleFbo(this.bloomPongFbo);
        this._createAllFramebuffers(canvasWidth, canvasHeight);
    }

    bindSceneFramebuffer() {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFramebuffer.framebufferObject);
        gl.viewport(0, 0, this.sceneFramebuffer.fboWidth, this.sceneFramebuffer.fboHeight);
    }

    runPostProcessPipeline(fullscreenQuadVAO, canvasWidth, canvasHeight) {
        const gl = this.gl;
        gl.bindVertexArray(fullscreenQuadVAO);

        // bright-extract: scene -> bloomPing
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomPingFbo.framebufferObject);
        gl.viewport(0, 0, this.bloomPingFbo.fboWidth, this.bloomPingFbo.fboHeight);
        gl.useProgram(this.extractProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.sceneFramebuffer.colorTexture);
        gl.uniform1i(gl.getUniformLocation(this.extractProgram, 'sceneColorTexture'), 0);
        gl.uniform1f(gl.getUniformLocation(this.extractProgram, 'brightnessThreshold'), this.brightnessThreshold);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // separable gaussian blur, ping-ponging between the two half-res fbos
        gl.useProgram(this.blurProgram);
        const blurSourceUniform = gl.getUniformLocation(this.blurProgram, 'bloomSourceTexture');
        const blurDirectionUniform = gl.getUniformLocation(this.blurProgram, 'blurDirection');

        for (let iteration = 0; iteration < this.blurIterationCount; iteration++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomPongFbo.framebufferObject);
            gl.viewport(0, 0, this.bloomPongFbo.fboWidth, this.bloomPongFbo.fboHeight);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.bloomPingFbo.colorTexture);
            gl.uniform1i(blurSourceUniform, 0);
            gl.uniform2f(blurDirectionUniform, 1.0, 0.0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);

            gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomPingFbo.framebufferObject);
            gl.viewport(0, 0, this.bloomPingFbo.fboWidth, this.bloomPingFbo.fboHeight);
            gl.bindTexture(gl.TEXTURE_2D, this.bloomPongFbo.colorTexture);
            gl.uniform1i(blurSourceUniform, 0);
            gl.uniform2f(blurDirectionUniform, 0.0, 1.0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }

        // composite to default framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvasWidth, canvasHeight);
        gl.useProgram(this.compositeProgram);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.sceneFramebuffer.colorTexture);
        gl.uniform1i(gl.getUniformLocation(this.compositeProgram, 'sceneColorTexture'), 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.bloomPingFbo.colorTexture);
        gl.uniform1i(gl.getUniformLocation(this.compositeProgram, 'bloomBlurredTexture'), 1);

        gl.uniform1f(gl.getUniformLocation(this.compositeProgram, 'bloomStrengthMultiplier'), this.bloomStrengthMultiplier);
        gl.uniform1f(gl.getUniformLocation(this.compositeProgram, 'vignetteStrength'), this.vignetteStrength);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindVertexArray(null);
    }

    setBloomStrength(newStrength) { this.bloomStrengthMultiplier = newStrength; }
    setBrightnessThreshold(newThreshold) { this.brightnessThreshold = newThreshold; }
}
