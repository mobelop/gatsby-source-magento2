# gatsby-source-magento2

Source plugin for pulling data into [Gatsby][gatsby] from [Magento 2.4][magento] which allows building Headless Magento 2 Storefronts, deployed to the CDN - Netlify, Vercel, etc

See this store deployed on Vercel for reference (built on [NeoStorefront](https://www.neostorefront.com/)):

https://basketballhoopandbaskets.com/

Supports: **Magento 2.4+** Community & Enterprise Editions

## Features

- Uses Magento 2.3+ GraphQL endpoint to build a Gatsby GraphQL schema and to download the whole product catalog
- Supports `gatsby-transformer-sharp` and `gatsby-image` for image nodes
- Supports real-time updates of the Magento 2 product catalog in development mode

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
            
            // real-time catalog updates (optional)
            pubsubEndpoint: 'https://pubsub.mobelop.com/graphql',
            pubsubApiKey: '****', // contact info@mobelop.com to get one for free
            watch: true,
            
            // this is optional
            queries: {
                // see example query in src/nodes/queries/products.js
                allProductsQuery: `... custom GraphQL query for fetching all the products you need to publish on Gatsby website ...`,
                // see example query in src/nodes/queries/categories.js
                categoryQuery: `... custom GraphQL query for fetching all the categories & product ids ...`
            }
        }
    }
]
```

Then you can use queries `magentoProduct` and `allMagentoProduct` to query the product catalog. For querying categories - use 
`magentoCategory` and `allMagentoCategory` queries.

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
                        
                        allMagentoCategory {
                            edges {
                                node {
                                    magento_id
                                    url_key
                                    url_path
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
                        component: path.resolve(`./src/pages/product.jsx`),
                        context: {
                            url_key: node.url_key,
                        },
                    });
                });
                
                result.data.allMagentoCategory.edges.forEach(({ node }) => {
                    createPage({
                        path: `/${node.url_path}/`,
                        component: path.resolve(`./src/pages/category.jsx`),
                        context: {
                            category_id: node.magento_id,
                            url_key: node.url_key,
                        },
                    });

                    // id is gatsby.js node id. we need to put magento_id there instead
                    const dstCategory = {
                        ...node,
                        id: node.magento_id,
                    };

                    delete dstCategory.magento_id;
                });
                
            })
        );
    });
};
```

## Using images from Product media gallery & product variants

First you need to make sure your custom product query includes media_gallery & product variants:

```graphql
    query {
        products {
            url_key
            
            media_gallery {
              url
              label
              position
            }

            ... on ConfigurableProduct {
                configurable_options {
                  attribute_id          
                  attribute_code          
                  label
                  values {
                    label
                    value_index
                    swatch_data {
                      value
                    }
                    store_label
                  }
                }
                
                variants {
                  attributes {
                    code
                    label
                    uid
                    value_index
                  }
                  
                  product {
                    sku
                    stock_status
                    image {label url}
                    small_image {label url}
                  }
                }
        
            }

        }
    }
```

Gatsby source plugin will automatically create the following file nodes:

```
media_gallery.image
variants.product.image
variants.product.small_image
```

You can use [Gatsby image transformers][gatsby-image] on these.

## Future work

- multi-store support

[gatsby]: https://www.gatsbyjs.org/
[gatsby-image]: https://www.gatsbyjs.com/plugins/gatsby-image/
[magento]: https://magento.com/
 
## Contacts / Support

Stanislav Smovdorenko: info@mobelop.com
