# Geti CLI tools

A collection of cli commands to test and manage Geti projects.

- Download project
- Download project models
- Bulk train models
- Bulk optimize models
- Bulk test models
- Copy project to other Geti platform
- Generate report

> [!NOTE]
> These tools use Geti's REST API and is based on Geti's OpenAPI Spec. You can find the spec (and its version) that these tools are based on [here](./src/api/geti-openapi-schema.json).
> Geti does not often introduce backwards compatibility breaks, hence most of these tools should be compatible with older versions of Geti, but I can't make any guarantees: your mileage might vary.

## E2E Test steps

> [!NOTE]
> Before running the commands make sure to add a `.env` based on the [`.env.example`](./env.example)

1. Create projects by importing datasets
2. Train all models in all projects
```bash
http_proxy="" https_proxy=""  NODE_TLS_REJECT_UNAUTHORIZED=0 bun ./src/commands/models/train-models.ts
```

3. Retrain all models in all projects
```bash
http_proxy="" https_proxy=""  NODE_TLS_REJECT_UNAUTHORIZED=0 bun ./src/commands/models/train-models.ts
```

4. Optimize models
```bash
http_proxy="" https_proxy=""  NODE_TLS_REJECT_UNAUTHORIZED=0 bun ./src/commands/models/optimize-models.ts

```

5. Test all trained models and optimization variants across all datasets
```bash
http_proxy="" https_proxy=""  NODE_TLS_REJECT_UNAUTHORIZED=0 bun ./src/commands/models/test-models.ts
```

## Clone a project from one source to another

This script allows you to recreate a project from one platform instance into another. The project task configuration will be copied one-to-one and all datasets and its media will be copied over.
This does not include trained models or model test results. If you'd like to copy these then consider using project import/export.
```bash
BASE_URL_SOURCE="https://10.10.10.01/api/v1" \
API_KEY_SOURCE="geti_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_xxxxxx" \
BASE_URL_DESTINATION="https://20.20.20.02/api/v1" \
API_KEY_DESTINATON="geti_pat_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy_yyyyyy" \
no_proxy="20.20.20.02" \ # optionally if in a corporate network
SOURCE_ORGANIZATION_ID="64ad689e-362e-4b28-b1f8-41228dc6fd75"
SOURCE_WORKSPACE_ID="b5b32ce2-7545-40b0-8a1f-caa9b83cade4"
SOURCE_PROJECT_ID="000a0000000000000b0ec80a"
DESTINATION_ORGANIZATION_ID="16b7b540-7ab7-4ef1-90dc-0f69a9c36ace"
DESTINATION_WORKSPACE_ID="ae943e13-507f-454a-997a-46cdd303e4e1"
NODE_TLS_REJECT_UNAUTHORIZED=0 \
    bun ./src/commands/clone-project/clone-project.ts
```

> [!NOTE]
> This script should be compatible with multiple versions of Geti.
> Recently this has been tested on cloning a project from v2.7 to v2.12.

### Cloning all projects


```bash
BASE_URL_SOURCE="https://10.10.10.01/api/v1" \
API_KEY_SOURCE="geti_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_xxxxxx" \
BASE_URL_DESTINATION="https://20.20.20.02/api/v1" \
API_KEY_DESTINATON="geti_pat_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy_yyyyyy" \
no_proxy="20.20.20.02" \ # optionally if in a corporate network
DESTINATION_ORGANIZATION_ID="16b7b540-7ab7-4ef1-90dc-0f69a9c36ace"
DESTINATION_WORKSPACE_ID="ae943e13-507f-454a-997a-46cdd303e4e1"
NODE_TLS_REJECT_UNAUTHORIZED=0 \
    bun ./src/commands/clone-project/clone-projects.ts
```
