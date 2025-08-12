#!/usr/bin/env bun
import * as fs from 'node:fs';
import { WorkspaceIdentifier } from '../types';
import { Client, client } from './../api/client';
import {
    Model,
    ModelGroup,
    modelsIterator,
    optimizedModelsIterator,
    projectsPagesIterator,
} from './../geti-iterators';
import { collect, filter, flatten, map, NextPage, pagesIterator } from './../iterators';

function convertToCSV(arr: any[]) {
    const array = [Object.keys(arr[0])].concat(arr);

    return array
        .map((it) => {
            return Object.values(it).toString();
        })
        .join('\n');
}

function logTable(object: Array<any>, filename: string) {
    console.table(object);
    fs.writeFileSync(filename, convertToCSV(object));
}

const organization = await client['/personal_access_tokens/organization'].GET();
const organization_id = organization.data?.organizationId ?? '';
const workspaces = await client['/organizations/{organization_id}/workspaces'].GET({
    params: { path: { organization_id } },
});

function jobsPagesIterator(
    client: Client,
    workspaceIdentifier: WorkspaceIdentifier,
    job_type: Array<'optimize_pot' | 'test' | 'train'> = []
) {
    const projects = flatten(
        pagesIterator(async (currentPage: NextPage) => {
            const { data } = await client[
                '/organizations/{organization_id}/workspaces/{workspace_id}/jobs'
            ].GET({
                params: {
                    path: workspaceIdentifier,
                    query: {
                        skip: currentPage === null ? undefined : currentPage,
                        job_type,
                    },
                },
            });

            if (data?.jobs) {
                const skip = data.next_page
                    ? (new URLSearchParams(data.next_page).get('skip') ?? '0')
                    : undefined;
                return { data: data.jobs, nextPage: skip };
            }

            return {
                data: [],
                nextPage: undefined,
            };
        })
    );

    return projects;
}

async function reportModelScores(workspaceIdentifier: WorkspaceIdentifier) {
    const projects = filter(projectsPagesIterator(client, workspaceIdentifier), () => true);

    const projectOptimizedModels = await collect(
        map(projects, async (project) => {
            const projectIdentifier = {
                organization_id,
                workspace_id: workspaceIdentifier.workspace_id,
                project_id: project.id ?? '',
            };
            const models = await collect(optimizedModelsIterator(client, projectIdentifier));

            return { project, models };
        })
    );

    logTable(
        projectOptimizedModels.flatMap(({ project, models }) => {
            return models.map(({ modelGroup, model, optimizedModel }) => {
                return {
                    project: project.name,
                    model_template_id: modelGroup.model_template_id,
                    model: optimizedModel.name,
                    verison: model.version,
                    score: optimizedModel?.performance?.score?.toFixed(3),
                    size: optimizedModel.size,
                };
            });
        }),
        './model-scores.csv'
    );
}

for (const workspace of workspaces.data?.workspaces ?? []) {
    const workspace_id = workspace.id;
    const workspaceIdentifier = { organization_id, workspace_id };

    console.log('Model scores report');
    await reportModelScores(workspaceIdentifier);

    const projects = filter(
        projectsPagesIterator(client, workspaceIdentifier),
        () => true // projectsIds.includes(project.id)
    );

    // Preload all projects and their models so that we can report their score
    const projectModels = await collect(
        map(projects, async (project) => {
            const projectIdentifier = {
                organization_id,
                workspace_id,
                project_id: project.id ?? '',
            };
            const models = await collect(modelsIterator(client, projectIdentifier));

            return { project, models };
        })
    );

    const modelsByProject = new Map<string, Array<{ model: Model; modelGroup: ModelGroup }>>();
    projectModels.forEach(({ project, models }) => {
        modelsByProject.set(project.id, models);
    });

    // TODO: preload all tests, attach test score, show dataset name, show optimized model name
    const testingJobs = filter(
        jobsPagesIterator(client, workspaceIdentifier, ['test']),
        () => true // projectsIds.includes(job.metadata?.project?.id ?? '')
    );
    console.log('Test jobs report');
    logTable(
        await collect(
            map(testingJobs, async (job) => {
                if (job.type !== 'test') {
                    throw new Error('Only testing jobs expected');
                }

                const runDuration =
                    (new Date(job?.end_time ?? '').getTime() -
                        new Date(job?.start_time ?? '').getTime()) /
                    1000;

                const stepPercentage = (time: number | null | undefined) => {
                    return ((100 * (time ?? 0)) / runDuration).toFixed(1);
                };
                const stepTime = (time: number | null | undefined) => {
                    return (time ?? 0).toFixed(3);
                };

                return {
                    job: job.name,
                    project: job.metadata?.project?.name,
                    architecture: job.metadata?.test?.model_architecture,
                    optimization_type: job.metadata?.test?.model?.optimization_type,
                    precision: job.metadata?.test?.model?.precision?.at(0),
                    has_xai_head: job.metadata?.test?.model?.has_xai_head,
                    'step 1 (s)': stepTime(job?.steps?.at(0)?.duration),
                    'duration (s)': runDuration,
                    'idle (%)': stepPercentage(runDuration - Number(job?.steps?.at(0)?.duration)),
                    'total duration (s)':
                        (new Date(job?.end_time ?? '').getTime() -
                            new Date(job?.creation_time ?? '').getTime()) /
                        1000,
                };
            })
        ),
        './test-jobs.csv'
    );

    const optimizationJobs = filter(
        jobsPagesIterator(client, workspaceIdentifier, ['optimize_pot']),
        (job) => true // projectsIds.includes(job.metadata?.project?.id ?? '')
    );
    console.log('Optimization jobs report');
    logTable(
        await collect(
            map(optimizationJobs, async (job) => {
                if (job.type !== 'optimize_pot') {
                    throw new Error('Only optimize jobs expected');
                }
                // if (!projectsIds.includes(job.metadata?.project?.id ?? '')) {
                //     return undefined;
                // }

                const project = job.metadata?.project;
                const models = modelsByProject.get(project?.id ?? '') ?? [];

                const model = models.find(({ model }) => {
                    return job.metadata?.base_model_id === model.id;
                });

                const runDuration =
                    (new Date(job?.end_time ?? '').getTime() -
                        new Date(job?.start_time ?? '').getTime()) /
                    1000;

                const stepPercentage = (time: number | null | undefined) => {
                    return ((100 * (time ?? 0)) / runDuration).toFixed(1);
                };
                const stepTime = (time: number | null | undefined) => {
                    return (time ?? 0).toFixed(3);
                };

                return {
                    job: job.name,
                    project: job.metadata?.project?.name,
                    model: job.metadata?.task?.model_architecture,
                    model_template_id: job.metadata?.task?.model_template_id,
                    verison: model?.model.version,
                    'step 1 (s)': stepTime(job?.steps?.at(0)?.duration),
                    'step 2 (s)': stepTime(job?.steps?.at(1)?.duration),
                    'step 3 (s)': stepTime(job?.steps?.at(2)?.duration),
                    'duration (s)': runDuration,
                    'idle (%)': stepPercentage(
                        runDuration -
                            Number(job?.steps?.at(0)?.duration) -
                            Number(job?.steps?.at(1)?.duration) -
                            Number(job?.steps?.at(2)?.duration)
                    ),
                    'total duration (s)':
                        (new Date(job?.end_time ?? '').getTime() -
                            new Date(job?.creation_time ?? '').getTime()) /
                        1000,
                };
            })
        ),
        './optimization-jobs.csv'
    );

    console.log('Train jobs report');
    const trainingJobs = filter(
        jobsPagesIterator(client, workspaceIdentifier, ['train']),
        (job) => true // projectsIds.includes(job.metadata?.project?.id ?? '')
    );
    logTable(
        await collect(
            map(trainingJobs, async (job) => {
                if (job.type !== 'train') {
                    throw new Error('Only training jobs expected');
                }
                // if (!projectsIds.includes(job.metadata?.project?.id ?? '')) {
                //     return undefined;
                // }

                const project = job.metadata?.project;
                const models = modelsByProject.get(project?.id ?? '') ?? [];

                const model = models.find(({ model }) => {
                    return job.metadata?.trained_model?.model_id === model.id;
                });

                const runDuration =
                    (new Date(job?.end_time ?? '').getTime() -
                        new Date(job?.start_time ?? '').getTime()) /
                    1000;

                const stepPercentage = (time: number | null | undefined) => {
                    return ((100 * (time ?? 0)) / runDuration).toFixed(1);
                };
                const stepTime = (time: number | null | undefined) => {
                    return (time ?? 0).toFixed(3);
                };

                return {
                    job: job.name,
                    project: job.metadata?.project?.name,
                    task: job.metadata?.task?.name,
                    model: job.metadata?.task?.model_architecture,
                    model_template_id: job.metadata?.task?.model_template_id,
                    verison: model?.model.version,
                    score: model?.model.performance?.score?.toFixed(3),
                    'step 1 (s)': stepTime(job?.steps?.at(0)?.duration),
                    'step 2 (s)': stepTime(job?.steps?.at(1)?.duration),
                    'step 3 (s)': stepTime(job?.steps?.at(2)?.duration),
                    // 'step 1 (%)': stepPercentage(job?.steps?.at(0)?.duration),
                    // 'step 2 (%)': stepPercentage(job?.steps?.at(1)?.duration),
                    // 'step 3 (%)': stepPercentage(job?.steps?.at(2)?.duration),
                    'duration (s)': runDuration,
                    'idle (%)': stepPercentage(
                        runDuration -
                            Number(job?.steps?.at(0)?.duration) -
                            Number(job?.steps?.at(1)?.duration) -
                            Number(job?.steps?.at(2)?.duration)
                    ),
                    'total duration (s)':
                        (new Date(job?.end_time ?? '').getTime() -
                            new Date(job?.creation_time ?? '').getTime()) /
                        1000,
                };
            })
        ),
        './training-jobs.csv'
    );

    console.log('Finished generating report');
}
