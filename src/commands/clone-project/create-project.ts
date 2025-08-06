import { Client } from '../../api/client';
import { WorkspaceIdentifier } from '../../types';
import { type components } from './../../api/geti-openapi-schema';

// project-2 is GET project response?
export type Project = components['schemas']['project-2'];

export async function createProject(
    client: Client,
    targetWorkspace: WorkspaceIdentifier,
    project: Project
) {
    const createProjectResponse = await client[
        '/organizations/{organization_id}/workspaces/{workspace_id}/projects'
    ].POST({
        params: { path: targetWorkspace },
        body: {
            name: project.name!,
            pipeline: {
                connections: project.pipeline.connections.map((connection) => {
                    const tasks = project.pipeline.tasks;
                    const from = tasks.find(({ id }) => id === connection.from)?.title;
                    const to = tasks.find(({ id }) => id === connection.to)?.title;

                    if (from === undefined || to === undefined) {
                        throw new Error('Could not find task to connect to');
                    }

                    return { from, to };
                }),
                tasks: project.pipeline.tasks.map((task) => {
                    const taskType = task.task_type as
                        | 'dataset'
                        | 'classification'
                        | 'segmentation'
                        | 'detection'
                        | 'crop'
                        | 'instance_segmentation'
                        | 'keypoint_detection'
                        | 'anomaly'
                        | 'rotated_detection';

                    return {
                        task_type: taskType,
                        title: task.title,
                        labels: task.labels?.map((l) => {
                            const { id, is_anomalous, is_empty, ...label } = l;
                            return label;
                        }),
                    };
                }),
            },
        },
    });

    if (createProjectResponse.error) {
        throw createProjectResponse.error;
    }

    return createProjectResponse.data;
}
