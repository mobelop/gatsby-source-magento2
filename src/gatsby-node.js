import createMagentoNodes from './nodes/index.js';
import {
    convertMagentoSchemaToGatsby,
    getRemoteGraphQLSchema,
} from './nodes/utils/schema';
import allProductsQuery from './nodes/queries/products';

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
    const { createNode, touchNode, createPage } = actions;

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

        const { graphqlEndpoint } = config;
        const schema = await getRemoteGraphQLSchema({
            graphqlEndpoint,
        });

        reporter.info(
            '[gatsby-source-magento2] Transforming to Gatsby-compatible GraphQL SDL'
        );

        stateCache['schema'] = convertMagentoSchemaToGatsby(
            allProductsQuery,
            schema
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
    const graphqlSdl = stateCache['schema'];
    createTypes(graphqlSdl);
};
