#!/usr/bin/env bun
import { projectsIterator } from '../../geti-iterators';
import { client } from './../../api/client';
import { optimizedModelsIterator } from './../../geti-iterators';
import { isBeingTested } from './utils';

const projects = projectsIterator(client);

for await (const {
    project: { id: projectId },
    workspaceId,
    organizationId,
} of projects) {
    const projectIdentifier = {
        organization_id: organizationId,
        workspace_id: workspaceId,
        project_id: projectId ?? '',
    };

    // Get project information so we know which datasets to run tests on
    const projectResponse = await client[
        '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}'
    ].GET({
        params: {
            path: projectIdentifier,
        },
    });

    if (projectResponse.error) {
        console.error(`Could not load project [${projectIdentifier.project_id}]`);
        continue;
    }

    const project = projectResponse.data;

    const jobsResposne = await client[
        '/organizations/{organization_id}/workspaces/{workspace_id}/jobs'
    ].GET({
        params: {
            path: {
                organization_id: projectIdentifier.organization_id,
                workspace_id: projectIdentifier.workspace_id,
            },
            query: {
                project_id: projectIdentifier.project_id,
                job_type: ['test'],
            },
        },
    });
    const jobs = jobsResposne.data?.jobs ?? [];

    const testsResposne = await client[
        '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}/tests'
    ].GET({
        params: { path: projectIdentifier },
    });
    const tests = testsResposne.data?.test_results ?? [];

    const optimizedModels = optimizedModelsIterator(client, projectIdentifier);
    for await (const { modelGroup, model, optimizedModel } of optimizedModels) {
        if (
            modelGroup.id === undefined ||
            model.id === undefined ||
            optimizedModel.id === undefined
        ) {
            continue;
        }

        for (const dataset of project?.datasets) {
            if (isBeingTested(jobs, dataset, { id: model.id })) {
                console.log(`[${project.name}] Skip - in progress`);
                continue;
            }

            if (
                tests.some((modelTest) => {
                    return (
                        modelTest.datasets_info.some(({ id }) => id === dataset.id) &&
                        modelTest.model_info.id === model.id
                    );
                })
            ) {
                console.log(`[${project.name}] Skip - already tested`);
                continue;
            }

            await client[
                '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}/tests'
            ].POST({
                params: {
                    path: projectIdentifier,
                },
                body: {
                    dataset_ids: [dataset.id],
                    model_group_id: modelGroup.id,
                    model_id: optimizedModel.id,
                    name: `${dataset.name} - ${optimizedModel.name}`,
                },
            });
        }
    }
}

console.log('Finished starting testing jobs for all models');
