import { Client } from './api/client';
import { type components } from './api/geti-openapi-schema';
import { filter, flatten, NextPage, pagesIterator } from './iterators';
import { DatasetIdentifier, ProjectIdentifier, WorkspaceIdentifier } from './types';

export type ModelGroup = components['schemas']['model_group'];
export type Model = components['schemas']['model'];

export async function* modelsIterator(client: Client, projectIdentifier: ProjectIdentifier) {
    const modelGroups = await client[
        '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}/model_groups'
    ].GET({ params: { path: projectIdentifier } });
    for (const modelGroup of modelGroups.data?.model_groups ?? []) {
        for (const model of modelGroup.models ?? []) {
            yield { modelGroup, model };
        }
    }
}

export async function* optimizedModelsIterator(
    client: Client,
    projectIdentifier: ProjectIdentifier
) {
    for await (const { modelGroup, model } of modelsIterator(client, projectIdentifier)) {
        if (modelGroup.id === undefined || model.id === undefined) {
            continue;
        }
        const modelIdentifier = {
            ...projectIdentifier,
            model_group_id: modelGroup.id,
            model_id: model.id,
        };

        const modelDetails = await client[
            '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}/model_groups/{model_group_id}/models/{model_id}'
        ].GET({ params: { path: modelIdentifier } });

        for (const optimizedModel of modelDetails.data?.optimized_models ?? []) {
            yield {
                modelGroup,
                model,
                optimizedModel,
            };
        }
    }
}

type ArrayElement<ArrayType extends readonly unknown[]> =
    ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export type Projects = components['schemas']['project_list']['projects'];
export type ProjectFromList = ArrayElement<Exclude<Projects, undefined>>;

const projectsPagesIterator = (client: Client, workspaceIdentifier: WorkspaceIdentifier) => {
    const projects = flatten(
        pagesIterator(async (currentPage: NextPage) => {
            const { data } = await client[
                '/organizations/{organization_id}/workspaces/{workspace_id}/projects'
            ].GET({
                params: {
                    path: workspaceIdentifier,
                    query: {
                        sort_by: 'creation_date',
                        sort_direction: 'dsc',
                        skip: currentPage === null ? undefined : currentPage,
                    },
                },
            });

            if (data?.projects) {
                const skip = data.next_page
                    ? (new URLSearchParams(data.next_page).get('skip') ?? '0')
                    : undefined;
                return { data: data.projects, nextPage: skip };
            }

            return {
                data: [],
                nextPage: undefined,
            };
        })
    );

    return projects;
};
type ProjectFilter = (project: ProjectFromList) => boolean;

export async function* projectsIterator(
    client: Client,
    options?: {
        filter: ProjectFilter;
    }
) {
    const organizationResponse = await client['/personal_access_tokens/organization'].GET();
    const organization = organizationResponse.data;
    const organization_id = organization?.organizationId ?? '';
    const workspacesResponse = await client['/organizations/{organization_id}/workspaces'].GET({
        params: { path: { organization_id } },
    });

    if (workspacesResponse.error) {
        throw new Error('No workspaces found');
    }

    const workspaces = workspacesResponse.data?.workspaces;

    for await (const workspace of workspaces) {
        const workspace_id = workspace.id;
        const workspaceIdentifier = { organization_id, workspace_id };
        const workspaceProjects = projectsPagesIterator(client, workspaceIdentifier);

        const projectFilter = options?.filter ?? (() => true);

        for await (const project of filter(workspaceProjects, projectFilter)) {
            yield {
                project,
                workspaceId: workspace.id,
                organizationId: organization_id,
            };
        }
    }
}

export function mediaPagesIterator(client: Client, datasetIdentifier: DatasetIdentifier) {
    const mediaPages = pagesIterator(async (currentPage: NextPage) => {
        const { data } = await client[
            '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}/datasets/{dataset_id}/media:query'
        ].POST({
            params: {
                path: datasetIdentifier,
                query: {
                    sort_by: 'media_upload_date',
                    sort_direction: 'asc',
                    skip: currentPage === null ? undefined : currentPage,
                },
            },
            // @ts-expect-error we don't want to pass any filters
            body: {},
        });

        if (data?.media) {
            const skip = data.next_page
                ? (new URLSearchParams(data.next_page).get('skip') ?? '0')
                : undefined;

            return { data: data.media, nextPage: skip };
        }

        return {
            data: [],
            nextPage: undefined,
        };
    });

    return flatten(mediaPages);
}
