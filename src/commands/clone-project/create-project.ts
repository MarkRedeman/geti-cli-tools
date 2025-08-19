import { Client } from '../../api/client';
import { WorkspaceIdentifier } from '../../types';
import { type components, type operations } from './../../api/geti-openapi-schema';

const EMPTY_CLASSES = ['Empty', 'No object', 'No class'];

// project-2 is GET project response?
type Project = components['schemas']['project-2'];

type Task =
    operations['CreateProject']['requestBody']['content']['application/json']['pipeline']['tasks'][number];

type ExistingTask = Project['pipeline']['tasks'][number];

function getKeypointStructure(task: ExistingTask) {
    const taskType = task.task_type as Task['task_type'];

    if (taskType !== 'keypoint_detection') {
        return undefined;
    }

    const idToName = (labelId: string) => {
        return task.labels?.find(({ id }) => id === labelId)?.name!;
    };

    return {
        edges: task.keypoint_structure?.edges?.map((edge) => {
            return { nodes: edge.nodes.map(idToName) };
        }),
        positions: task.keypoint_structure?.positions?.map((position) => {
            return {
                ...position,
                label: idToName(position.label),
            };
        }),
    };
}

export async function createProject(
    {
        client,
        workspaceIdentifier,
    }: {
        client: Client;
        workspaceIdentifier: WorkspaceIdentifier;
    },
    project: Project
) {
    const createProjectResponse = await client[
        '/organizations/{organization_id}/workspaces/{workspace_id}/projects'
    ].POST({
        params: { path: workspaceIdentifier },
        body: {
            name: `${project.name}`,
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
                tasks: project.pipeline.tasks.map((task): Task => {
                    const taskType = task.task_type as Task['task_type'];
                    const keypoint_structure = getKeypointStructure(task);

                    return {
                        task_type: taskType,
                        title: task.title,
                        keypoint_structure,
                        labels: task.labels
                            ?.map((l) => {
                                const { id, is_anomalous, is_empty, ...label } = l;

                                const parentLabelId =
                                    l.parent_id !== null
                                        ? task.labels?.find(({ id }) => id === l.parent_id)?.name
                                        : null;
                                return {
                                    ...label,
                                    parent_id: parentLabelId,
                                };
                            })
                            // Empty label is auto created
                            // NOTE: if a project renamed their empty label then
                            // cloning may not fully work as we won't be able to
                            // map the empty labels
                            .filter((label) => EMPTY_CLASSES.includes(label.group) === false)
                            .filter(() => task.task_type !== 'anomaly'),
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
