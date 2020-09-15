import { SubscriptionClient } from 'subscriptions-transport-ws';
import ws from 'ws';
import gql from 'graphql-tag';
import allProductsQuery from './queries/products';
import categoryQuery from './queries/categories';
import { print } from 'graphql/language/printer';
import { rawRequest } from 'graphql-request';
import { createProductNode } from './products';
import { createCategoryNodeId } from './categories';
import { createCategoryNode } from './categories';

export default async function watchForUpdates(context, config, importMaps) {
    const { reporter } = context;
    const {
        pubsubEndpoint = 'http://pubsub.mobelop.com/graphql',
        pubsubApiKey = undefined,
        storeConfig,
        watch = false,
    } = config;

    if (!watch || process.env.NODE_ENV === 'production') {
        return;
    }

    if (!pubsubApiKey) {
        reporter.error(
            `[gatsby-source-magento2] please set pubsubApiKey option to enable real-time catalog updates`
        );
        return;
    }

    const { base_url } = storeConfig;
    const newConfig = {
        ...config,
        singleProductQuery: getSingleProductQuery(config),
        singleCategoryQuery: getSingleCategoryQuery(config),
    };

    reporter.info(
        `[gatsby-source-magento2] watching catalog changes, storeUrl: ${base_url}, pubsub: ${pubsubEndpoint}...`
    );

    try {
        const query = gql`
            subscription SubscribeForUpdates($storeUrl: String!) {
                updates(storeUrl: $storeUrl) {
                    type
                    value
                }
            }
        `;

        const client = new SubscriptionClient(
            pubsubEndpoint,
            {
                reconnect: true,
                connectionParams: {
                    'x-api-key': pubsubApiKey,
                },
            },
            ws
        );

        client.request({ query, variables: { storeUrl: base_url } }).subscribe({
            next: res => {
                const {
                    updates: { type, value },
                } = res.data;

                reporter.info(
                    `[gatsby-source-magento2] received update from the store: ${JSON.stringify(
                        res.data,
                        null,
                        2
                    )}`
                );

                try {
                    const [action, entity] = type.split(':');
                    switch (entity) {
                        case 'product':
                            if (action === 'update') {
                                updateProduct(
                                    context,
                                    newConfig,
                                    importMaps,
                                    value
                                );
                            }

                            if (action === 'delete') {
                                deleteProduct(context, value, importMaps);
                            }

                            break;

                        case 'category':
                            if (action === 'update') {
                                updateCategory(
                                    context,
                                    newConfig,
                                    importMaps,
                                    value
                                );
                            }

                            if (action === 'delete') {
                                deleteCategory(context, value);
                            }

                            break;
                    }
                } catch (e) {
                    console.error(e);
                }
            },
            error: error => console.error('error:', error),
            complete: () => console.log('done'),
        });
    } catch (e) {
        console.error(e);
    }
}

async function updateProduct(context, config, importMaps, sku) {
    const { reporter } = context;
    const { graphqlEndpoint, singleProductQuery } = config;

    let products = [];
    try {
        const {
            data: { products: { items = [] } = {} } = {},
            errors,
        } = await rawRequest(graphqlEndpoint, singleProductQuery, { sku });

        products = items;
        logErrors(errors);
    } catch (e) {
        if (e.response) {
            const {
                data: { products: { items = [] } = {} } = {},
                errors = [],
            } = e.response;

            products = items;
            logErrors(errors);

            console.log('query was:', singleProductQuery);
        }
    }

    if (products.length) {
        reporter.info(
            `[gatsby-source-magento2] product ${products[0].sku} was updated`
        );

        await createProductNode(context, products[0], importMaps);
    }
}

function deleteProduct(context, id, importMaps) {
    const { reporter, deleteNode, getNode } = context;
    const { productMap } = importMaps;

    try {
        if (id) {
            const nodeId = productMap[id];

            if (nodeId) {
                const existing = getNode(nodeId);
                if (existing) {
                    deleteNode({
                        node: existing,
                    });

                    reporter.info(
                        `[gatsby-source-magento2] product SKU: "${
                            existing.sku
                        }", ID: ${id} was deleted`
                    );
                }
            } else {
                reporter.info(
                    `[gatsby-source-magento2] product with ID ${id} not found in the node map`
                );
            }
        }
    } catch (e) {
        console.error(e);
    }
}

async function updateCategory(context, config, importMaps, id) {
    const { reporter } = context;
    const { graphqlEndpoint, singleCategoryQuery } = config;

    let categoryData;
    try {
        const { data: { category } = {}, errors } = await rawRequest(
            graphqlEndpoint,
            singleCategoryQuery,
            { id }
        );

        categoryData = category;

        logErrors(errors);
    } catch (e) {
        if (e.response) {
            const { errors = [] } = e.response;

            logErrors(errors);

            console.log('query was:', singleCategoryQuery);
        }
    }

    if (categoryData) {
        reporter.info(
            `[gatsby-source-magento2] category ${categoryData.name} was updated`
        );

        await createCategoryNode(context, categoryData, importMaps.productMap);
    }
}

function deleteCategory(context, value) {
    const { reporter, deleteNode, getNode } = context;

    try {
        if (value) {
            const nodeId = createCategoryNodeId(context, value);

            const existing = getNode(nodeId);
            if (existing) {
                deleteNode({
                    node: existing,
                });

                reporter.info(
                    `[gatsby-source-magento2] category ${
                        existing.name
                    } ID: ${value} was deleted`
                );
            }
        }
    } catch (e) {
        console.error(e);
    }
}

function getSingleProductQuery(config) {
    const { queries } = config;

    // use custom query for querying products
    const query =
        queries && queries.allProductsQuery
            ? queries.allProductsQuery
            : allProductsQuery;

    const targetQ = `
    query GetOneProduct($sku: String!) {
        products(filter: { sku: { eq: $sku } }) {
            items {
                id
            }
        }
    }
`;

    return substituteQueryFields(query, targetQ);
}

function getSingleCategoryQuery(config) {
    const { queries } = config;

    // use custom query for querying products
    const query =
        queries && queries.categoryQuery
            ? queries.categoryQuery
            : categoryQuery;

    const targetQ = `
    query GetOneCategory($id: Int!) {
        category(id: $id) {
            id
        }
    }
`;

    return substituteQueryFieldsForCategory(query, targetQ);
}

function logErrors(errors) {
    if (errors && errors.length) {
        console.error(
            'ERRORS while querying products:',
            JSON.stringify(errors, undefined, 4)
        );
    }
}

export function substituteQueryFields(fromQuery, toQuery) {
    const parsed = gql(fromQuery);
    const modified = gql(toQuery);

    for (const definition of parsed.definitions) {
        // copy fragments
        if (definition.kind === 'FragmentDefinition') {
            modified.definitions.push(definition);
        } else if (definition.kind === 'OperationDefinition') {
            const { selections } = definition.selectionSet;
            const productQuery = selections[0];

            modified.definitions[0].selectionSet.selections[0].selectionSet.selections[0] =
                productQuery.selectionSet.selections[0];
        }
    }

    return print(modified);
}

export function substituteQueryFieldsForCategory(fromQuery, toQuery) {
    const parsed = gql(fromQuery);
    const modified = gql(toQuery);

    for (const definition of parsed.definitions) {
        // copy fragments
        if (definition.kind === 'FragmentDefinition') {
            modified.definitions.push(definition);
        } else if (definition.kind === 'OperationDefinition') {
            const { selections } = definition.selectionSet;
            const productQuery = selections[0];

            modified.definitions[0].selectionSet.selections[0].selectionSet =
                productQuery.selectionSet.selections[0].selectionSet;
        }
    }

    return print(modified);
}
