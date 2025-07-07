export type NextPage = null | string | undefined;
export async function* pagesIterator<T>(
    fetchPage: (nextPage: NextPage) => Promise<{ nextPage: NextPage; data: T }>
) {
    let currentPage: NextPage = null;

    while (currentPage !== undefined) {
        const { data, nextPage } = await fetchPage(currentPage);

        currentPage = nextPage;
        yield data;
    }
}

export async function* flatten<T>(generator: AsyncGenerator<T[]>) {
    for await (const items of generator) {
        for (const item of items) {
            yield item;
        }
    }
}

export async function* filter<T>(generator: AsyncGenerator<T>, fn: (item: T) => boolean) {
    for await (const item of generator) {
        if (fn(item)) {
            yield item;
        }
    }
}

export async function* map<T, FT>(generator: AsyncGenerator<T>, fn: (item: T) => FT) {
    for await (const item of generator) {
        yield await fn(item);
    }
}

export async function collect<T>(generator: AsyncGenerator<T>) {
    const items: Array<Awaited<T>> = [];
    for await (const item of generator) {
        items.push(item);
    }
    return items;
}

export async function* chunk<T>(generator: AsyncGenerator<T>, n: number): AsyncGenerator<T[]> {
    let buffer: T[] = [];

    for await (const item of generator) {
        buffer.push(item);

        if (buffer.length === n) {
            yield buffer;
            buffer = [];
        }
    }

    // Yield any remaining items in the buffer
    if (buffer.length > 0) {
        yield buffer;
    }
}
