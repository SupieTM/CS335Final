export function compileShader(glContext, shaderSource, shaderType) {
    const shaderObject = glContext.createShader(shaderType);
    glContext.shaderSource(shaderObject, shaderSource);
    glContext.compileShader(shaderObject);

    const compilationSucceeded = glContext.getShaderParameter(shaderObject, glContext.COMPILE_STATUS);
    if (!compilationSucceeded) {
        const shaderTypeName = shaderType === glContext.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
        const compilationLog = glContext.getShaderInfoLog(shaderObject);
        glContext.deleteShader(shaderObject);
        throw new Error(`${shaderTypeName} shader compilation failed:\n${compilationLog}`);
    }

    return shaderObject;
}

export function createShaderProgram(glContext, vertexShaderSource, fragmentShaderSource) {
    const vertexShader = compileShader(glContext, vertexShaderSource, glContext.VERTEX_SHADER);
    const fragmentShader = compileShader(glContext, fragmentShaderSource, glContext.FRAGMENT_SHADER);

    const shaderProgram = glContext.createProgram();
    glContext.attachShader(shaderProgram, vertexShader);
    glContext.attachShader(shaderProgram, fragmentShader);
    glContext.linkProgram(shaderProgram);

    const linkingSucceeded = glContext.getProgramParameter(shaderProgram, glContext.LINK_STATUS);
    if (!linkingSucceeded) {
        const linkingLog = glContext.getProgramInfoLog(shaderProgram);
        glContext.deleteProgram(shaderProgram);
        throw new Error(`Shader program linking failed:\n${linkingLog}`);
    }

    glContext.deleteShader(vertexShader);
    glContext.deleteShader(fragmentShader);

    return shaderProgram;
}

export async function fetchShaderSource(shaderFilePath) {
    const response = await fetch(shaderFilePath);
    if (!response.ok) {
        throw new Error(`Failed to load shader: ${shaderFilePath} (${response.status})`);
    }
    return await response.text();
}
