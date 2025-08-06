import { Client } from '../../api/client';
import { ProjectIdentifier, WorkspaceIdentifier } from '../../types';
import { type components } from './../../api/geti-openapi-schema';

// project-2 is GET project response?
type Project = components['schemas']['project-2'];

// TODO: reimplement for 2.7

export async function disableAutoTraining(
    client: Client,
    targetWorkspace: WorkspaceIdentifier,
    project: Project,
    enable = false
) {
    const projectIdentifier: ProjectIdentifier = {
        ...targetWorkspace,
        project_id: project.id!,
    };

    const createProjectResponse = await client[
        '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}/project_configuration'
    ].PATCH({
        params: { path: projectIdentifier },
        body: {
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
