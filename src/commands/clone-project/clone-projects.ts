#!/usr/bin/env bun
import { getEnv } from '../../api/environment';
import { mediaPagesIterator, projectsIterator } from '../../geti-iterators';
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

const destinationWorkspaceIdentifier = {
    organization_id: process.env['DESTINATION_ORGANIZATION_ID']!,
    workspace_id: process.env['DESTINATION_WORKSPACE_ID']!,
};

const destination = {
    client: destinationClient,
    workspaceIdentifier: destinationWorkspaceIdentifier,
};

const projects = projectsIterator(sourceClient);

for await (const {
    project: { id: projectId },
    workspaceId,
    organizationId,
} of projects) {
    const projectIdentifier: ProjectIdentifier = {
        organization_id: organizationId,
        workspace_id: workspaceId,
        project_id: projectId ?? '',
    };

    const source = { client: sourceClient, projectIdentifier };

    const projectResponse = await sourceClient[
        '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}'
    ].GET({
        params: { path: projectIdentifier },
    });

    if (projectResponse.error) {
        throw new Error('No project found');
    }

    const oldProject = projectResponse.data;
    console.log('Cloning project', oldProject.name);

    // 1. Create a new project with the same name and pipeline
    const newProject = await createProject(destination, oldProject);
    console.log('Created project');

    // Wait a little so that the server has time to create a project configuration
    await new Promise((resolve) => setTimeout(resolve, 2_000));

    // 2. Disable auto training
    await disableAutoTraining(destination, newProject, false);

    // 3. Clone datasets
    for await (const dataset of oldProject.datasets) {
        // Create or update dataset
        const newDataset = await getDataset(destination, newProject, dataset);

        const sourceDatasetIdentifier: DatasetIdentifier = {
            ...projectIdentifier,
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

                    try {
                        await copyMediaItem(
                            source.client,
                            sourceDatasetIdentifier,
                            destination.client,
                            destinationDatasetIdentifier,
                            mediaItem,
                            getNewLabel
                        );
                    } catch (error) {
                        console.error(
                            'Ignoring copy media item error',
                            error,
                            mediaItem.type,
                            mediaItem.id
                        );
                    }
                })
            );
        }
    }

    // Re-enable auto training
    await disableAutoTraining(destination, newProject, true);

    console.log('Finished copying project');
}
