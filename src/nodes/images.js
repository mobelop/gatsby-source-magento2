import { createRemoteFileNode } from 'gatsby-source-filesystem';
import { createFileNode } from 'gatsby-source-filesystem/create-file-node';

/**
 * Creates image node
 */
async function createImageNode(context, baseURL, imageName, nodeData) {
    if (!imageName || imageName === 'null') {
        const fileNode = await createImageNodeFromFile(
            context,
            // dummy category image
            'content/catalog/category.jpg'
        );

        if (fileNode) {
            nodeData.image___NODE = fileNode.id;
        }

        return;
    }

    try {
        const fileNode = await createRemoteFileNode({
            url: imageName,
            store: context.store,
            cache: context.cache,
            createNode: context.createNode,
            createNodeId: context.createNodeId,
            auth: context.auth,
            parentNodeId: nodeData.id,
        });

        if (fileNode) {
            nodeData.image___NODE = fileNode.id;
        }
    } catch (e) {
        console.error('failed to read file:', image, e);
    }
}

/**
 * Creates image node from local file
 * @param context
 * @param file
 * @returns {Promise<*>}
 */
async function createImageNodeFromFile(context, file) {
    let fileNode = null;

    try {
        fileNode = await createFileNode(file, context.createNodeId, {});

        context.createNode(fileNode, { name: `gatsby-source-filesystem` });

        return fileNode;
    } catch (e) {
        console.error('failed to read file:', file);
    }

    return null;
}

export async function downloadAndCacheImage(
    { url, nodeId },
    { createNode, createNodeId, touchNode, store, cache, getCache, reporter }
) {
    let fileNodeID;

    if (!url || url === 'null') {
        return;
    }

    const imageCacheId = `mageimg__${url}`;
    const cachedImageNode = await cache.get(imageCacheId);

    if (cachedImageNode) {
        fileNodeID = cachedImageNode.fileNodeID;
        touchNode({ nodeId: fileNodeID });
        return fileNodeID;
    }

    const fileNode = await createRemoteFileNode({
        url,
        store,
        cache,
        createNode,
        createNodeId,
        getCache,
        parentNodeId: nodeId,
        reporter,
    });

    if (fileNode) {
        fileNodeID = fileNode.id;
        await cache.set(imageCacheId, { fileNodeID });
        return fileNodeID;
    }

    return undefined;
}

export default createImageNode;
