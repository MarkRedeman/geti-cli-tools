import { createPathBasedClient } from 'openapi-fetch';
import { getEnv } from './environment';
import type { paths } from './geti-openapi-schema';

const { baseUrl, apiKey } = getEnv();

export const client = createPathBasedClient<paths>({
    baseUrl,
    headers: {
        'x-api-key': apiKey,
    },
});

export type Client = typeof client;
