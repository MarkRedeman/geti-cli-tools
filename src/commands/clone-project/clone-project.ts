#!/usr/bin/env bun
import { getEnv } from '../../api/environment';
import { mediaPagesIterator } from '../../geti-iterators';
import { DatasetIdentifier, ProjectIdentifier } from '../../types';
import { client, getClient } from './../../api/client';
import { copyMediaItem, getAnnotationMapToNewProject } from './copy-media-item';
import { createProject } from './create-project';
import { disableAutoTraining } from './disable-auto-training';
import { getDataset } from './get-dataset';

const CONFIG = {
    DELETE_PROJECT: false,
};

const sourceProjectIdentifier: ProjectIdentifier = {
    organization_id: 'afb8497c-0ef2-4cf7-8fe0-ecce8e8a2ed6',
    workspace_id: '9386e827-f0bd-40c3-917a-8cc2fb876a77',
    //project_id: '688b56199b676169969b4192',
    //project_id: '688b57784a06657f2291db26',
    project_id: '689368c17ff33d02166fea7c',
};
const destinationWorkspaceIdentifier = {
    organization_id: 'afb8497c-0ef2-4cf7-8fe0-ecce8e8a2ed6',
    workspace_id: '9386e827-f0bd-40c3-917a-8cc2fb876a77',
};

const sourceClient = client;
const source = { client: sourceClient, projectIdentifier: sourceProjectIdentifier };

const destinationClient = getClient(getEnv('_DESTINATION'));
const destination = {
    client: destinationClient,
    workspaceIdentifier: destinationWorkspaceIdentifier,
};

const projectResponse = await client[
    '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}'
].GET({
    params: { path: sourceProjectIdentifier },
});

if (projectResponse.error) {
    throw new Error('No project found');
}

const oldProject = projectResponse.data;

// 1. Create a new project with the same name and pipeline
const newProject = await createProject(destination, oldProject);

// 2. Disable auto training
await disableAutoTraining(destination, newProject, false);

// 3. Create all non-training datasets - possibly rename?
for await (const dataset of oldProject.datasets) {
    const newDataset = await getDataset(destination, newProject, dataset);

    const sourceDatasetIdentifier: DatasetIdentifier = {
        ...sourceProjectIdentifier,
        dataset_id: dataset.id,
    };

    const destinationDatasetIdentifier = {
        organization_id: destinationWorkspaceIdentifier.organization_id,
        workspace_id: destinationWorkspaceIdentifier.workspace_id,
        project_id: newProject.id!,
        dataset_id: newDataset.id!,
    };

    const getNewLabel = getAnnotationMapToNewProject(oldProject, newProject);

    for await (const mediaItem of mediaPagesIterator(client, sourceDatasetIdentifier)) {
        await copyMediaItem(
            source.client,
            sourceDatasetIdentifier,
            destination.client,
            destinationDatasetIdentifier,
            mediaItem,
            getNewLabel
        );
    }
}

// Re-enable auto training
await disableAutoTraining(destination, newProject, true);

console.log('Finished copying project');

// Used for debugging
if (CONFIG.DELETE_PROJECT) {
    // 4. Delete the project (optional, for testing)
    console.log('Deleting project...');
    await new Promise((resolve) => setTimeout(resolve, 5_000));

    const deleteProjectResponse = await client[
        '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}'
    ].DELETE({
        params: { path: { ...destinationWorkspaceIdentifier, project_id: newProject.id! } },
    });
    console.log(deleteProjectResponse);
}
