# gatsby-source-magento2
Source plugin for pulling data into [Gatsby][gatsby] from [Magento 2.3][magento]

## Features

- Provides public data available via Magento 2.3 GraphQL endpoint
- Supports `gatsby-transformer-sharp` and `gatsby-image` for images

## Install

```sh
yarn add gatsby-source-magento2
```

## How to use

```js
// add in your gatsby-config.js
plugins: [
    {
        resolve: "gatsby-source-magento2",
        options: {
            graphqlEndpoint: "https://yourstore.url/graphql",
            mediaCatalogUrl: "https://yourstore.url/media/catalog",
        }
    }
]
```

Then you can use queries `magentoProduct` and `allMagentoProduct` to query the product catalog.

## Creating product page nodes

To generate pages for each of the products in your store you need to add this code
to your `gatsby-node.js` file:

```js
exports.createPages = ({ graphql, actions }) => {
    const { createPage } = actions;

    return new Promise((resolve, reject) => {
        resolve(
            graphql(
                `
                    {
                        allMagentoProduct {
                            edges {
                                node {
                                    url_key
                                }
                            }
                        }
                    }
                `
            ).then(result => {
                if (result.errors) {
                    reject(result.errors);
                }

                // Create pages for each product
                result.data.allMagentoProduct.edges.forEach(({node}) => {
                    createPage({
                        path: `/${node.url_key}/`,
                        component: path.resolve(`./src/pages/product.js`),
                        context: {
                            url_key: node.url_key,
                        },
                    });
                });

            })
        );
    });
};
```

## Future work

Add other node sources:
- category 
- cmsPage
- cmsBlocks
- storeConfig

[gatsby]: https://www.gatsbyjs.org/
[magento]: https://magento.com/
 