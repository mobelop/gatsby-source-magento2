import { SubscriptionClient } from 'subscriptions-transport-ws';
import ws from 'ws';
import gql from 'graphql-tag';
import allProductsQuery from './queries/products';
import { print } from 'graphql/language/printer';
import { rawRequest } from 'graphql-request';
import { createProductNode } from './products';

export default async function watchForUpdates(context, config, importMaps) {
    const { reporter } = context;
    const {
        pubsubEndpoint = 'http://pubsub.mobelop.com/graphql',
        storeConfig,
        watch = false,
    } = config;

    if (!watch || process.env.NODE_ENV === 'production') {
        return;
    }

    const { base_url } = storeConfig;
    const newConfig = {
        ...config,
        singleProductQuery: getSingleProductQuery(config),
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
                                // deleteProduct();
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

function logErrors(errors) {
    if (errors && errors.length) {
        console.error(
            'ERRORS while querying products:',
            JSON.stringify(errors, undefined, 4)
        );
    }
}

function substituteQueryFields(fromQuery, toQuery) {
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
