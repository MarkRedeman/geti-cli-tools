import { createPathBasedClient } from 'openapi-fetch';
import { getEnv } from './environment';
import type { paths } from './geti-openapi-schema';

export function getClient<Paths extends {} = paths>(baseUrl: string, apiKey: string) {
    return createPathBasedClient<Paths>({ baseUrl, headers: { 'x-api-key': apiKey } });
}

const { baseUrl, apiKey } = getEnv();

export const client = getClient(baseUrl, apiKey); // client['version'] = '2.12';

export type Client = typeof client;
