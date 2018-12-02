import { GraphQLClient } from 'graphql-request';
import { createRemoteFileNode } from 'gatsby-source-filesystem';
import allProductsQuery from './queries/products';
import crypto from 'crypto';

const createProductNodes = (
    { createNode, createPage, createNodeId, store, cache, reporter, auth },
    {
        // base url + /graphql
        graphqlEndpoint,
        // base url + '/media/catalog'
        mediaCatalogUrl = null,
    }
) => {
    if (!mediaCatalogUrl) {
        throw new Error(
            'You need to pass catalogUrl option to Magento2 source plugin. Example: https://yourstore.com/media/catalog'
        );
    }

    return new Promise(async (resolve, reject) => {
        const client = new GraphQLClient(graphqlEndpoint, {});
        const res = await client.request(allProductsQuery);

        for (let i = 0; i < res.products.items.length; i++) {
            try {
                const item = res.products.items[i];
                const image = mediaCatalogUrl + '/product' + item.image;

                const fileNode = await createRemoteFileNode({
                    url: image,
                    store,
                    cache,
                    createNode,
                    createNodeId,
                    auth,
                });

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
            } catch (e) {
                console.error(e);
            }
        }

        resolve();
    });
};

export default createProductNodes;
