#!/usr/bin/env bun
import { collect, map } from '../iterators';
import { client } from './../api/client';
import { projectsIterator } from './../geti-iterators';

// This script shows how to compose iterator helpers to display a table
// of project information
// these same concepts can be used to display project's models, tests etc

const projectsIdsToRemove = ['xxx', 'yyy'];

const projects = projectsIterator(client, {
    filter: (project) => {
        return projectsIdsToRemove.includes(project.id) === false;
    },
});

const projectsTable = map(projects, ({ project }) => {
    const tasks = project.pipeline.tasks;
    const labels = tasks.flatMap((task) => task.labels?.map((label) => label.name) ?? []);

    return {
        id: project.id,
        name: project.name,
        score: project.performance?.score,
        tasks: tasks.map((task) => task.task_type).join(', '),
        labels: labels.join(', '),
    };
});

console.table(await collect(projectsTable));
