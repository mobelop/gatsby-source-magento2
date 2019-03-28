import { GraphQLClient } from 'graphql-request';
import { createRemoteFileNode } from 'gatsby-source-filesystem';
import allProductsQuery from './queries/products';
import crypto from 'crypto';
import fs from 'fs';

const createProductNodes = (
    { createNode, createPage, createNodeId, store, cache, reporter, auth },
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

    if (!fs.existsSync('.skip')) {
        fs.mkdirSync('.skip');
    }

    return new Promise(async (resolve, reject) => {
        const client = new GraphQLClient(graphqlEndpoint, {});

        // use custom query for querying products
        const query =
            queries && queries.allProductsQuery
                ? queries.allProductsQuery
                : allProductsQuery;

        const res = await client.request(query);

        for (let i = 0; i < res.products.items.length; i++) {
            try {
                const item = res.products.items[i];

                if (fs.existsSync(`.skip/${item.id}`)) {
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

                const image =
                    storeConfig.secure_base_media_url +
                    'catalog/product' +
                    item.image;

                const fileNode = await createRemoteFileNode({
                    url: image,
                    store,
                    cache,
                    createNode,
                    createNodeId,
                    auth,
                });

                if (fileNode) {
                    delete item.image;

                    item.image___NODE = fileNode.id;

                    const nodeData = {
                        ...item,
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

                    const aggregate = ['new', 'eco_collection']

                    for(const aggr of aggregate) {
                        const key = aggr + '_' + item[aggr]
                        if(!indexMap['product'][key]) {
                            indexMap['product'][key] = []
                        }

                        indexMap['product'][key].push(nodeData.id);
                    }

                } else {
                    fs.writeFileSync(`.skip/${item.id}`);
                    console.error('failed to download image:', image);
                }
            } catch (e) {
                reject(e);
            }
        }

        resolve();
    });
};

export default createProductNodes;
