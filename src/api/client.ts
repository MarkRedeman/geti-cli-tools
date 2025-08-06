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
// client['version'] = '2.12';

export type Client = typeof client;
