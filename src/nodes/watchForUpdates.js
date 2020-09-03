import { SubscriptionClient } from 'subscriptions-transport-ws';
import ws from 'ws';
import gql from 'graphql-tag';

export default async function watchForUpdates(
    {
        createNode,
        createPage,
        createNodeId,
        store,
        cache,
        reporter,
        auth,
        touchNode,
    },
    { graphqlEndpoint, storeConfig, queries, watch }
) {
    if (!watch || process.env.NODE_ENV === 'production') {
        return;
    }

    const { base_url } = storeConfig;

    const query = gql`
        subscription SubscribeForUpdates($storeUrl: String!) {
            updates(storeUrl: $storeUrl) {
                type
                value
            }
        }
    `;

    const client = new SubscriptionClient(
        graphqlEndpoint,
        {
            reconnect: true,
        },
        ws
    );

    client.request({ query, variables: { storeUrl: base_url } }).subscribe({
        next: res => {
            console.log('got data:', JSON.stringify(res.data, null, 2));
        },
        error: error => console.error('error:', error),
        complete: () => console.log('done'),
    });
}
