import { Client } from '../../api/client';
import { flatten, NextPage, pagesIterator } from '../../iterators';
import { DatasetIdentifier } from '../../types';
import { type components, type operations } from './../../api/geti-openapi-schema';

type MediaItem = Exclude<
    operations['FilterMedia']['responses']['200']['content']['application/json']['media'],
    undefined
>[number];

type VideoAnnotationResponse =
    operations['GetVideoAnnotation']['responses']['200']['content']['application/json'];

type ImageAnnotationResponse =
    operations['GetImageAnnotation']['responses']['200']['content']['application/json'];
type Annotation = Exclude<ImageAnnotationResponse['annotations'], undefined>[number];

// TODO: update OpenAPI spec
type ActualVideoAnnotationsResponse = {
    video_annotations: Array<VideoAnnotationResponse>;
    video_annotation_properties: {
        total_count: number;
        start_frame: number;
        end_frame: number;
        total_requested_count: number;
        requested_start_frame: number | null;
        requested_end_frame: number | null;
    };
};

type AnnotationLabel = Annotation['labels'][number];
type Project = components['schemas']['project-2'];

export function getAnnotationMapToNewProject(oldProject: Project, newProject: Project) {
    const newProjectLabels = newProject.pipeline.tasks.flatMap((task) => task.labels ?? []);
    const oldProjectLabels = oldProject.pipeline.tasks.flatMap((task) => task.labels ?? []);

    const oldToNew = Object.fromEntries(
        oldProjectLabels.map((oldLabel) => {
            const newLabel = newProjectLabels.find(({ name }) => name === oldLabel.name);

            return [oldLabel.id, newLabel?.id];
        })
    );

    return function getNewLabel(label: AnnotationLabel): AnnotationLabel {
        const id = oldToNew[label.id!];

        if (id) {
            return { ...label, id };
        }

        return label;
    };
}

async function getImageAnnotations(
    client: Client,
    datasetIdentifier: DatasetIdentifier,
    mediaItem: MediaItem
) {
    if (mediaItem.type !== 'image') {
        throw new Error('No image');
    }

    const annotationsResponse = await client[
        '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}/datasets/{dataset_id}/media/images/{image_id}/annotations/{annotation_id}'
    ].GET({
        params: {
            path: {
                ...datasetIdentifier,
                image_id: String(mediaItem.id),
                annotation_id: 'latest',
            },
        },
    });

    if (annotationsResponse.error) {
        throw annotationsResponse.error;
    }

    return (annotationsResponse.data as ImageAnnotationResponse).annotations;
}

export function getVideoAnnotations(
    client: Client,
    datasetIdentifier: DatasetIdentifier,
    mediaItem: MediaItem
) {
    if (mediaItem.type !== 'video') {
        throw new Error('No video');
    }

    const videoAnnotationsPages = pagesIterator(async (nextPage) => {
        let options = (nextPage ?? {
            start_frame: 0,
            frameskip: 1,
            end_frame: mediaItem.media_information!?.frame_count,
        }) as
            | {
                  start_frame: number;
                  frameskip: number;
                  end_frame: number;
              }
            | undefined;

        const annotationsResponse = await client[
            '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}/datasets/{dataset_id}/media/videos/{video_id}/annotations/latest'
        ].GET({
            params: {
                path: {
                    ...datasetIdentifier,
                    video_id: String(mediaItem.id),
                    annotation_id: 'latest',
                },
                query: options,
            },
        });

        if (annotationsResponse.error) {
            throw annotationsResponse.error;
        }

        const data = annotationsResponse.data as ActualVideoAnnotationsResponse;

        // Make sure that we escape the loop if we receive weird data
        if (
            isNaN(data.video_annotation_properties.total_requested_count) ||
            isNaN(data.video_annotation_properties.total_count) ||
            data.video_annotation_properties.total_requested_count < 0 ||
            data.video_annotation_properties.total_count < 0
        ) {
            return {
                data: data.video_annotations,
                nextPage: undefined,
            };
        }

        if (
            data.video_annotation_properties.total_requested_count >
            data.video_annotation_properties.total_count
        ) {
            return {
                data: data.video_annotations,
                nextPage: {
                    ...options,
                    start_frame: data.video_annotation_properties.end_frame + 1,
                } as unknown as NextPage,
            };
        }

        return {
            data: data.video_annotations,
            nextPage: undefined,
        };
    });

    return flatten(videoAnnotationsPages);
}

async function uploadImageMediaItem(
    sourceClient: Client,
    sourceDatasetIdentifier: DatasetIdentifier,
    destinationClient: Client,
    destinationDatasetIdentifier: DatasetIdentifier,
    oldMediaItem: MediaItem
) {
    if (oldMediaItem.type !== 'image') {
        throw new Error('Media item is not an image');
    }

    const imageResponse = await sourceClient[
        '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}/datasets/{dataset_id}/media/images/{image_id}/display/full'
    ].GET({
        params: { path: { ...sourceDatasetIdentifier, image_id: oldMediaItem.id! } },
        parseAs: 'blob',
    });

    if (imageResponse.error) {
        throw imageResponse.error;
    }

    const formData = new FormData();
    formData.append(
        'file',
        imageResponse.data,
        `${oldMediaItem.name}.${oldMediaItem.media_information?.extension ?? 'png'}`
    );

    const response = await destinationClient[
        '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}/datasets/{dataset_id}/media/images'
    ].POST({
        params: {
            path: destinationDatasetIdentifier,
        },
        // @ts-expect-error TODO: figure out a better way to type this
        body: formData,
    });

    if (response.error) {
        throw response.error;
    }

    return response.data;
}

async function uploadVideoMediaItem(
    sourceClient: Client,
    sourceDatasetIdentifier: DatasetIdentifier,
    destinationClient: Client,
    destinationDatasetIdentifier: DatasetIdentifier,
    oldMediaItem: MediaItem
) {
    if (oldMediaItem.type !== 'video') {
        throw new Error('Media item is not an video');
    }

    const videoResponse = await sourceClient[
        '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}/datasets/{dataset_id}/media/videos/{video_id}/display/stream'
    ].GET({
        params: { path: { ...sourceDatasetIdentifier, video_id: String(oldMediaItem.id) } },
        parseAs: 'blob',
    });

    if (videoResponse.error) {
        throw videoResponse.error;
    }

    const formData = new FormData();
    formData.append(
        'file',
        videoResponse.data,
        // @ts-expect-error TODO: update OpenAPI spec
        `${oldMediaItem.name}.${oldMediaItem.media_information?.extension ?? 'png'}`
    );

    const response = await destinationClient[
        '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}/datasets/{dataset_id}/media/videos'
    ].POST({
        params: {
            path: destinationDatasetIdentifier,
        },
        // @ts-expect-error TODO: figure out a better way to type this
        body: formData,
    });

    if (response.error) {
        throw response.error;
    }

    return response.data;
}

export async function copyMediaItem(
    sourceClient: Client,
    sourceDatasetIdentifier: DatasetIdentifier,
    destinationClient: Client,
    destinationDatasetIdentifier: DatasetIdentifier,
    oldMediaItem: MediaItem,
    // Used to map labels of an annotation
    getNewLabel: (label: AnnotationLabel) => AnnotationLabel
) {
    // const filename = `${mediaItem.name}.${mediaItem.media_information?.extension ?? mediaItem.type === 'image' ? 'png' : 'mp4'}`

    if (oldMediaItem.type === 'image') {
        const annotations = await getImageAnnotations(
            sourceClient,
            sourceDatasetIdentifier,
            oldMediaItem
        );

        const newMediaItem = await uploadImageMediaItem(
            sourceClient,
            sourceDatasetIdentifier,
            destinationClient,
            destinationDatasetIdentifier,
            oldMediaItem
        );

        const annotationsResponse = await destinationClient[
            '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}/datasets/{dataset_id}/media/images/{image_id}/annotations'
        ].POST({
            params: {
                path: {
                    ...destinationDatasetIdentifier,
                    image_id: String(newMediaItem.id),
                },
            },
            body: {
                annotations: annotations.map((annotation) => {
                    const shape = annotation.shape!;
                    const labels = annotation.labels.map(getNewLabel).map((label) => ({
                        id: label.id!,
                    }));

                    return { labels, shape };
                }),
            },
        });

        if (annotationsResponse.error) {
            throw annotationsResponse.error;
        }
    }

    if (oldMediaItem.type === 'video') {
        const annotations = getVideoAnnotations(
            sourceClient,
            sourceDatasetIdentifier,
            oldMediaItem
        );

        const newMediaItem = await uploadVideoMediaItem(
            sourceClient,
            sourceDatasetIdentifier,
            destinationClient,
            destinationDatasetIdentifier,
            oldMediaItem
        );

        for await (const videoAnnotation of annotations) {
            console.log(
                videoAnnotation.media_identifier?.frame_index,
                videoAnnotation.annotations?.length
            );

            const annotationsResponse = await destinationClient[
                '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}/datasets/{dataset_id}/media/videos/{video_id}/frames/{frame_index}/annotations'
            ].POST({
                params: {
                    path: {
                        ...destinationDatasetIdentifier,
                        video_id: String(newMediaItem.id),
                        frame_index: videoAnnotation.media_identifier?.frame_index!,
                    },
                },
                body: {
                    annotations:
                        videoAnnotation.annotations?.map((annotation) => {
                            const shape = annotation.shape!;

                            const labels = annotation.labels.map(getNewLabel).map((label) => ({
                                id: label.id!,
                            }));

                            return { labels, shape };
                        }) ?? [],
                },
            });

            if (annotationsResponse.error) {
                throw annotationsResponse.error;
            }

            console.log(annotationsResponse.response.status);
        }
        console.log(newMediaItem);

        // Download video blob
        // Upload video blob
        // Loop over annotations and submit
        // await client[
        //     '/organizations/{organization_id}/workspaces/{workspace_id}/projects/{project_id}/datasets/{dataset_id}/media/videos'
        // ].POST();
        // ...
    }
}
