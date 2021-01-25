import { GraphQLClient } from 'graphql-request';
import categoryQuery from './queries/categories';
import { downloadNodeImages } from './images';
import crypto from 'crypto';

const createCategoryNodes = (
    {
        createNode,
        createPage,
        createNodeId,
        store,
        cache,
        reporter,
        auth,
        touchNode,
    },
    { graphqlEndpoint, storeConfig, queries },
    productMap
) => {
    if (!storeConfig) {
        reporter.panic(`got empty storeConfig`);
    }

    if (!storeConfig.secure_base_media_url) {
        reporter.panic(`got empty storeConfig.secure_base_media_url`);
    }

    const query =
        queries && queries.categoryQuery
            ? queries.categoryQuery
            : categoryQuery;

    const activity = reporter.activityTimer(`load Magento categories`);

    activity.start();

    return new Promise(async (resolve, reject) => {
        const client = new GraphQLClient(graphqlEndpoint, {});

        const bar = reporter.createProgress('Downloading category images');
        bar.start();

        await fetchCategories(
            {
                client,
                query,
                reject: () => {
                    activity.end();
                    reject();
                },
                createNode,
                createNodeId,
                storeConfig,
                auth,
                store,
                cache,
                touchNode,
                bar,
            },
            2,
            productMap
        );

        bar.end ? bar.end() : bar.done();
        try {
            activity.end();
        } catch (e) {}

        resolve();
    });
};

export default createCategoryNodes;

/**
 * @param context
 * @param rootId
 * @returns {Promise<void>}
 */
async function fetchCategories(context, rootId, productMap) {
    const { client, query, reject, cache, bar } = context;
    const ids = [];

    try {
        // todo: add some data to invalidate cache when updated in Magento
        const categoryCacheKey = `magento-category-${rootId}`;

        let res = await cache.get(categoryCacheKey);
        if (!res) {
            res = await client.request(query, {
                id: rootId,
            });

            cache.set(categoryCacheKey, res);
        }

        bar.total += res.category.children.length;

        for (const item of res.category.children) {
            bar.tick();

            const nodeData = await createCategoryNode(
                context,
                item,
                productMap
            );

            ids.push(nodeData.id);
        }
    } catch (e) {
        console.error(e);
        reject(e);
    }

    return ids;
}

export async function createCategoryNode(context, item, productMap) {
    const { createNode } = context;

    const itemCopy = {
        ...item,
    };

    let children = [];
    if (item.children_count > 0) {
        // load each of the child categories
        children = await fetchCategories(context, item.id, productMap);
    }

    // download images for product items
    await processItemsImages(context, itemCopy.products.items)

    itemCopy.children = children;

    let parent_category_id = 2;
    const { breadcrumbs = [] } = itemCopy;
    if (Array.isArray(breadcrumbs) && breadcrumbs.length) {
        const topCategory = breadcrumbs[breadcrumbs.length - 1];
        if (topCategory.category_id) {
            parent_category_id = topCategory.category_id;
        }
    }

    await downloadNodeImages(context, itemCopy)

    const nodeData = {
        ...itemCopy,
        id: createCategoryNodeId(context, item.id),
        magento_id: item.id,
        parent_category_id,
        internal: {
            type: 'MagentoCategory',
            content: JSON.stringify(itemCopy),
            contentDigest: crypto
                .createHash(`md5`)
                .update(JSON.stringify(itemCopy))
                .digest(`hex`),
        },
    };

    createNode(nodeData);

    return nodeData;
}

export function createCategoryNodeId(context, id) {
    return context.createNodeId(`magento-category-${id}`);
}

async function processItemsImages(context, items) {
    for(const item of items) {
        await downloadNodeImages(context, item)
    }
}
