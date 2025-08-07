export function getEnv() {
    const baseUrl = process.env['BASE_URL'];
    const apiKey = process.env['API_KEY'];

    if (baseUrl === undefined) {
        throw new Error('Could not find BASE_URL environment variable');
    }

    if (apiKey === undefined) {
        throw new Error('Could not find API_KEY environment variable');
    }

    return {
        baseUrl,
        apiKey,
    };
}
