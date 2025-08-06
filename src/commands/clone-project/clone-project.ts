#!/usr/bin/env bun
import { ProjectIdentifier } from '../../types';
import { client } from './../../api/client';
import { createProject } from './create-project';
import { disableAutoTraining } from './disable-auto-training';
import { getDataset } from './get-dataset';

const projectIdentifier: ProjectIdentifier = {
    organization_id: 'afb8497c-0ef2-4cf7-8fe0-ecce8e8a2ed6',
    workspace_id: '9386e827-f0bd-40c3-917a-8cc2fb876a77',
    project_id: '688b56199b676169969b4192',
};
const targetWorkspace = {
    organization_id: 'afb8497c-0ef2-4cf7-8fe0-ecce8e8a2ed6',
    workspace_id: '9386e827-f0bd-40c3-917a-8cc2fb876a77',
};

const projectResponse = await client[
    '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}'
].GET({
    params: { path: projectIdentifier },
});

if (projectResponse.error) {
    throw new Error('No project found');
}

const oldProject = projectResponse.data;

// 1. Create a new project with the same name and pipeline
const newProject = await createProject(client, targetWorkspace, oldProject);
console.log(oldProject, newProject);

// 2. Disable auto training
await disableAutoTraining(client, targetWorkspace, newProject, false);

// 3. Create all non-training datasets - possibly rename?
for await (const dataset of oldProject.datasets) {
    const newDataset = getDataset(client, targetWorkspace, newProject, dataset);

    console.log(newDataset);
}

console.log('Finished copying project');
//throw new Error('moi');

// 4. Delete the project (optional, for testing)
console.log('Deleting project...');
await new Promise((resolve) => setTimeout(resolve, 5_000));

const deleteProjectResponse = await client[
    '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}'
].DELETE({
    params: { path: { ...targetWorkspace, project_id: newProject.id! } },
});
console.log(deleteProjectResponse);
