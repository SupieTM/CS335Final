export class TestRunner {
    constructor(suiteName) {
        this.suiteName = suiteName;
        this.testCases = [];
        this.passedCount = 0;
        this.failedCount = 0;
        this.failureDetails = [];
    }

    test(testDescription, testFunction) {
        this.testCases.push({ testDescription, testFunction });
    }

    async runAll() {
        console.log(`\n==========================================`);
        console.log(`  ${this.suiteName}`);
        console.log(`==========================================`);

        for (const testCase of this.testCases) {
            try {
                await testCase.testFunction();
                this.passedCount++;
                console.log(`   ${testCase.testDescription}`);
            } catch (assertionError) {
                this.failedCount++;
                const failureMessage = `  [FAIL] ${testCase.testDescription}\n     -> ${assertionError.message}`;
                console.error(failureMessage);
                this.failureDetails.push({
                    testDescription: testCase.testDescription,
                    errorMessage: assertionError.message,
                });
            }
        }

        console.log(`\n  Results: ${this.passedCount} passed, ${this.failedCount} failed`);
        console.log(`------------------------------------------\n`);

        return {
            suiteName: this.suiteName,
            totalCount: this.testCases.length,
            passedCount: this.passedCount,
            failedCount: this.failedCount,
            failureDetails: this.failureDetails,
        };
    }
}

// -- Assertion helpers -----------------------------------------------

export function assertEqual(actualValue, expectedValue, messageLabel = '') {
    if (actualValue !== expectedValue) {
        throw new Error(
            `${messageLabel} expected ${expectedValue}, got ${actualValue}`
        );
    }
}

export function assertAlmostEqual(actualValue, expectedValue, toleranceEpsilon = 1e-5, messageLabel = '') {
    if (Math.abs(actualValue - expectedValue) > toleranceEpsilon) {
        throw new Error(
            `${messageLabel} expected ~${expectedValue}, got ${actualValue} (tol=${toleranceEpsilon})`
        );
    }
}

export function assertVec3AlmostEqual(actualVec, expectedVec, toleranceEpsilon = 1e-5, messageLabel = '') {
    for (let componentIndex = 0; componentIndex < 3; componentIndex++) {
        if (Math.abs(actualVec[componentIndex] - expectedVec[componentIndex]) > toleranceEpsilon) {
            const actualStr = `[${actualVec[0].toFixed(6)}, ${actualVec[1].toFixed(6)}, ${actualVec[2].toFixed(6)}]`;
            const expectedStr = `[${expectedVec[0].toFixed(6)}, ${expectedVec[1].toFixed(6)}, ${expectedVec[2].toFixed(6)}]`;
            throw new Error(
                `${messageLabel} component ${componentIndex}: expected ${expectedStr}, got ${actualStr}`
            );
        }
    }
}

export function assertTrue(conditionValue, messageLabel = '') {
    if (!conditionValue) {
        throw new Error(`${messageLabel} expected true, got false`);
    }
}

export function assertFalse(conditionValue, messageLabel = '') {
    if (conditionValue) {
        throw new Error(`${messageLabel} expected false, got true`);
    }
}

export function assertGreaterThan(actualValue, thresholdValue, messageLabel = '') {
    if (actualValue <= thresholdValue) {
        throw new Error(
            `${messageLabel} expected > ${thresholdValue}, got ${actualValue}`
        );
    }
}

export function assertLessThan(actualValue, thresholdValue, messageLabel = '') {
    if (actualValue >= thresholdValue) {
        throw new Error(
            `${messageLabel} expected < ${thresholdValue}, got ${actualValue}`
        );
    }
}
