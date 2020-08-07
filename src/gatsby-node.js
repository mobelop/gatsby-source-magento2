import createMagentoNodes from './nodes/index.js';

exports.sourceNodes = async (
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

    return await createMagentoNodes(
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
