import { GraphQLClient } from 'graphql-request';
import allProductsQuery from './queries/products';
import crypto from 'crypto';
import { downloadAndCacheImage } from './images';

const createProductNodes = (
    {
        createNode,
        createPage,
        createNodeId,
        touchNode,
        createContentDigest,
        store,
        cache,
        getCache,
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

    const imageArgs = {
        createNode,
        createNodeId,
        touchNode,
        store,
        cache,
        getCache,
        reporter,
    };

    return new Promise(async (resolve, reject) => {
        const client = new GraphQLClient(graphqlEndpoint, {});

        // use custom query for querying products
        const query =
            queries && queries.allProductsQuery
                ? queries.allProductsQuery
                : allProductsQuery;

        const res = await client.request(query);

        const bar = reporter.createProgress('Downloading product images');
        bar.start();
        bar.total = res.products.items.length;

        for (let i = 0; i < res.products.items.length; i++) {
            bar.tick();

            try {
                const item = res.products.items[i];

                if (!item) {
                    reporter.panic(
                        `Got invalid result from GraphQL endpoint: ${JSON.stringify(
                            item,
                            0,
                            2
                        )}`
                    );
                }

                const image = item.image.url;
                const productNodeId = createNodeId(`product-${item.id}`);

                const fileNodeId = await downloadAndCacheImage(
                    {
                        url: image,
                    },
                    imageArgs
                );

                if (fileNodeId) {
                    delete item.image;

                    item.image___NODE = fileNodeId;

                    const nodeData = {
                        ...item,
                        id: productNodeId,
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

                    const aggregate = ['new', 'eco_collection'];

                    for (const aggr of aggregate) {
                        const key = aggr + '_' + item[aggr];
                        if (!indexMap['product'][key]) {
                            indexMap['product'][key] = [];
                        }

                        indexMap['product'][key].push(nodeData.id);
                    }
                } else {
                    console.error(
                        'failed to download image:',
                        image,
                        ', for SKU:',
                        item.sku
                    );
                }
            } catch (e) {
                console.error(e);
                bar.end ? bar.end() : bar.done();
                reject(e);
            }
        }

        bar.end ? bar.end() : bar.done();
        resolve();
    });
};

export default createProductNodes;
