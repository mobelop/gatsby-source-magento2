import { GraphQLClient } from 'graphql-request';
import cmsBlockQuery from './queries/cmsBlocks';
import cmsContentParser from './cmsContentParser';
import crypto from 'crypto';

const createCmsBlockNodes = (
    { createNode, createPage, createNodeId, store, cache, reporter, auth },
    { graphqlEndpoint, storeConfig, queries },
    indexMap
) => {
    if (!storeConfig) {
        reporter.panic(`got empty storeConfig`);
    }

    if (!storeConfig.secure_base_media_url) {
        reporter.panic(`got empty storeConfig.secure_base_media_url`);
    }

    const query =
        queries && queries.cmsBlockQuery
            ? queries.cmsBlockQuery
            : cmsBlockQuery;

    const activity = reporter.activityTimer(`load Magento cmsBlocks`);

    activity.start();

    return new Promise(async (resolve, reject) => {
        const client = new GraphQLClient(graphqlEndpoint, {});

        try {
            await fetchCMSBlocks(
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
                    reporter,
                },
                indexMap
            );

            activity.end();

            resolve();
        } catch (e) {
            console.error('Error while creating cmsBlock nodes:', e);
            reject(e);
        }
    });
};

export default createCmsBlockNodes;

/**
 * @param context
 * @param rootId
 * @returns {Promise<void>}
 */
async function fetchCMSBlocks(context, indexMap) {
    const {
        client,
        query,
        reject,
        createNodeId,
        createNode,
        cache,
        storeConfig,
        reporter,
    } = context;

    try {
        // const categoryCacheKey = `magento-cms-block-${rootId}`;
        //
        // let res = await cache.get(categoryCacheKey);
        // if (!res) {
        let res = await client.request(query, {
            ids: ['home-page-block', 'footer_links_block'],
        });
        //
        //     cache.set(categoryCacheKey, res);
        // }

        for (const item of res.gatsbyCmsBlocks.items) {
            const nodes = cmsContentParser(item.content, {
                media_url: storeConfig.secure_base_media_url,
            });

            const itemCopy = {
                ...item,
            };

            // itemCopy.nodes___NODE = parseChildNodes(
            const children = parseChildNodes(
                item.identifier,
                createNode,
                createNodeId,
                nodes,
                indexMap
            );

            const nodeData = {
                ...itemCopy,
                id: createNodeId(`magento-cms-block-${item.identifier}`),
                magento_id: item.identifier,
                children,
                internal: {
                    type: 'MagentoCmsBlock',
                    content: JSON.stringify(itemCopy),
                    contentDigest: crypto
                        .createHash(`md5`)
                        .update(JSON.stringify(itemCopy))
                        .digest(`hex`),
                },
            };

            createNode(nodeData);
        }
    } catch (e) {
        console.error('error executing GraphQL query:', e);
        reject(e);
    }
}

function parseChildNodes(magentoId, createNode, createNodeId, nodes, indexMap) {
    return nodes.map((block, idx) => {
        switch (block.type) {
            case 'text':
                const node = {
                    id: createNodeId(`cms-node-${magentoId}-${idx}`),
                    blockType: 'text',
                    value: block.value,
                    // items___NODES: [],
                    internal: {
                        type: 'CmsTextBlockNode',
                        contentDigest: crypto
                            .createHash(`md5`)
                            .update(block.value)
                            .digest(`hex`),
                    },
                }

                createNode(node);

                return node.id;

            case 'Magento\\CatalogWidget\\Block\\Product\\ProductsList':
                // WIP !!!
                const conditions = JSON.parse(
                    block.conditions_encoded
                        .replace(/\^\[/g, '{')
                        .replace(/`/g, '"')
                        .replace(/\^\]/g, '}')
                );

                let products___NODES = [];

                const query = conditions['1--1'];

                const products = indexMap.product;

                if (query.attribute) {
                    switch (query.operator) {
                        case '==':
                            const parts = query.value
                                .replace(/\|\//g, '/')
                                .split(', ');
                            if (Array.isArray(parts)) {
                                for (const value of parts) {
                                    const entry =
                                        products[query.attribute + '_' + value];
                                    if (entry) {
                                        products___NODES.push(entry);
                                    }
                                }
                            }
                            break;

                        case '()':
                            const values = query.value.split(', ');
                            for (const value of values) {
                                const entry =
                                    products[query.attribute + '_' + value];
                                if (entry) {
                                    products___NODES.push(entry);
                                } else {
                                    console.info(
                                        `couldn't find product by: ${
                                            query.attribute
                                        } = ${value}`
                                    );
                                }
                            }
                            break;
                    }
                }

                const result = {
                    id: createNodeId(`cms-node-${magentoId}-${idx}`),
                    blockType: 'products',
                    value: null,
                    count: products___NODES.length,
                    children: products___NODES,
                    internal: {
                        type: 'CmsProductListNode',
                        contentDigest: crypto
                            .createHash(`md5`)
                            .update(block.conditions_encoded)
                            .digest(`hex`),
                    },
                }
                
                createNode(result);

                return result.id;
        }
    });
}
