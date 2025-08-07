import { Client } from '../../api/client';
import { WorkspaceIdentifier } from '../../types';
import { type components } from './../../api/geti-openapi-schema';

type Project = components['schemas']['project-2'];

export async function getDataset(
    {
        client,
        workspaceIdentifier,
    }: {
        client: Client;
        workspaceIdentifier: WorkspaceIdentifier;
    },
    newProject: Project,
    dataset: Project['datasets'][number]
) {
    if (dataset.use_for_training) {
        const newTrainingSet = newProject.datasets.find((dataset) => dataset.use_for_training);

        if (newTrainingSet === undefined) {
            throw new Error('Could not find dataset');
        }

        if (newTrainingSet?.name !== dataset.name) {
            await client[
                '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}/datasets/{dataset_id}'
            ].PUT({
                params: {
                    path: {
                        ...workspaceIdentifier,
                        project_id: newProject.id!,
                        dataset_id: newTrainingSet.id,
                    },
                },
                body: { name: dataset.name },
            });
        }

        return newTrainingSet;
    }

    const newDataset = await client[
        '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}/datasets'
    ].POST({
        params: {
            path: { ...workspaceIdentifier, project_id: newProject.id! },
        },
        body: { name: dataset.name },
    });

    if (newDataset.error) {
        throw newDataset.error;
    }

    return newDataset.data;
}
