import { GraphQLClient } from 'graphql-request';
import storeConfigQuery from './queries/storeConfig.js';
import crypto from 'crypto';

const createStoreNode = (
    { createNode, createPage, createNodeId, store, cache, reporter, auth },
    { graphqlEndpoint }
) => {
    return new Promise(async (resolve, reject) => {
        const client = new GraphQLClient(graphqlEndpoint, {});

        try {
            const config = await client.request(storeConfigQuery);

            createNode({
                ...config.storeConfig,
                id: createNodeId(`${config.id}`),
                magento_id: config.id,
                parent: `__STORE__`,
                children: [],
                internal: {
                    type: 'MagentoStore',
                    content: JSON.stringify(config),
                    contentDigest: crypto
                        .createHash(`md5`)
                        .update(JSON.stringify(config))
                        .digest(`hex`),
                },
            });

            resolve(config);
        } catch (e) {
            reporter.panic(`Failed to fetch Magento store config: ${e}`);
        }
    });
};

export default createStoreNode;
