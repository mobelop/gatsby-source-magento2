import createMagentoNodes from './nodes/index.js';
import {
    convertMagentoSchemaToGatsby,
    getRemoteGraphQLSchema,
} from './nodes/utils/schema';
import allProductsQuery from './nodes/queries/products';
import categoryQuery from './nodes/queries/categories';

export const sourceNodes = async (
    {
        actions,
        getNode,
        store,
        cache,
        getCache,
        createNodeId,
        createContentDigest,
        reporter,
        auth,
    },
    options
) => {
    const { createNode, touchNode, createPage, deleteNode } = actions;

    if (!options.graphqlEndpoint) {
        reporter.panic(
            `You need to pass graphqlEndpoint option to Magento2 source plugin. Example: https://yourstore.com/graphql`
        );
    }

    await createMagentoNodes(
        {
            store,
            cache,
            getCache,
            createNode,
            createNodeId,
            deleteNode,
            getNode,
            createContentDigest,
            touchNode,
            createPage,
            auth,
            reporter,
        },
        options
    );
};

const stateCache = {};

export const onPreBootstrap = async (context, config) => {
    const { reporter, actions } = context;

    if (!actions.createTypes) {
        reporter.panic(
            `You are using a version of Gatsby not supported by gatsby-source-magento2. Upgrade gatsby to >= 2.2.0`
        );
        return;
    }

    try {
        reporter.info(
            '[gatsby-source-magento2] Fetching remote GraphQL schema'
        );

        const { graphqlEndpoint, queries } = config;
        const schema = await getRemoteGraphQLSchema({
            graphqlEndpoint,
        });

        reporter.info(
            '[gatsby-source-magento2] Transforming to Gatsby-compatible GraphQL SDL'
        );

        const selectedProductsQuery =
            queries && queries.allProductsQuery
                ? queries.allProductsQuery
                : allProductsQuery;

        const selectedCategoriesQuery =
            queries && queries.categoryQuery
                ? queries.categoryQuery
                : categoryQuery;

        stateCache['schemas'] = [];

        stateCache['schemas'].push(
            convertMagentoSchemaToGatsby(selectedProductsQuery, schema)
        );
        stateCache['schemas'].push(
            convertMagentoSchemaToGatsby(selectedCategoriesQuery, schema)
        );
    } catch (err) {
        if (err.isWarning) {
            err.message.split('\n').forEach(line => reporter.warn(line));
        } else {
            reporter.panic(err.stack);
        }
    }
};

export const createSchemaCustomization = ({ actions }, pluginConfig) => {
    const { createTypes } = actions;
    for (const schema of stateCache['schemas']) {
        createTypes(schema);
    }
};
