#!/usr/bin/env bun
import { client } from './../../api/client';
import { modelsIterator, projectsIterator } from './../../geti-iterators';
import { collect } from './../../iterators';
import { isBeingTrained } from './utils';

const projects = projectsIterator(client);

for await (const { project, workspaceId, organizationId } of projects) {
    const projectIdentifier = {
        organization_id: organizationId,
        workspace_id: workspaceId,
        project_id: project.id ?? '',
    };

    const algorithmsResponse = await client[
        '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}/supported_algorithms'
    ].GET({
        params: {
            path: projectIdentifier,
        },
    });

    if (algorithmsResponse.error) {
        throw new Error('404');
    }

    const supportedAlgorithms = algorithmsResponse.data.supported_algorithms ?? [];

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
                job_type: ['train'],
            },
        },
    });
    const jobs = jobsResposne.data?.jobs ?? [];

    const modelGroups = await collect(modelsIterator(client, projectIdentifier));

    for (const algorithm of supportedAlgorithms) {
        // We want to skip optimizing any models that have an optimization job in progress
        if (isBeingTrained(jobs, algorithm)) {
            console.log(`[${project.name}] Train ${algorithm.name} - training`);
            continue;
        }

        // Skip models that have been trained already
        if (
            modelGroups.some(
                ({ modelGroup }) => modelGroup.model_template_id === algorithm.model_manifest_id
            )
        ) {
            console.log(`[${project.name}] Train ${algorithm.name} - trained`);
            continue;
        }

        console.log(`[${project.name}] Started training ${algorithm.name}`);
        await client[
            '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}:train'
        ].POST({
            params: {
                path: projectIdentifier,
            },
            body: {
                model_template_id: algorithm.model_manifest_id,
            },
        });
    }
}

console.log('Finished starting training jobs for all models');
