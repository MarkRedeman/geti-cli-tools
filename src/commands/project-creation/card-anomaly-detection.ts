#!/usr/bin/env bun
import { projectsIterator } from '../../geti-iterators';
import { client } from './../../api/client';
import { optimizedModelsIterator } from './../../geti-iterators';

async function getWorkspaceIdentifier() {
    const organizationResponse = await client['/personal_access_tokens/organization'].GET();
    const organization = organizationResponse.data;
    const organization_id = organization?.organizationId ?? '';
    const workspacesResponse = await client['/organizations/{organization_id}/workspaces'].GET({
        params: { path: { organization_id } },
    });

    const workspace_id = workspacesResponse.data.workspaces.at(0)?.id;

    if (workspacesResponse.error || workspace_id === undefined) {
        throw new Error('No workspaces found');
    }

    return { organization_id, workspace_id };
}

const { organization_id, workspace_id } = await getWorkspaceIdentifier();

const project = await client[
    '/organizations/{organization_id}/workspaces/{workspace_id}/projects'
].POST({
    params: {
        path: {
            organization_id,
            workspace_id,
        },
    },
    body: {
        name: `Card Anomaly Detection`,
        pipeline: {
            connections: [
                {
                    from: 'Dataset',
                    to: 'Anomaly classification',
                },
            ],
            tasks: [
                {
                    title: 'Dataset',
                    task_type: 'dataset',
                },
                {
                    title: 'Anomaly classification',
                    task_type: 'anomaly',
                    labels: [],
                },
            ],
        },
    },
});

async function getCardsDataset() {
    return {
        media: [],
    };
}
const dataset = await getCardsDataset();

console.log('Finished creating project');
