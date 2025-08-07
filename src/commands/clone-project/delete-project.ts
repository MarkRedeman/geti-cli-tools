import { Client } from '../../api/client';
import { ProjectIdentifier } from '../../types';

export async function deleteProject(client: Client, projectIdentifier: ProjectIdentifier) {
    console.log('Deleting project...');
    await new Promise((resolve) => setTimeout(resolve, 5_000));

    const deleteProjectResponse = await client[
        '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}'
    ].DELETE({
        params: { path: projectIdentifier },
    });

    console.log(deleteProjectResponse);
}
