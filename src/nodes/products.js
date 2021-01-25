import { rawRequest } from 'graphql-request';
import allProductsQuery from './queries/products';
import crypto from 'crypto';
import { downloadNodeImages } from "./images";

const createProductNodes = (
    context,
    { graphqlEndpoint, storeConfig, queries },
    importMaps
) => {
    const { reporter } = context;

    if (!storeConfig) {
        reporter.panic(`got empty storeConfig`);
    }

    if (!storeConfig.secure_base_media_url) {
        reporter.panic(`got empty storeConfig.secure_base_media_url`);
    }

    return new Promise(async (resolve, reject) => {
        // use custom query for querying products
        const query =
            queries && queries.allProductsQuery
                ? queries.allProductsQuery
                : allProductsQuery;

        let products = { items: [] };

        try {
            const {
                data: { products: { items = [] } = {} } = {},
                errors,
            } = await rawRequest(graphqlEndpoint, query);

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
            }
        }

        const bar = reporter.createProgress('Downloading product images');
        bar.start();
        bar.total = products.length;

        for (const item of products) {
            bar.tick();

            try {
                if (!item) {
                    console.error(
                        `gatsby-source-magento2: Got null product item in result`
                    );
                    continue;
                }

                await createProductNode(context, item, importMaps);
            } catch (e) {
                console.error(e);
                bar.end ? bar.end() : bar.done();
                reject(e);
            }
        }

        bar.end ? bar.end() : bar.done();
        resolve();
    });
};

export default createProductNodes;

function logErrors(errors) {
    if (errors && errors.length) {
        console.error(
            'ERRORS while querying products:',
            JSON.stringify(errors, undefined, 4)
        );
    }
}

export async function createProductNode(context, item, importMaps) {
    const { productMap, indexMap } = importMaps;
    const { createNodeId, createNode } = context;
    const productNodeId = createNodeId(`product-${item.id}`);

    await downloadNodeImages(context, item)

    if(item.variants && item.variants.length) {
        await downloadVariantsImages(context, item.variants)
    }

    if(!item.image___NODE && !item.small_image___NODE) {
        console.error(
          'failed to download image:',
          item.image,
          ', for SKU:',
          item.sku
        );

        return
    }

    const nodeData = {
        ...item,
        id: productNodeId,
        _xtypename: item.__typename,
        magento_id: item.id,
        parent: `__PRODUCTS__`,
        children: [],
        internal: {
            type: 'MagentoProduct',
            content: JSON.stringify(item),
            contentDigest: crypto
                .createHash(`md5`)
                .update(JSON.stringify(item))
                .digest(`hex`),
        },
    };

    console.log('product:', JSON.stringify(nodeData, 0, 4))
    createNode(nodeData);

    productMap[item.id] = nodeData.id;

    indexMap['product'][item.id] = nodeData.id;
    indexMap['product']['sku_' + item.sku] = nodeData.id;

    const aggregate = ['new', 'eco_collection'];

    for (const aggr of aggregate) {
        const key = aggr + '_' + item[aggr];
        if (!indexMap['product'][key]) {
            indexMap['product'][key] = [];
        }

        indexMap['product'][key].push(nodeData.id);
    }
}

async function downloadVariantsImages(context, variants) {
    for(const variant of variants) {
        if(variant.product) {
            await downloadNodeImages(context, variant.product)
        }
    }
}