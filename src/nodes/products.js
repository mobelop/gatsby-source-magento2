import { GraphQLClient } from 'graphql-request';
import { createRemoteFileNode } from 'gatsby-source-filesystem';
import allProductsQuery from './queries/products';
import crypto from 'crypto';

const createProductNodes = (
    { createNode, createPage, createNodeId, store, cache, reporter, auth },
    { graphqlEndpoint, storeConfig, queries }
) => {
    if (!storeConfig) {
        reporter.panic(`got empty storeConfig`);
    }

    if (!storeConfig.secure_base_media_url) {
        reporter.panic(`got empty storeConfig.secure_base_media_url`);
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
                    item.image___NODE = fileNode.id;

                    createNode({
                        ...item,
                        id: createNodeId(`${item.id}`),
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
                    });
                } else {
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
