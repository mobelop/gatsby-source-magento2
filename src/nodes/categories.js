import { GraphQLClient } from 'graphql-request';
import categoryQuery from './queries/categories';
import createImageNode from './images';
import crypto from 'crypto';

const createCategoryNodes = (
    { createNode, createPage, createNodeId, store, cache, reporter, auth },
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
            },
            2,
            productMap
        );

        activity.end();

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
    const { client, query, reject, createNodeId, createNode, cache } = context;
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

        for (const item of res.category.children) {
            let children = [];
            if (item.children_count > 0) {
                // load each of the child categories
                children = await fetchCategories(context, item.id, productMap);
            }

            const itemCopy = {
                ...item,
            };

            itemCopy.products___NODE = item.products.items.map(
                item => productMap[item.id]
            );

            itemCopy.children = children;

            delete itemCopy.products;

            const nodeData = {
                ...itemCopy,
                id: createNodeId(`magento-category-${item.id}`),
                magento_id: item.id,
                parent_category_id: rootId,
                internal: {
                    type: 'MagentoCategory',
                    content: JSON.stringify(itemCopy),
                    contentDigest: crypto
                        .createHash(`md5`)
                        .update(JSON.stringify(itemCopy))
                        .digest(`hex`),
                },
            };

            await createImageNode(
                context,
                'catalog/category',
                item.image,
                nodeData
            );

            createNode(nodeData);

            ids.push(nodeData.id);
        }
    } catch (e) {
        reject(e);
    }

    return ids;
}
