#!/usr/bin/env bun
import { ModelIdentifier } from '../../types';
import { client } from './../../api/client';
import { modelsIterator, projectsIterator } from './../../geti-iterators';
import { isBeingOptimized } from './utils';

const projects = projectsIterator(client);

for await (const { project, workspaceId, organizationId } of projects) {
    const projectIdentifier = {
        organization_id: organizationId,
        workspace_id: workspaceId,
        project_id: project.id ?? '',
    };

    const jobsResposne = await client[
        '/organizations/{organization_id}/workspaces/{workspace_id}/jobs'
    ].GET({
        params: {
            path: {
                organization_id: organizationId,
                workspace_id: workspaceId,
            },
            query: {
                project_id: projectIdentifier.project_id,
                job_type: ['optimize_pot'],
            },
        },
    });
    const jobs = jobsResposne.data?.jobs ?? [];

    const models = modelsIterator(client, projectIdentifier);
    for await (const { modelGroup, model } of models) {
        if (modelGroup.id === undefined || model.id === undefined) {
            continue;
        }

        const modelIdentifier: ModelIdentifier = {
            ...projectIdentifier,
            model_group_id: modelGroup.id,
            model_id: model.id,
        };

        // We want to skip optimizing any models that have an optimization job in progress
        if (isBeingOptimized(jobs, modelIdentifier)) {
            console.log(`[${project.name}] Skip ${model.name} - in progress`);
            continue;
        }

        console.log(`[${project.name}] Started optimizing ${model.name}`);
        continue;

        const optimizationResponse = await client[
            '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}/model_groups/{model_group_id}/models/{model_id}:optimize'
        ].POST({
            params: { path: modelIdentifier },
        });

        console.log(
            `[${project.name}] Started optimizing ${model.name} - ${optimizationResponse.response.status}`
        );
    }
}

console.log('Finished starting optimization jobs for all models');
