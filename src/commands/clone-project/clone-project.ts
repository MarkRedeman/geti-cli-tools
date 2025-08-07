#!/usr/bin/env bun
import { getEnv } from '../../api/environment';
import { mediaPagesIterator } from '../../geti-iterators';
import { chunk } from '../../iterators';
import { DatasetIdentifier, ProjectIdentifier } from '../../types';
import { getClient } from './../../api/client';
import { copyMediaItem, getAnnotationMapToNewProject } from './copy-media-item';
import { createProject } from './create-project';
import { disableAutoTraining } from './disable-auto-training';
import { getDataset } from './get-dataset';

const CONFIG = {
    DELETE_PROJECT: false,
    UPLOAD_IN_CHUNKCS: 2,
};

const sourceClient = getClient(getEnv('_SOURCE'));
const destinationClient = getClient(getEnv('_DESTINATION'));

const sourceProjectIdentifier: ProjectIdentifier = {
    organization_id: process.env['SOURCE_ORGANIZATION_ID']!,
    workspace_id: process.env['SOURCE_WORKSPACE_ID']!,
    project_id: process.env['SOURCE_PROJECT_ID']!,
};
const destinationWorkspaceIdentifier = {
    organization_id: process.env['DESTINATION_ORGANIZATION_ID']!,
    workspace_id: process.env['DESTINATION_WORKSPACE_ID']!,
};

const source = { client: sourceClient, projectIdentifier: sourceProjectIdentifier };

const destination = {
    client: destinationClient,
    workspaceIdentifier: destinationWorkspaceIdentifier,
};

const projectResponse = await sourceClient[
    '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}'
].GET({
    params: { path: sourceProjectIdentifier },
});

if (projectResponse.error) {
    throw new Error('No project found');
}

const oldProject = projectResponse.data;
console.log('Cloning project', oldProject.name);

// 1. Create a new project with the same name and pipeline
const newProject = await createProject(destination, oldProject);
console.log('Created project');

// 2. Disable auto training
await disableAutoTraining(destination, newProject, false);

// 3. Clone datasets
for await (const dataset of oldProject.datasets) {
    // Create or update dataset
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

    const mediaChunks = chunk(
        mediaPagesIterator(sourceClient, sourceDatasetIdentifier),
        CONFIG.UPLOAD_IN_CHUNKCS
    );

    // Clone media items
    for await (const mediaChunk of mediaChunks) {
        await Promise.all(
            mediaChunk.map(async (mediaItem) => {
                console.log(
                    mediaItem.name,
                    mediaItem.type === 'video' ? mediaItem.media_information?.frame_count : 0
                );

                await copyMediaItem(
                    source.client,
                    sourceDatasetIdentifier,
                    destination.client,
                    destinationDatasetIdentifier,
                    mediaItem,
                    getNewLabel
                );
            })
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

    const deleteProjectResponse = await destinationClient[
        '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}'
    ].DELETE({
        params: { path: { ...destinationWorkspaceIdentifier, project_id: newProject.id! } },
    });
    console.log(deleteProjectResponse);
}
