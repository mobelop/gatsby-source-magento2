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

    // gif & bmp images should be converted to jpg
    imageName = imageName.replace('.gif', '.jpg').replace('.bmp', '.jpg');

    const image =
        context.storeConfig.secure_base_media_url +
        baseURL +
        '/' +
        encodeURIComponent(imageName);

    try {
        const fileNode = await createRemoteFileNode({
            url: image,
            store: context.store,
            cache: context.cache,
            createNode: context.createNode,
            createNodeId: context.createNodeId,
            auth: context.auth,
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

export default createImageNode;
