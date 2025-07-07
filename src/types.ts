export type OrganizationIdentifier = { organization_id: string };
export type WorkspaceIdentifier = OrganizationIdentifier & { workspace_id: string };

// Project specific
export type ProjectIdentifier = WorkspaceIdentifier & { project_id: string };
export type DatasetIdentifier = ProjectIdentifier & { dataset_id: string };

// Models
export type ModelIdentifier = ProjectIdentifier & {
    model_group_id: string;
    model_id: string;
};
export type OptimizedModelIdentifier = ModelIdentifier & {
    optimized_model_id: string;
};

// Tests
export type TestIdentifier = ProjectIdentifier & { test_id: string };
