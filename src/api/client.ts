import { createPathBasedClient } from 'openapi-fetch';
import { getEnv } from './environment';
import type { paths } from './geti-openapi-schema';

export function getClient<Paths extends {} = paths>({
    baseUrl,
    apiKey,
}: {
    baseUrl: string;
    apiKey: string;
}) {
    return createPathBasedClient<Paths>({ baseUrl, headers: { 'x-api-key': apiKey } });
}

export const client = getClient(getEnv());

export type Client = typeof client;
