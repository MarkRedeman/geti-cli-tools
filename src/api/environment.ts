export function getEnv(suffix = '') {
    const BASE_URL_KEY = `BASE_URL${suffix}`;
    const API_KEY_KEY = `API_KEY${suffix}`;

    const baseUrl = process.env[BASE_URL_KEY];
    const apiKey = process.env[API_KEY_KEY];

    if (baseUrl === undefined) {
        throw new Error(`Could not find "${BASE_URL_KEY}" environment variable`);
    }

    if (apiKey === undefined) {
        throw new Error(`Could not find "${API_KEY_KEY}" environment variable`);
    }

    return {
        baseUrl,
        apiKey,
    };
}
