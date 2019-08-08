import { GraphQLClient } from 'graphql-request';
import { createRemoteFileNode } from 'gatsby-source-filesystem';
import allProductsQuery from './queries/products';
import crypto from 'crypto';
import ProgressBar from 'progress';

const bar = new ProgressBar(
    `Processing Magento Products [:bar] :current/:total :elapsed secs :percent`,
    {
        total: 0,
        width: 30,
    }
);

const createProductNodes = (
    {
        createNode,
        touchNode,
        createPage,
        createNodeId,
        store,
        cache,
        reporter,
        auth,
    },
    { graphqlEndpoint, storeConfig, queries },
    productMap,
    indexMap
) => {
    if (!storeConfig) {
        reporter.panic(`got empty storeConfig`);
    }

    if (!storeConfig.secure_base_media_url) {
        reporter.panic(`got empty storeConfig.secure_base_media_url`);
    }

    const activity = reporter.activityTimer(`load Magento products`);

    activity.start();

    return new Promise(async (resolve, reject) => {
        const client = new GraphQLClient(graphqlEndpoint, {});

        // use custom query for querying products
        const query =
            queries && queries.allProductsQuery
                ? queries.allProductsQuery
                : allProductsQuery;

        const productsKey = 'magento-products';
        let res = await cache.get(productsKey);
        if (!res) {
            res = await client.request(query);
            await cache.set(productsKey, res);
        }

        bar.total = res.products.items.length;

        for (let i = 0; i < res.products.items.length; i++) {
            try {
                const item = res.products.items[i];

                // cache bad image responses
                const skipKey = `.skip/${item.id}`;
                const shouldSkip = await cache.get(skipKey);
                if (shouldSkip) {
                    // console.log(
                    //     `skipping product SKU: ${
                    //         item.sku
                    //     }, since we've failed to download the image`
                    // );
                    continue;
                }

                if (!item) {
                    reporter.panic(
                        `Got invalid result from GraphQL endpoint: ${JSON.stringify(
                            item,
                            0,
                            2
                        )}`
                    );
                }

                let fileNodeID;
                const remoteDataCacheKey = `magento-product-image-${
                    item.image.url
                }`;

                const cacheRemoteData = await cache.get(remoteDataCacheKey);
                const image =
                    // storeConfig.secure_base_media_url +
                    // 'catalog/product' +
                    item.image.url.replace(/cache\/[^\/]+\//, '');

                // Avoid downloading the asset again if it's been cached
                if (cacheRemoteData && cacheRemoteData.fileNodeID) {
                    fileNodeID = cacheRemoteData.fileNodeID;
                    touchNode({ nodeId: cacheRemoteData.fileNodeID });
                    bar.tick();
                }

                if (!fileNodeID) {
                    try {
                        const fileNode = await createRemoteFileNode({
                            url: image,
                            store,
                            cache,
                            createNode,
                            createNodeId,
                            auth,
                        });

                        if (fileNode) {
                            bar.tick();
                            fileNodeID = fileNode.id;

                            await cache.set(remoteDataCacheKey, { fileNodeID });
                        }
                    } catch (err) {
                        console.error(err);
                        // Ignore
                    }
                }

                if (fileNodeID) {
                    item.image_label = item.image.label;

                    delete item.image;

                    item.image___NODE = fileNodeID;

                    const nodeData = {
                        ...transformItem(item),
                        id: createNodeId(`product-${item.id}`),
                        magento_id: item.id,
                        parent: `__PRODUCTS__`,
                        children: [],
                        internal: {
                            type: 'MagentoProduct',
                            content: JSON.stringify(item),
                            contentDigest: crypto
                                .createHash(`md5`)
                                .update(JSON.stringify(item))
                                .digest(`hex`),
                        },
                    };

                    createNode(nodeData);

                    productMap[item.id] = nodeData.id;

                    indexMap['product'][item.id] = nodeData.id;
                    indexMap['product']['sku_' + item.sku] = nodeData.id;

                    // TODO: rewrite
                    // const aggregate = ['new', 'eco_collection']
                    //
                    // for(const aggr of aggregate) {
                    //     const key = aggr + '_' + item[aggr]
                    //     if(!indexMap['product'][key]) {
                    //         indexMap['product'][key] = []
                    //     }
                    //
                    //     indexMap['product'][key].push(nodeData.id);
                    // }

                } else {
                    await cache.set(skipKey, true);
                    console.error('failed to download image:', image);
                }
            } catch (e) {
                console.error('Error while creating product nodes:', e);
                reject(e);
            }
        }

        activity.end();

        resolve();
    });
};

function transformItem(item) {
    const result = {
        ...item,
    };

    result.description = result.description.html;
    result.short_description = result.short_description.html;

    return result;
}

export default createProductNodes;
