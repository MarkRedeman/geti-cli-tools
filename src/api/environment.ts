export function getEnv() {
    const baseUrl = process.env['BASE_URL'];
    const apiKey = process.env['API_KEY'];

    return {
        baseUrl,
        apiKey,
    };
}
