import { Client } from '../../api/client';
import { ProjectIdentifier, WorkspaceIdentifier } from '../../types';
import { type components } from './../../api/geti-openapi-schema';

// project-2 is GET project response?
type Project = components['schemas']['project-2'];

export async function disableAutoTraining(
    {
        client,
        workspaceIdentifier,
    }: {
        client: Client;
        workspaceIdentifier: WorkspaceIdentifier;
    },
    project: Project,
    enable = false
) {
    const projectIdentifier: ProjectIdentifier = {
        ...workspaceIdentifier,
        project_id: project.id!,
    };

    const createProjectResponse = await client[
        '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}/project_configuration'
    ].PATCH({
        params: { path: projectIdentifier },
        body: {
            // @ts-expect-error TODO figure out if we can resolve this
            task_configs: project.pipeline.tasks
                .filter((task) => {
                    return !['dataset', 'crop'].includes(task.task_type);
                })
                .map((task) => {
                    return {
                        task_id: task.id,
                        training: {},
                        auto_training: [{ key: 'enable', value: enable }],
                    };
                }),
        },
    });

    if (createProjectResponse.error) {
        throw createProjectResponse.error;
    }

    return createProjectResponse.data;
}
