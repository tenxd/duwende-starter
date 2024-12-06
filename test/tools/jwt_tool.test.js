import { describe, expect, test, beforeEach } from "bun:test";
import { Tool } from 'duwende';
import { JWTTool } from '../../tools/jwt_tool.js';

describe('JWTTool', () => {
    let jwtTool;
    const testSecretKey = 'test_secret_key';
    const testPayload = { userId: 1, role: 'admin' };

    beforeEach(() => {
        jwtTool = new JWTTool({ secretKey: testSecretKey });
    });

    test("should properly extend Tool class", () => {
        expect(JWTTool.prototype instanceof Tool).toBe(true);
    });

    describe('Initialization', () => {
        test('should initialize with custom secret key', () => {
            const customKey = 'custom_secret';
            const tool = new JWTTool({ secretKey: customKey });
            expect(tool.secretKey).toBe(customKey);
        });

        test('should use default secret key if not provided', () => {
            const tool = new JWTTool({});
            expect(tool.secretKey).toBe('default_secret_key');
        });
    });

    describe('Token Operations', () => {
        describe('sign', () => {
            test('should sign payload and return valid JWT', async () => {
                const result = await jwtTool.use({
                    action: 'sign',
                    payload: testPayload
                });

                expect(result.status).toBe(200);
                expect(typeof result.content).toBe('string');
                expect(result.content.split('.')).toHaveLength(3); // Header.Payload.Signature
            });

            test('should handle empty payload', async () => {
                const result = await jwtTool.use({
                    action: 'sign',
                    payload: {}
                });

                expect(result.status).toBe(200);
                expect(typeof result.content).toBe('string');
            });
        });

        describe('verify', () => {
            test('should verify token from Authorization header', async () => {
                // First sign a token
                const signResult = await jwtTool.use({
                    action: 'sign',
                    payload: testPayload
                });
                const token = signResult.content;

                // Then verify it using Authorization header
                const headers = new Map();
                headers.set('authorization', `Bearer ${token}`);

                const result = await jwtTool.use({
                    action: 'verify',
                    headers
                });

                expect(result.status).toBe(200);
                expect(result.content).toMatchObject(testPayload);
            });

            test('should verify token from cookies', async () => {
                // First sign a token
                const signResult = await jwtTool.use({
                    action: 'sign',
                    payload: testPayload
                });
                const token = signResult.content;

                const result = await jwtTool.use({
                    action: 'verify',
                    cookies: { 'jwt-token': token }
                });

                expect(result.status).toBe(200);
                expect(result.content).toMatchObject(testPayload);
            });

            test('should verify token from custom cookie name', async () => {
                // First sign a token
                const signResult = await jwtTool.use({
                    action: 'sign',
                    payload: testPayload
                });
                const token = signResult.content;

                const result = await jwtTool.use({
                    action: 'verify',
                    cookies: { 'custom-token': token },
                    cookieName: 'custom-token'
                });

                expect(result.status).toBe(200);
                expect(result.content).toMatchObject(testPayload);
            });

            test('should verify token from direct token parameter', async () => {
                // First sign a token
                const signResult = await jwtTool.use({
                    action: 'sign',
                    payload: testPayload
                });
                const token = signResult.content;

                const result = await jwtTool.use({
                    action: 'verify',
                    token
                });

                expect(result.status).toBe(200);
                expect(result.content).toMatchObject(testPayload);
            });

            test('should return 401 when no token is provided', async () => {
                const result = await jwtTool.use({
                    action: 'verify'
                });

                expect(result.status).toBe(401);
                expect(result.content).toBe('No JWT token found in Authorization header, cookies, or token parameter');
            });

            test('should return 401 for invalid token', async () => {
                const result = await jwtTool.use({
                    action: 'verify',
                    token: 'invalid.token.here'
                });

                expect(result.status).toBe(401);
                expect(result.content).toBe('Invalid token');
            });
        });

        describe('decode', () => {
            test('should decode valid token', async () => {
                // First sign a token
                const signResult = await jwtTool.use({
                    action: 'sign',
                    payload: testPayload
                });
                const token = signResult.content;

                const result = await jwtTool.use({
                    action: 'decode',
                    token
                });

                expect(result.status).toBe(200);
                expect(result.content.payload).toMatchObject(testPayload);
                expect(result.content.header).toBeDefined();
                expect(result.content.signature).toBeDefined();
            });

            test('should handle invalid token format', async () => {
                const result = await jwtTool.use({
                    action: 'decode',
                    token: 'invalid-token'
                });

                expect(result.status).toBe(200);
                expect(result.content).toBeNull();
            });
        });
    });

    describe('Error Handling', () => {
        test('should handle unsupported action', async () => {
            const result = await jwtTool.use({
                action: 'unsupported'
            });

            expect(result.status).toBe(400);
            expect(result.content).toContain('Unsupported action');
        });

        test('should handle missing required parameters', async () => {
            const result = await jwtTool.use({});

            expect(result.status).toBe(400);
            expect(result.content).toContain('Error');
        });
    });

    describe('Schema Validation', () => {
        test('should have valid init schema', () => {
            const schema = JWTTool.init_schema();
            expect(schema.secretKey).toBeDefined();
            expect(schema.secretKey.type).toBe('string');
            expect(schema.secretKey.required).toBe(false);
        });

        test('should have valid in schema', () => {
            const schema = JWTTool.in_schema();
            expect(schema.action).toBeDefined();
            expect(schema.action.type).toBe('string');
            expect(schema.action.required).toBe(true);
            expect(schema.action.enum).toEqual(['sign', 'verify', 'decode']);
            
            expect(schema.payload).toBeDefined();
            expect(schema.payload.type).toBe('object');
            expect(schema.payload.required).toBe(false);

            expect(schema.token).toBeDefined();
            expect(schema.token.type).toBe('string');
            expect(schema.token.required).toBe(false);

            expect(schema.cookies).toBeDefined();
            expect(schema.cookies.type).toBe('object');
            expect(schema.cookies.required).toBe(false);

            expect(schema.headers).toBeDefined();
            expect(schema.headers.type).toBe('object');
            expect(schema.headers.required).toBe(false);

            expect(schema.cookieName).toBeDefined();
            expect(schema.cookieName.type).toBe('string');
            expect(schema.cookieName.required).toBe(false);
        });

        test('should have valid out schema', () => {
            const schema = JWTTool.out_schema();
            expect(schema.type).toBe('object');
            expect(schema.properties.status).toBeDefined();
            expect(schema.properties.content).toBeDefined();
        });
    });

    describe('About Method', () => {
        test('should return a non-empty description', () => {
            expect(typeof JWTTool.about()).toBe('string');
            expect(JWTTool.about().length).toBeGreaterThan(0);
        });

        test('should include key features in description', () => {
            const description = JWTTool.about();
            expect(description).toContain('JWT');
            expect(description).toContain('token');
        });
    });
});
