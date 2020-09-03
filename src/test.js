import watchForUpdates from './nodes/watchForUpdates'

async function main() {
    watchForUpdates({},{
        storeConfig:{
            base_url: 'http://teststore.com/'
        },
        graphqlEndpoint:'http://pubsub.mobelop.com/graphql',
        // graphqlEndpoint:'http://localhost:4000/graphql',
        watch: true
    })
}

main()