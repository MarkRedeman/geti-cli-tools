import { ModelIdentifier } from '../../types';
import { components } from './../../api/geti-openapi-schema';

type Jobs = Required<components['schemas']['job_list']>['jobs'];

export function isBeingOptimized(jobs: Jobs, modelIdentifier: ModelIdentifier) {
    return jobs.some((job) => {
        if (job.type !== 'optimize_pot') {
            return false;
        }

        return (
            job.metadata?.base_model_id === modelIdentifier.model_id &&
            (job.state === 'running' || job.state === 'scheduled')
        );
    });
}

export function isBeingTrained(jobs: Jobs, algorithm: { model_manifest_id?: string }) {
    return jobs.some((job) => {
        if (job.type !== 'train') {
            return false;
        }

        return (
            job.metadata?.task?.model_template_id === algorithm.model_manifest_id &&
            (job.state === 'running' || job.state === 'scheduled')
        );
    });
}

export function isBeingTested(jobs: Jobs, dataset: { id: string }, model: { id: string }) {
    return jobs.some((job) => {
        if (job.type !== 'test') {
            return false;
        }

        if (job.metadata === undefined || job.metadata.test === undefined) {
            return false;
        }

        const jobModel = job.metadata.test.model as { id: string };

        if (
            job.metadata?.test?.datasets?.some(({ id }) => id === dataset.id) &&
            jobModel.id === model.id
        ) {
            return true;
        }

        return false;
    });
}
